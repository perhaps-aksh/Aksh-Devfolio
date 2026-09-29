import type {
  AdminMediaAsset,
  AdminWritingDetail,
  AdminWritingRow,
  MediaKind,
  Paged,
  PostStatus,
} from "@/lib/admin-types";
import {
  isValidSlug,
  normalizeTags,
  normalizeWritingType,
  safeSearchTerm,
  slugify,
} from "@/lib/blog-utils";
import { docToText, readingTime, safeUrl, sanitizeDoc } from "@/lib/rich-text";

import { HttpError, requireAdmin } from "./admin-auth.server";
import { invalidateContent } from "./cache.server";
import { config } from "./env.server";
import { sniffMediaFile } from "./file-sniff.server";
import {
  adminDb,
  adminStorage,
  parseStorageUrl,
  storagePublicUrl,
  type Db,
} from "./supabase.server";

/**
 * Admin CRUD for writings (poems, thoughts, questions, stories, …) and the media library. Mirrors the
 * blog post admin functions closely — same document sanitisation, same slug/tag handling — since it's
 * conceptually the same editor with different metadata.
 */
type Result<T> = {
  data: T | null;
  error: { message: string; code?: string } | null;
  count?: number | null;
};

async function admin(): Promise<Db> {
  await requireAdmin();
  return adminDb();
}
function unwrap<T>(result: Result<T>): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}
function conflict(error: { message: string; code?: string }, what: string): never {
  if (error.code === "23505")
    throw new HttpError(409, `That ${what} is already in use. Choose another.`);
  if (error.code === "P0001") throw new HttpError(400, error.message);
  throw new Error(error.message);
}

const WRITING_LIST_COLUMNS =
  "id,slug,title,subtitle,excerpt,type,cover_image,cover_alt,status,featured,display_order,tags,author_name,reading_time,collection_id,chapter_id,section_id,series_id,series_order,published_at,created_at,updated_at";
const WRITING_PAGE_SIZE = 15;

async function removeStoredFile(url: string | null | undefined): Promise<void> {
  const parsed = parseStorageUrl(url);
  if (!parsed) return;
  try {
    await adminStorage().from(parsed.bucket).remove([parsed.path]);
  } catch (error) {
    console.error("[admin] could not remove file:", error);
  }
}

// --- writings -------------------------------------------------------------------------------------

export async function listAdminWritings(input: {
  q?: string | undefined;
  status?: PostStatus | undefined;
  type?: string | undefined;
  page: number;
}): Promise<Paged<AdminWritingRow>> {
  const db = await admin();
  const q = safeSearchTerm(input.q ?? "");
  const page = Math.max(1, input.page);
  let query = db.from("writings").select(WRITING_LIST_COLUMNS, { count: "exact" });
  if (input.status) query = query.eq("status", input.status);
  if (input.type) query = query.eq("type", input.type);
  if (q) query = query.or(`title.ilike.*${q}*,slug.ilike.*${q}*,type.ilike.*${q}*`);
  const from = (page - 1) * WRITING_PAGE_SIZE;
  const res = (await query
    .order("updated_at", { ascending: false })
    .range(from, from + WRITING_PAGE_SIZE - 1)) as Result<AdminWritingRow[]>;
  const items = unwrap(res);
  return { items, total: res.count ?? items.length, page, pageSize: WRITING_PAGE_SIZE };
}

export async function getAdminWriting(id: string): Promise<AdminWritingDetail | null> {
  const db = await admin();
  const res = (await db
    .from("writings")
    .select("*")
    .eq("id", id)
    .maybeSingle()) as Result<AdminWritingDetail>;
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export type SaveWritingInput = {
  id?: string | undefined;
  title: string;
  slug: string;
  subtitle: string;
  excerpt: string;
  content?: unknown;
  type: string;
  cover_image: string | null;
  cover_alt: string;
  status: PostStatus;
  featured: boolean;
  tags: string[];
  collection_id: string | null;
  chapter_id: string | null;
  section_id: string | null;
  series_id: string | null;
  series_order: number | null;
  /** ISO date. Empty + status "published" means "publish now". A future date schedules it. */
  published_at: string | null;
};

export async function saveWriting(input: SaveWritingInput): Promise<AdminWritingRow> {
  const db = await admin();
  const title = input.title.trim();
  if (!title) throw new HttpError(400, "A title is required.");
  const slug = slugify(input.slug || title, 120);
  if (!isValidSlug(slug))
    throw new HttpError(400, "The slug may only contain lowercase letters, numbers and hyphens.");

  const doc = sanitizeDoc(input.content);
  const text = docToText(doc);
  if (input.status === "published" && !text && !JSON.stringify(doc).includes('"image"')) {
    throw new HttpError(400, "Write something before publishing — it's empty.");
  }
  const excerpt = (
    input.excerpt.trim() || (text.length > 180 ? `${text.slice(0, 177).trimEnd()}…` : text)
  ).slice(0, 400);

  let publishedAt: string | null = null;
  if (input.published_at) {
    const date = new Date(input.published_at);
    if (Number.isNaN(date.getTime()))
      throw new HttpError(400, "The publication date is not valid.");
    publishedAt = date.toISOString();
  }
  const cover = input.cover_image ? safeUrl(input.cover_image, { images: true }) : null;

  const row = {
    title,
    slug,
    subtitle: input.subtitle.trim().slice(0, 300),
    excerpt,
    content: doc,
    type: normalizeWritingType(input.type),
    cover_image: cover,
    cover_alt: input.cover_alt.trim().slice(0, 200),
    status: input.status,
    featured: input.featured,
    tags: normalizeTags(input.tags),
    reading_time: Math.min(240, readingTime(doc)),
    collection_id: input.collection_id,
    chapter_id: input.chapter_id,
    section_id: input.section_id,
    series_id: input.series_id,
    series_order: input.series_id ? input.series_order : null,
    published_at: publishedAt,
  };

  if (input.id) {
    const before = (await db
      .from("writings")
      .select("cover_image")
      .eq("id", input.id)
      .maybeSingle()) as Result<{ cover_image: string | null }>;
    const res = (await db
      .from("writings")
      .update(row)
      .eq("id", input.id)
      .select(WRITING_LIST_COLUMNS)
      .single()) as Result<AdminWritingRow>;
    if (res.error) conflict(res.error, "slug");
    if (before.data?.cover_image && before.data.cover_image !== cover)
      await removeStoredFile(before.data.cover_image);
    invalidateContent();
    return res.data as AdminWritingRow;
  }
  const res = (await db
    .from("writings")
    .insert(row)
    .select(WRITING_LIST_COLUMNS)
    .single()) as Result<AdminWritingRow>;
  if (res.error) conflict(res.error, "slug");
  invalidateContent();
  return res.data as AdminWritingRow;
}

export async function setWritingStatus(id: string, status: PostStatus): Promise<AdminWritingRow> {
  const db = await admin();
  const res = (await db
    .from("writings")
    .update({ status })
    .eq("id", id)
    .select(WRITING_LIST_COLUMNS)
    .single()) as Result<AdminWritingRow>;
  const row = unwrap(res);
  invalidateContent();
  return row;
}

export async function deleteWriting(id: string): Promise<void> {
  const db = await admin();
  const before = (await db
    .from("writings")
    .select("cover_image")
    .eq("id", id)
    .maybeSingle()) as Result<{ cover_image: string | null }>;
  unwrap((await db.from("writings").delete().eq("id", id)) as Result<unknown>);
  await removeStoredFile(before.data?.cover_image);
  invalidateContent();
}

// --- media library ----------------------------------------------------------------------------------

const MAX_MEDIA_BYTES = 50 * 1024 * 1024;

export async function listMediaAssets(input: {
  q?: string | undefined;
  kind?: MediaKind | undefined;
  page: number;
}): Promise<Paged<AdminMediaAsset>> {
  const db = await admin();
  const pageSize = 24;
  const page = Math.max(1, input.page);
  const q = safeSearchTerm(input.q ?? "");
  let query = db.from("media_assets").select("*", { count: "exact" });
  if (input.kind) query = query.eq("kind", input.kind);
  if (q) query = query.ilike("filename", `*${q}*`);
  const from = (page - 1) * pageSize;
  const res = (await query
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1)) as Result<AdminMediaAsset[]>;
  const items = unwrap(res);
  return { items, total: res.count ?? items.length, page, pageSize };
}

/**
 * Media uploads are two steps so large files (videos, PDFs) never pass through the server: the browser
 * PUTs the file straight to Supabase Storage using a short-lived signed URL (`createMediaUpload`), then
 * asks the server to verify and catalogue it (`finalizeMediaUpload`). That keeps uploads clear of the
 * request-body limits of serverless hosts (Vercel allows ~4.5 MB per request).
 */
const UPLOAD_EXTENSIONS: Record<string, string> = {
  jpg: "jpg",
  jpeg: "jpg",
  png: "png",
  gif: "gif",
  webp: "webp",
  avif: "avif",
  svg: "svg",
  mp4: "mp4",
  m4v: "mp4",
  webm: "webm",
  mov: "mov",
  pdf: "pdf",
  doc: "doc",
  docx: "docx",
  xls: "xls",
  xlsx: "xlsx",
  ppt: "ppt",
  pptx: "pptx",
  txt: "txt",
  csv: "csv",
  zip: "zip",
};
const MEDIA_PATH =
  /^\d{4}\/\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{2,5}$/;

export type MediaUploadTicket = {
  path: string;
  signedUrl: string;
  /** Headers the browser sends with the upload (the public anon key; the signed URL carries the real authorisation). */
  headers: Record<string, string>;
};

/** Step 1: checks the request and returns a one-time signed URL the browser uploads to directly. */
export async function createMediaUpload(input: {
  filename: string;
  size: number;
}): Promise<MediaUploadTicket> {
  await requireAdmin();
  if (!Number.isFinite(input.size) || input.size <= 0)
    throw new HttpError(400, "The file is empty.");
  if (input.size > MAX_MEDIA_BYTES) throw new HttpError(413, "Files must be 50 MB or smaller.");
  const ext = UPLOAD_EXTENSIONS[(input.filename.split(".").pop() ?? "").toLowerCase()];
  if (!ext)
    throw new HttpError(
      415,
      "That file type isn't supported. Try an image, video, PDF, Office document, text file or zip.",
    );

  const now = new Date();
  const path = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await adminStorage().from("media").createSignedUploadUrl(path);
  if (error || !data)
    throw new Error(`Could not start the upload: ${error?.message ?? "unknown error"}`);
  const anon = config.supabaseAnonKey();
  return { path, signedUrl: data.signedUrl, headers: anon ? { apikey: anon } : {} };
}

/** Reads the first bytes of a public object (and its total size) without downloading the whole file. */
async function readHead(
  url: string,
  bytes: number,
): Promise<{ head: Uint8Array; total: number | null; type: string } | null> {
  const res = await fetch(url, { headers: { Range: `bytes=0-${bytes - 1}` } });
  if (!res.ok || !res.body) return null;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (length < bytes) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    length += value.length;
  }
  await reader.cancel().catch(() => {});
  const head = new Uint8Array(Math.min(length, bytes));
  let offset = 0;
  for (const chunk of chunks) {
    const take = Math.min(chunk.length, head.length - offset);
    head.set(chunk.subarray(0, take), offset);
    offset += take;
    if (offset >= head.length) break;
  }
  const range = /\/(\d+)$/.exec(res.headers.get("content-range") ?? "");
  const total = range ? Number(range[1]) : Number(res.headers.get("content-length")) || null;
  return { head, total, type: res.headers.get("content-type") ?? "" };
}

async function discardUpload(path: string): Promise<void> {
  await adminStorage()
    .from("media")
    .remove([path])
    .catch(() => {});
}

/** Step 2: verifies what was actually uploaded (by its bytes, not its name) and adds it to the library. */
export async function finalizeMediaUpload(input: {
  path: string;
  filename: string;
  altText: string;
}): Promise<AdminMediaAsset> {
  const db = await admin();
  if (!MEDIA_PATH.test(input.path)) throw new HttpError(400, "That upload is not valid.");

  const url = storagePublicUrl("media", input.path);
  const found = await readHead(url, 512);
  if (!found) throw new HttpError(400, "The uploaded file could not be found. Please try again.");
  if (found.total !== null && found.total > MAX_MEDIA_BYTES) {
    await discardUpload(input.path);
    throw new HttpError(413, "Files must be 50 MB or smaller.");
  }
  const sniffed = sniffMediaFile(found.head, found.type, input.filename || input.path);
  if (!sniffed) {
    await discardUpload(input.path);
    throw new HttpError(
      415,
      "That file type isn't supported. Try an image, video, PDF, Office document, text file or zip.",
    );
  }

  const filename = input.filename.trim().slice(0, 200) || `file.${sniffed.ext}`;
  const res = (await db
    .from("media_assets")
    .insert({
      bucket: "media",
      path: input.path,
      url,
      filename,
      mime_type: sniffed.mime,
      kind: sniffed.kind,
      size_bytes: found.total ?? found.head.length,
      alt_text: input.altText.trim().slice(0, 300),
    })
    .select("*")
    .single()) as Result<AdminMediaAsset>;
  if (res.error) {
    await discardUpload(input.path);
    if (res.error.code === "23505") throw new HttpError(409, "That file was already added.");
    throw new Error(res.error.message);
  }
  return res.data as AdminMediaAsset;
}

export async function deleteMediaAsset(id: string): Promise<void> {
  const db = await admin();
  const before = (await db
    .from("media_assets")
    .select("bucket,path")
    .eq("id", id)
    .maybeSingle()) as Result<{ bucket: string; path: string }>;
  unwrap((await db.from("media_assets").delete().eq("id", id)) as Result<unknown>);
  if (before.data) {
    try {
      await adminStorage().from(before.data.bucket).remove([before.data.path]);
    } catch (error) {
      console.error("[admin] could not remove media file:", error);
    }
  }
}
