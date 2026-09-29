import type {
  AdminContact,
  AdminPostDetail,
  AdminPostRow,
  AdminProject,
  AdminWritingRow,
  ContactStatus,
  DashboardData,
  DashboardStats,
  Paged,
  PostStatus,
  RecentVisit,
  SettingsInfo,
} from "@/lib/admin-types";
import {
  isValidSlug,
  normalizeCategory,
  normalizeTags,
  safeSearchTerm,
  slugify,
} from "@/lib/blog-utils";
import { docToText, readingTime, safeUrl, sanitizeDoc } from "@/lib/rich-text";

import { HttpError, requireAdmin } from "./admin-auth.server";
import { invalidateContent } from "./cache.server";
import { config, isAdminConfigured } from "./env.server";
import {
  adminDb,
  adminStorage,
  parseStorageUrl,
  storagePublicUrl,
  type Db,
} from "./supabase.server";

/**
 * Admin-only data access (service-role key). Each function re-checks the admin session itself, on top of
 * the middleware on the server functions, so a future call site cannot forget the check.
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

const POST_LIST_COLUMNS =
  "id,slug,title,excerpt,cover_image,cover_alt,category,tags,author_name,published_at,reading_time,status,created_at,updated_at";
const PROJECT_COLUMNS = "*";
const BUCKETS = ["blog-images", "project-images"] as const;
export type Bucket = (typeof BUCKETS)[number];

const PAGE_SIZE = 15;

function conflict(error: { message: string; code?: string }, what: string): never {
  if (error.code === "23505")
    throw new HttpError(409, `That ${what} is already in use. Choose another.`);
  throw new Error(error.message);
}

function httpUrl(value: string | null | undefined, label: string): string | null {
  const text = (value ?? "").trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol === "https:" || url.protocol === "http:") return text;
  } catch {
    /* fall through */
  }
  throw new HttpError(400, `${label} must be a full http(s) URL.`);
}

async function removeStoredImage(url: string | null | undefined): Promise<void> {
  const parsed = parseStorageUrl(url);
  if (!parsed || !(BUCKETS as readonly string[]).includes(parsed.bucket)) return;
  try {
    await adminStorage().from(parsed.bucket).remove([parsed.path]);
  } catch (error) {
    console.error("[admin] could not remove image:", error);
  }
}

// --- dashboard & analytics ----------------------------------------------------------------------------

const WRITING_LIST_COLUMNS =
  "id,slug,title,subtitle,excerpt,type,cover_image,cover_alt,status,featured,display_order,tags,author_name,reading_time,collection_id,chapter_id,section_id,series_id,series_order,published_at,created_at,updated_at";

export async function getDashboard(days: number): Promise<DashboardData> {
  const db = await admin();
  const [stats, visits, contacts, posts, writings] = await Promise.all([
    db.rpc("admin_dashboard", { p_days: days }),
    db
      .from("page_views")
      .select("id,path,referrer,device,browser,os,country,created_at")
      .order("id", { ascending: false })
      .limit(8),
    db.from("contact_submissions").select("*").order("created_at", { ascending: false }).limit(4),
    db.from("posts").select(POST_LIST_COLUMNS).order("updated_at", { ascending: false }).limit(5),
    db
      .from("writings")
      .select(WRITING_LIST_COLUMNS)
      .order("updated_at", { ascending: false })
      .limit(5),
  ]);
  return {
    stats: unwrap<DashboardStats>(stats as Result<DashboardStats>),
    recentVisits: unwrap<RecentVisit[]>(visits as Result<RecentVisit[]>),
    recentContacts: unwrap<AdminContact[]>(contacts as Result<AdminContact[]>),
    recentPosts: unwrap<AdminPostRow[]>(posts as Result<AdminPostRow[]>),
    recentWritings: unwrap<AdminWritingRow[]>(writings as Result<AdminWritingRow[]>),
  };
}

export async function getAnalytics(
  days: number,
): Promise<{ stats: DashboardStats; recentVisits: RecentVisit[] }> {
  const db = await admin();
  const [stats, visits] = await Promise.all([
    db.rpc("admin_dashboard", { p_days: days }),
    db
      .from("page_views")
      .select("id,path,referrer,device,browser,os,country,created_at")
      .order("id", { ascending: false })
      .limit(25),
  ]);
  return {
    stats: unwrap<DashboardStats>(stats as Result<DashboardStats>),
    recentVisits: unwrap<RecentVisit[]>(visits as Result<RecentVisit[]>),
  };
}

// --- posts --------------------------------------------------------------------------------------------

export async function listAdminPosts(input: {
  q?: string | undefined;
  status?: PostStatus | undefined;
  page: number;
}): Promise<Paged<AdminPostRow>> {
  const db = await admin();
  const q = safeSearchTerm(input.q ?? "");
  const page = Math.max(1, input.page);
  let query = db.from("posts").select(POST_LIST_COLUMNS, { count: "exact" });
  if (input.status) query = query.eq("status", input.status);
  if (q) query = query.or(`title.ilike.*${q}*,slug.ilike.*${q}*,category.ilike.*${q}*`);
  const from = (page - 1) * PAGE_SIZE;
  const res = (await query
    .order("updated_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1)) as Result<AdminPostRow[]>;
  const items = unwrap(res);
  return { items, total: res.count ?? items.length, page, pageSize: PAGE_SIZE };
}

export async function getAdminPost(id: string): Promise<AdminPostDetail | null> {
  const db = await admin();
  const res = (await db
    .from("posts")
    .select("*")
    .eq("id", id)
    .maybeSingle()) as Result<AdminPostDetail>;
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export type SavePostInput = {
  id?: string | undefined;
  title: string;
  slug: string;
  excerpt: string;
  content?: unknown;
  cover_image: string | null;
  cover_alt: string;
  category: string;
  tags: string[];
  status: PostStatus;
  /** ISO date. Empty + status "published" means "publish now". A future date schedules the post. */
  published_at: string | null;
};

export async function savePost(input: SavePostInput): Promise<AdminPostRow> {
  const db = await admin();
  const title = input.title.trim();
  if (!title) throw new HttpError(400, "A title is required.");
  const slug = slugify(input.slug || title, 120);
  if (!isValidSlug(slug))
    throw new HttpError(400, "The slug may only contain lowercase letters, numbers and hyphens.");

  const doc = sanitizeDoc(input.content);
  const text = docToText(doc);
  if (input.status === "published" && !text && !JSON.stringify(doc).includes('"image"')) {
    throw new HttpError(400, "Write something before publishing — the article is empty.");
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
    excerpt,
    content: doc,
    cover_image: cover,
    cover_alt: input.cover_alt.trim().slice(0, 200),
    category: normalizeCategory(input.category),
    tags: normalizeTags(input.tags),
    status: input.status,
    reading_time: Math.min(240, readingTime(doc)),
    published_at: publishedAt,
  };

  if (input.id) {
    const before = (await db
      .from("posts")
      .select("cover_image")
      .eq("id", input.id)
      .maybeSingle()) as Result<{ cover_image: string | null }>;
    const res = (await db
      .from("posts")
      .update(row)
      .eq("id", input.id)
      .select(POST_LIST_COLUMNS)
      .single()) as Result<AdminPostRow>;
    if (res.error) conflict(res.error, "slug");
    if (before.data?.cover_image && before.data.cover_image !== cover)
      await removeStoredImage(before.data.cover_image);
    invalidateContent();
    return res.data as AdminPostRow;
  }

  const res = (await db
    .from("posts")
    .insert(row)
    .select(POST_LIST_COLUMNS)
    .single()) as Result<AdminPostRow>;
  if (res.error) conflict(res.error, "slug");
  invalidateContent();
  return res.data as AdminPostRow;
}

export async function setPostStatus(id: string, status: PostStatus): Promise<AdminPostRow> {
  const db = await admin();
  const res = (await db
    .from("posts")
    .update({ status })
    .eq("id", id)
    .select(POST_LIST_COLUMNS)
    .single()) as Result<AdminPostRow>;
  const row = unwrap(res);
  invalidateContent();
  return row;
}

export async function deletePost(id: string): Promise<void> {
  const db = await admin();
  const before = (await db
    .from("posts")
    .select("cover_image")
    .eq("id", id)
    .maybeSingle()) as Result<{ cover_image: string | null }>;
  unwrap((await db.from("posts").delete().eq("id", id)) as Result<unknown>);
  await removeStoredImage(before.data?.cover_image);
  invalidateContent();
}

// --- projects -----------------------------------------------------------------------------------------

export async function listAdminProjects(): Promise<AdminProject[]> {
  const db = await admin();
  return unwrap<AdminProject[]>(
    (await db
      .from("projects")
      .select(PROJECT_COLUMNS)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true })) as Result<AdminProject[]>,
  );
}

export type SaveProjectInput = {
  id?: string | undefined;
  slug: string;
  title: string;
  year: string;
  category: string;
  description: string;
  image_url: string | null;
  technologies: string[];
  github_url: string | null;
  live_url: string | null;
  featured: boolean;
  published: boolean;
};

export async function saveProject(input: SaveProjectInput): Promise<AdminProject> {
  const db = await admin();
  const title = input.title.trim();
  if (!title) throw new HttpError(400, "A project title is required.");
  const slug = slugify(input.slug || title, 80);
  if (!isValidSlug(slug))
    throw new HttpError(400, "The slug may only contain lowercase letters, numbers and hyphens.");

  const image = input.image_url ? safeUrl(input.image_url, { images: true }) : null;
  const row = {
    slug,
    title,
    year: input.year.trim().slice(0, 12) || String(new Date().getUTCFullYear()),
    category: input.category.trim().slice(0, 60),
    description: input.description.trim().slice(0, 600),
    image_url: image,
    technologies: input.technologies
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 16),
    github_url: httpUrl(input.github_url, "The GitHub link"),
    live_url: httpUrl(input.live_url, "The live demo link"),
    featured: input.featured,
    published: input.published,
  };

  if (input.id) {
    const before = (await db
      .from("projects")
      .select("image_url")
      .eq("id", input.id)
      .maybeSingle()) as Result<{ image_url: string | null }>;
    const res = (await db
      .from("projects")
      .update(row)
      .eq("id", input.id)
      .select(PROJECT_COLUMNS)
      .single()) as Result<AdminProject>;
    if (res.error) conflict(res.error, "slug");
    if (before.data?.image_url && before.data.image_url !== image)
      await removeStoredImage(before.data.image_url);
    invalidateContent();
    return res.data as AdminProject;
  }

  const last = (await db
    .from("projects")
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1)) as Result<{ display_order: number }[]>;
  const next = (last.data?.[0]?.display_order ?? 0) + 10;
  const res = (await db
    .from("projects")
    .insert({ ...row, display_order: next })
    .select(PROJECT_COLUMNS)
    .single()) as Result<AdminProject>;
  if (res.error) conflict(res.error, "slug");
  invalidateContent();
  return res.data as AdminProject;
}

export async function reorderProjects(ids: string[]): Promise<void> {
  const db = await admin();
  const results = await Promise.all(
    ids.slice(0, 100).map((id, index) =>
      db
        .from("projects")
        .update({ display_order: (index + 1) * 10 })
        .eq("id", id),
    ),
  );
  for (const res of results) if (res.error) throw new Error(res.error.message);
  invalidateContent();
}

export async function deleteProject(id: string): Promise<void> {
  const db = await admin();
  const before = (await db
    .from("projects")
    .select("image_url")
    .eq("id", id)
    .maybeSingle()) as Result<{ image_url: string | null }>;
  unwrap((await db.from("projects").delete().eq("id", id)) as Result<unknown>);
  await removeStoredImage(before.data?.image_url);
  invalidateContent();
}

// --- contact submissions ------------------------------------------------------------------------------

export async function listContacts(input: {
  status?: ContactStatus | undefined;
  q?: string | undefined;
  page: number;
}): Promise<Paged<AdminContact> & { unread: number }> {
  const db = await admin();
  const q = safeSearchTerm(input.q ?? "");
  const page = Math.max(1, input.page);
  const size = 20;
  let query = db.from("contact_submissions").select("*", { count: "exact" });
  if (input.status) query = query.eq("status", input.status);
  if (q) query = query.or(`name.ilike.*${q}*,email.ilike.*${q}*,message.ilike.*${q}*`);
  const from = (page - 1) * size;
  const [list, unread] = await Promise.all([
    query.order("created_at", { ascending: false }).range(from, from + size - 1),
    db
      .from("contact_submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "unread"),
  ]);
  const items = unwrap<AdminContact[]>(list as Result<AdminContact[]>);
  return {
    items,
    total: (list as Result<unknown>).count ?? items.length,
    page,
    pageSize: size,
    unread: (unread as Result<unknown>).count ?? 0,
  };
}

export async function markContacts(ids: string[], status: ContactStatus): Promise<void> {
  const db = await admin();
  unwrap(
    (await db
      .from("contact_submissions")
      .update({ status })
      .in("id", ids.slice(0, 100))) as Result<unknown>,
  );
}

export async function deleteContacts(ids: string[]): Promise<void> {
  const db = await admin();
  unwrap(
    (await db.from("contact_submissions").delete().in("id", ids.slice(0, 100))) as Result<unknown>,
  );
}

// --- images -------------------------------------------------------------------------------------------

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Identify the real file type from its first bytes — the browser-supplied MIME type and file name are not trusted. */
function sniffImage(bytes: Uint8Array): { mime: string; ext: string } | null {
  const at = (i: number) => bytes[i] ?? 0;
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47)
    return { mime: "image/png", ext: "png" };
  if (at(0) === 0x47 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x38)
    return { mime: "image/gif", ext: "gif" };
  if (
    at(0) === 0x52 &&
    at(1) === 0x49 &&
    at(2) === 0x46 &&
    at(3) === 0x46 &&
    at(8) === 0x57 &&
    at(9) === 0x45 &&
    at(10) === 0x42 &&
    at(11) === 0x50
  ) {
    return { mime: "image/webp", ext: "webp" };
  }
  if (
    at(4) === 0x66 &&
    at(5) === 0x74 &&
    at(6) === 0x79 &&
    at(7) === 0x70 &&
    at(8) === 0x61 &&
    at(9) === 0x76 &&
    at(10) === 0x69 &&
    at(11) === 0x66
  ) {
    return { mime: "image/avif", ext: "avif" };
  }
  return null;
}

export async function uploadImage(
  bucket: string,
  file: unknown,
): Promise<{ url: string; path: string }> {
  await requireAdmin();
  if (!(BUCKETS as readonly string[]).includes(bucket))
    throw new HttpError(400, "Unknown storage bucket.");
  if (!(file instanceof File)) throw new HttpError(400, "No file was uploaded.");
  if (file.size === 0) throw new HttpError(400, "The file is empty.");
  if (file.size > MAX_IMAGE_BYTES) throw new HttpError(413, "Images must be 5 MB or smaller.");

  const buffer = await file.arrayBuffer();
  const kind = sniffImage(new Uint8Array(buffer, 0, Math.min(16, buffer.byteLength)));
  if (!kind) throw new HttpError(415, "Only JPEG, PNG, WebP, GIF and AVIF images are supported.");

  const now = new Date();
  const path = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}.${kind.ext}`;
  const { error } = await adminStorage().from(bucket).upload(path, buffer, {
    contentType: kind.mime,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return { url: storagePublicUrl(bucket, path), path };
}

export async function deleteImageByUrl(url: string): Promise<void> {
  await requireAdmin();
  await removeStoredImage(url);
}

// --- settings -----------------------------------------------------------------------------------------

export async function getSettingsInfo(siteUrl: string): Promise<SettingsInfo> {
  await requireAdmin();
  const base = config.supabaseUrl();
  const info: SettingsInfo = {
    supabaseUrl: Boolean(base),
    anonKey: Boolean(config.supabaseAnonKey()),
    serviceKey: Boolean(config.supabaseServiceKey()),
    adminId: Boolean(config.adminId()),
    adminPassword: Boolean(config.adminPassword()),
    passwordHash: Boolean(config.adminPasswordHash()),
    sessionSecret: Boolean(config.sessionSecret() && (config.sessionSecret() ?? "").length >= 32),
    siteUrl,
    supabaseHost: base ? new URL(base).host : null,
    connection: "unconfigured",
    connectionMessage: "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to connect.",
  };
  if (!isAdminConfigured()) info.connectionMessage = "Admin credentials are not configured.";
  if (base && config.supabaseServiceKey()) {
    try {
      const res = (await adminDb()
        .from("posts")
        .select("id", { count: "exact", head: true })) as Result<unknown>;
      if (res.error) {
        info.connection = "error";
        info.connectionMessage = `Supabase responded with an error: ${res.error.message}. Did you run the migration?`;
      } else {
        info.connection = "ok";
        info.connectionMessage = "Connected — the database schema is reachable.";
      }
    } catch (error) {
      info.connection = "error";
      info.connectionMessage = `Could not reach Supabase: ${error instanceof Error ? error.message : "unknown error"}`;
    }
  }
  return info;
}
