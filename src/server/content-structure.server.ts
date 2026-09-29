import type {
  AdminChapter,
  AdminCollection,
  AdminSection,
  AdminSeries,
  ContentStructure,
} from "@/lib/admin-types";
import { isValidSlug, slugify } from "@/lib/blog-utils";
import { safeUrl } from "@/lib/rich-text";

import { HttpError, requireAdmin } from "./admin-auth.server";
import { invalidateContent } from "./cache.server";
import { adminDb, type Db } from "./supabase.server";

/**
 * Admin CRUD for the content-organization taxonomy: collections, chapters, sections, series.
 * These are small, low-traffic tables — a single call loads all of them for the unified admin manager.
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
  throw new Error(error.message);
}

export async function getContentStructure(): Promise<ContentStructure> {
  const db = await admin();
  const [collections, chapters, sections, series] = await Promise.all([
    db.from("collections").select("*").order("display_order"),
    db.from("chapters").select("*").order("display_order"),
    db.from("sections").select("*").order("display_order"),
    db.from("series").select("*").order("title"),
  ]);
  return {
    collections: unwrap<AdminCollection[]>(collections as Result<AdminCollection[]>),
    chapters: unwrap<AdminChapter[]>(chapters as Result<AdminChapter[]>),
    sections: unwrap<AdminSection[]>(sections as Result<AdminSection[]>),
    series: unwrap<AdminSeries[]>(series as Result<AdminSeries[]>),
  };
}

// --- collections ----------------------------------------------------------------------------------

export type SaveCollectionInput = {
  id?: string | undefined;
  slug: string;
  title: string;
  description: string;
  cover_image: string | null;
};

export async function saveCollection(input: SaveCollectionInput): Promise<AdminCollection> {
  const db = await admin();
  const title = input.title.trim();
  if (!title) throw new HttpError(400, "A title is required.");
  const slug = slugify(input.slug || title, 100);
  if (!isValidSlug(slug))
    throw new HttpError(400, "The slug may only contain lowercase letters, numbers and hyphens.");
  const row = {
    slug,
    title,
    description: input.description.trim().slice(0, 600),
    cover_image: input.cover_image ? safeUrl(input.cover_image, { images: true }) : null,
  };

  if (input.id) {
    const res = (await db
      .from("collections")
      .update(row)
      .eq("id", input.id)
      .select("*")
      .single()) as Result<AdminCollection>;
    if (res.error) conflict(res.error, "slug");
    invalidateContent();
    return res.data as AdminCollection;
  }
  const last = (await db
    .from("collections")
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1)) as Result<{ display_order: number }[]>;
  const next = (last.data?.[0]?.display_order ?? 0) + 10;
  const res = (await db
    .from("collections")
    .insert({ ...row, display_order: next })
    .select("*")
    .single()) as Result<AdminCollection>;
  if (res.error) conflict(res.error, "slug");
  invalidateContent();
  return res.data as AdminCollection;
}

export async function reorderCollections(ids: string[]): Promise<void> {
  const db = await admin();
  const results = await Promise.all(
    ids.slice(0, 200).map((id, i) =>
      db
        .from("collections")
        .update({ display_order: (i + 1) * 10 })
        .eq("id", id),
    ),
  );
  for (const r of results) if (r.error) throw new Error(r.error.message);
  invalidateContent();
}

export async function deleteCollection(id: string): Promise<void> {
  const db = await admin();
  unwrap((await db.from("collections").delete().eq("id", id)) as Result<unknown>);
  invalidateContent();
}

// --- chapters -------------------------------------------------------------------------------------

export type SaveChapterInput = {
  id?: string | undefined;
  collection_id: string;
  slug: string;
  title: string;
  subtitle: string;
};

export async function saveChapter(input: SaveChapterInput): Promise<AdminChapter> {
  const db = await admin();
  const title = input.title.trim();
  if (!title) throw new HttpError(400, "A title is required.");
  if (!input.collection_id)
    throw new HttpError(400, "Choose the collection this chapter belongs to.");
  const slug = slugify(input.slug || title, 100);
  if (!isValidSlug(slug))
    throw new HttpError(400, "The slug may only contain lowercase letters, numbers and hyphens.");
  const row = {
    collection_id: input.collection_id,
    slug,
    title,
    subtitle: input.subtitle.trim().slice(0, 300),
  };

  if (input.id) {
    const res = (await db
      .from("chapters")
      .update(row)
      .eq("id", input.id)
      .select("*")
      .single()) as Result<AdminChapter>;
    if (res.error) conflict(res.error, "slug within this collection");
    invalidateContent();
    return res.data as AdminChapter;
  }
  const last = (await db
    .from("chapters")
    .select("display_order")
    .eq("collection_id", input.collection_id)
    .order("display_order", { ascending: false })
    .limit(1)) as Result<{ display_order: number }[]>;
  const next = (last.data?.[0]?.display_order ?? 0) + 10;
  const res = (await db
    .from("chapters")
    .insert({ ...row, display_order: next })
    .select("*")
    .single()) as Result<AdminChapter>;
  if (res.error) conflict(res.error, "slug within this collection");
  invalidateContent();
  return res.data as AdminChapter;
}

export async function reorderChapters(ids: string[]): Promise<void> {
  const db = await admin();
  const results = await Promise.all(
    ids.slice(0, 200).map((id, i) =>
      db
        .from("chapters")
        .update({ display_order: (i + 1) * 10 })
        .eq("id", id),
    ),
  );
  for (const r of results) if (r.error) throw new Error(r.error.message);
  invalidateContent();
}

export async function deleteChapter(id: string): Promise<void> {
  const db = await admin();
  unwrap((await db.from("chapters").delete().eq("id", id)) as Result<unknown>);
  invalidateContent();
}

// --- sections -------------------------------------------------------------------------------------

export type SaveSectionInput = {
  id?: string | undefined;
  slug: string;
  title: string;
  description: string;
};

export async function saveSection(input: SaveSectionInput): Promise<AdminSection> {
  const db = await admin();
  const title = input.title.trim();
  if (!title) throw new HttpError(400, "A title is required.");
  const slug = slugify(input.slug || title, 100);
  if (!isValidSlug(slug))
    throw new HttpError(400, "The slug may only contain lowercase letters, numbers and hyphens.");
  const row = { slug, title, description: input.description.trim().slice(0, 400) };

  if (input.id) {
    const res = (await db
      .from("sections")
      .update(row)
      .eq("id", input.id)
      .select("*")
      .single()) as Result<AdminSection>;
    if (res.error) conflict(res.error, "slug");
    invalidateContent();
    return res.data as AdminSection;
  }
  const last = (await db
    .from("sections")
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1)) as Result<{ display_order: number }[]>;
  const next = (last.data?.[0]?.display_order ?? 0) + 10;
  const res = (await db
    .from("sections")
    .insert({ ...row, display_order: next })
    .select("*")
    .single()) as Result<AdminSection>;
  if (res.error) conflict(res.error, "slug");
  invalidateContent();
  return res.data as AdminSection;
}

export async function reorderSections(ids: string[]): Promise<void> {
  const db = await admin();
  const results = await Promise.all(
    ids.slice(0, 200).map((id, i) =>
      db
        .from("sections")
        .update({ display_order: (i + 1) * 10 })
        .eq("id", id),
    ),
  );
  for (const r of results) if (r.error) throw new Error(r.error.message);
  invalidateContent();
}

export async function deleteSection(id: string): Promise<void> {
  const db = await admin();
  unwrap((await db.from("sections").delete().eq("id", id)) as Result<unknown>);
  invalidateContent();
}

// --- series ---------------------------------------------------------------------------------------

export type SaveSeriesInput = {
  id?: string | undefined;
  slug: string;
  title: string;
  description: string;
  cover_image: string | null;
};

export async function saveSeries(input: SaveSeriesInput): Promise<AdminSeries> {
  const db = await admin();
  const title = input.title.trim();
  if (!title) throw new HttpError(400, "A title is required.");
  const slug = slugify(input.slug || title, 100);
  if (!isValidSlug(slug))
    throw new HttpError(400, "The slug may only contain lowercase letters, numbers and hyphens.");
  const row = {
    slug,
    title,
    description: input.description.trim().slice(0, 600),
    cover_image: input.cover_image ? safeUrl(input.cover_image, { images: true }) : null,
  };

  if (input.id) {
    const res = (await db
      .from("series")
      .update(row)
      .eq("id", input.id)
      .select("*")
      .single()) as Result<AdminSeries>;
    if (res.error) conflict(res.error, "slug");
    invalidateContent();
    return res.data as AdminSeries;
  }
  const res = (await db.from("series").insert(row).select("*").single()) as Result<AdminSeries>;
  if (res.error) conflict(res.error, "slug");
  invalidateContent();
  return res.data as AdminSeries;
}

export async function deleteSeries(id: string): Promise<void> {
  const db = await admin();
  unwrap((await db.from("series").delete().eq("id", id)) as Result<unknown>);
  invalidateContent();
}
