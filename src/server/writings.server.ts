import type {
  Breadcrumb,
  ChapterPage,
  ChapterSummary,
  CollectionPage,
  StructureRef,
  WritingFull,
  WritingList,
  WritingPage,
  WritingSummary,
} from "@/lib/writings-types";
import { safeSearchTerm } from "@/lib/blog-utils";
import { extractToc, renderDoc } from "@/lib/rich-text";

import { isAdminRequest } from "./admin-auth.server";
import { cached } from "./cache.server";
import { siteOrigin } from "./content.server";
import { adminDb, publicDb, type Db } from "./supabase.server";
import {
  chapterRefOf,
  collectionRefOf,
  getStructureMaps,
  refOf,
  type StructureMaps,
} from "./structure.server";

const TTL = 60_000;
const SUMMARY_COLUMNS =
  "id,slug,title,subtitle,excerpt,type,cover_image,cover_alt,tags,author_name,published_at,reading_time,featured,collection_id,chapter_id,section_id,series_id,series_order";

type Result<T> = { data: T | null; error: { message: string } | null; count?: number | null };
function unwrap<T>(result: Result<T>): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}
const nowIso = () => new Date().toISOString();

type WritingRow = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  excerpt: string;
  type: string;
  cover_image: string | null;
  cover_alt: string;
  tags: string[];
  author_name: string;
  published_at: string | null;
  reading_time: number;
  featured: boolean;
  collection_id: string | null;
  chapter_id: string | null;
  section_id: string | null;
  series_id: string | null;
  series_order: number | null;
};

function toSummary(row: WritingRow, maps: StructureMaps): WritingSummary {
  const { collection_id, chapter_id, section_id, series_id, ...rest } = row;
  return {
    ...rest,
    collection: collectionRefOf(maps.collections, collection_id),
    chapter: chapterRefOf(maps.chapters, chapter_id),
    section: refOf(maps.sections, section_id),
    series: refOf(maps.series, series_id),
  };
}

function liveWritings(db: Db, columns: string, count?: "exact") {
  return db
    .from("writings")
    .select(columns, count ? { count } : undefined)
    .eq("status", "published")
    .lte("published_at", nowIso());
}

export type WritingListInput = {
  q?: string | undefined;
  type?: string | undefined;
  section?: string | undefined;
  series?: string | undefined;
  page: number;
  pageSize: number;
};

export async function listWritings(input: WritingListInput): Promise<WritingList> {
  const db = publicDb();
  const page = Math.max(1, input.page);
  const pageSize = Math.min(24, Math.max(1, input.pageSize));
  if (!db) return { items: [], total: 0, page, pageSize, types: [] };

  const q = safeSearchTerm(input.q ?? "");
  try {
    return await cached(
      `writings:${q}|${input.type ?? ""}|${input.section ?? ""}|${input.series ?? ""}|${page}|${pageSize}`,
      TTL,
      async () => {
        const maps = await getStructureMaps();
        const sectionId = input.section
          ? [...maps.sections.values()].find((s) => s.slug === input.section)?.id
          : undefined;
        const seriesId = input.series
          ? [...maps.series.values()].find((s) => s.slug === input.series)?.id
          : undefined;

        let query = liveWritings(db, SUMMARY_COLUMNS, "exact");
        if (input.type) query = query.eq("type", input.type);
        if (sectionId) query = query.eq("section_id", sectionId);
        if (seriesId) query = query.eq("series_id", seriesId);
        if (q) query = query.or(`title.ilike.*${q}*,excerpt.ilike.*${q}*,subtitle.ilike.*${q}*`);
        const from = (page - 1) * pageSize;
        const [list, typesRes] = await Promise.all([
          query
            .order("published_at", { ascending: false })
            .order("id")
            .range(from, from + pageSize - 1),
          cached("writing-types", 5 * 60_000, async () =>
            unwrap<{ type: string }[]>(
              (await liveWritings(db, "type").limit(1000)) as Result<{ type: string }[]>,
            ),
          ),
        ]);
        const rows = unwrap<WritingRow[]>(list as Result<WritingRow[]>);
        return {
          items: rows.map((r) => toSummary(r, maps)),
          total: (list as Result<unknown>).count ?? rows.length,
          page,
          pageSize,
          types: [...new Set(typesRes.map((r) => r.type))].sort(),
        };
      },
    );
  } catch (error) {
    console.error("[writings] list unavailable:", error);
    return { items: [], total: 0, page, pageSize, types: [] };
  }
}

function toFull(
  row: WritingRow & { content: unknown; status: "draft" | "published"; updated_at: string },
  maps: StructureMaps,
): WritingFull {
  const { content, status, updated_at, ...rest } = row;
  return { ...toSummary(rest, maps), html: renderDoc(content), status, updated_at };
}

function rankRelated(current: WritingSummary, pool: WritingSummary[]): WritingSummary[] {
  const score = (w: WritingSummary) =>
    (w.type === current.type ? 2 : 0) +
    (w.section?.id && w.section.id === current.section?.id ? 2 : 0) +
    w.tags.filter((t) => current.tags.includes(t)).length;
  return pool
    .filter((w) => w.id !== current.id)
    .map((w) => ({ w, s: score(w) }))
    .sort((a, b) => b.s - a.s || (b.w.published_at ?? "").localeCompare(a.w.published_at ?? ""))
    .slice(0, 3)
    .map((x) => x.w);
}

function breadcrumbsFor(summary: WritingSummary): Breadcrumb[] {
  const crumbs: Breadcrumb[] = [{ label: "Writings", href: "/writings" }];
  if (summary.collection)
    crumbs.push({
      label: summary.collection.title,
      href: `/writings/collections/${summary.collection.slug}`,
    });
  if (summary.chapter && summary.collection)
    crumbs.push({
      label: summary.chapter.title,
      href: `/writings/collections/${summary.collection.slug}/${summary.chapter.slug}`,
    });
  if (summary.section)
    crumbs.push({
      label: summary.section.title,
      href: `/writings?section=${summary.section.slug}`,
    });
  return crumbs;
}

async function chapterNavFor(db: Db, summary: WritingSummary): Promise<WritingPage["chapterNav"]> {
  if (!summary.chapter || !summary.collection) return null;
  const chapters = unwrap<{ id: string; slug: string; title: string; subtitle: string }[]>(
    (await db
      .from("chapters")
      .select("id,slug,title,subtitle")
      .eq("collection_id", summary.collection.id)
      .order("display_order")) as Result<
      { id: string; slug: string; title: string; subtitle: string }[]
    >,
  );
  const index = chapters.findIndex((c) => c.id === summary.chapter?.id);
  const asRef = (c: (typeof chapters)[number] | undefined): StructureRef | null =>
    c ? { id: c.id, slug: c.slug, title: c.title } : null;
  return {
    collection: summary.collection,
    chapter: summary.chapter,
    prev: asRef(chapters[index - 1]),
    next: asRef(chapters[index + 1]),
  };
}

/** Loads one writing (breadcrumbs, TOC, series/chapter navigation, related). `preview` lets a signed-in admin open a draft. */
export async function getWritingPage(slug: string, preview: boolean): Promise<WritingPage | null> {
  const siteUrl = siteOrigin();

  if (preview && (await isAdminRequest())) {
    try {
      const db = adminDb();
      const row = (await db.from("writings").select("*").eq("slug", slug).maybeSingle()) as Result<
        WritingRow & { content: unknown; status: "draft" | "published"; updated_at: string }
      >;
      if (row.error || !row.data) return null;
      const maps = await getStructureMaps();
      const full = toFull(row.data, maps);
      return {
        writing: full,
        related: [],
        seriesEntries: [],
        chapterNav: await chapterNavFor(db, full),
        breadcrumbs: breadcrumbsFor(full),
        toc: extractToc(row.data.content),
        siteUrl,
        preview: true,
      };
    } catch (error) {
      console.error("[writings] preview failed:", error);
      return null;
    }
  }

  const db = publicDb();
  if (!db) return null;

  try {
    const page = await cached(`writing:${slug}`, TTL, async () => {
      const row = (await liveWritings(db, "*").eq("slug", slug).maybeSingle()) as Result<
        WritingRow & { content: unknown; status: "draft" | "published"; updated_at: string }
      >;
      if (row.error) throw new Error(row.error.message);
      if (!row.data) return null;
      const maps = await getStructureMaps();
      const full = toFull(row.data, maps);

      const [pool, seriesEntries, chapterNav] = await Promise.all([
        unwrap<WritingRow[]>(
          (await liveWritings(db, SUMMARY_COLUMNS)
            .neq("id", full.id)
            .order("published_at", { ascending: false })
            .limit(20)) as Result<WritingRow[]>,
        ),
        full.series
          ? unwrap<WritingRow[]>(
              (await liveWritings(db, SUMMARY_COLUMNS)
                .eq("series_id", full.series.id)
                .order("series_order", { ascending: true })
                .order("published_at", { ascending: true })) as Result<WritingRow[]>,
            )
          : Promise.resolve([]),
        chapterNavFor(db, full),
      ]);
      const poolSummaries = pool.map((r) => toSummary(r, maps));
      return {
        writing: full,
        related: rankRelated(full, poolSummaries),
        seriesEntries: seriesEntries.map((r) => toSummary(r, maps)),
        chapterNav,
        breadcrumbs: breadcrumbsFor(full),
        toc: extractToc(row.data.content),
      };
    });
    return page ? { ...page, siteUrl, preview: false } : null;
  } catch (error) {
    console.error("[writings] article unavailable:", error);
    return null;
  }
}

export async function getCollectionPage(slug: string): Promise<CollectionPage | null> {
  const db = publicDb();
  if (!db) return null;
  try {
    return await cached(`collection:${slug}`, TTL, async () => {
      const collectionRes = (await db
        .from("collections")
        .select("id,slug,title,description,cover_image")
        .eq("slug", slug)
        .maybeSingle()) as Result<{
        id: string;
        slug: string;
        title: string;
        description: string;
        cover_image: string | null;
      }>;
      if (collectionRes.error) throw new Error(collectionRes.error.message);
      if (!collectionRes.data) return null;
      const collection = collectionRes.data;

      const [chapters, standalone] = await Promise.all([
        unwrap<{ id: string; slug: string; title: string; subtitle: string }[]>(
          (await db
            .from("chapters")
            .select("id,slug,title,subtitle")
            .eq("collection_id", collection.id)
            .order("display_order")) as Result<
            { id: string; slug: string; title: string; subtitle: string }[]
          >,
        ),
        (async () => {
          const maps = await getStructureMaps();
          const rows = unwrap<WritingRow[]>(
            (await liveWritings(db, SUMMARY_COLUMNS)
              .eq("collection_id", collection.id)
              .is("chapter_id", null)
              .order("display_order", { ascending: true })) as Result<WritingRow[]>,
          );
          return rows.map((r) => toSummary(r, maps));
        })(),
      ]);

      const counts = await Promise.all(
        chapters.map((c) => liveWritings(db, "id", "exact").eq("chapter_id", c.id)),
      );
      return {
        collection,
        chapters: chapters.map((c, i) => ({
          ...c,
          entryCount: (counts[i] as Result<unknown>).count ?? 0,
        })),
        standaloneEntries: standalone,
      };
    });
  } catch (error) {
    console.error("[writings] collection unavailable:", error);
    return null;
  }
}

export async function getChapterPage(
  collectionSlug: string,
  chapterSlug: string,
): Promise<ChapterPage | null> {
  const db = publicDb();
  if (!db) return null;
  try {
    return await cached(`chapter:${collectionSlug}/${chapterSlug}`, TTL, async () => {
      const collectionRes = (await db
        .from("collections")
        .select("id,slug,title,description,cover_image")
        .eq("slug", collectionSlug)
        .maybeSingle()) as Result<{
        id: string;
        slug: string;
        title: string;
        description: string;
        cover_image: string | null;
      }>;
      if (collectionRes.error) throw new Error(collectionRes.error.message);
      if (!collectionRes.data) return null;
      const collection = collectionRes.data;

      const chapters = unwrap<ChapterSummary[]>(
        (await db
          .from("chapters")
          .select("id,slug,title,subtitle")
          .eq("collection_id", collection.id)
          .order("display_order")) as Result<ChapterSummary[]>,
      );
      const index = chapters.findIndex((c) => c.slug === chapterSlug);
      if (index < 0) return null;
      const chapter = chapters[index]!;

      const maps = await getStructureMaps();
      const rows = unwrap<WritingRow[]>(
        (await liveWritings(db, SUMMARY_COLUMNS)
          .eq("chapter_id", chapter.id)
          .order("display_order", { ascending: true })
          .order("published_at", { ascending: true })) as Result<WritingRow[]>,
      );
      return {
        collection,
        chapter,
        entries: rows.map((r) => toSummary(r, maps)),
        prev: chapters[index - 1] ?? null,
        next: chapters[index + 1] ?? null,
      };
    });
  } catch (error) {
    console.error("[writings] chapter unavailable:", error);
    return null;
  }
}

/** Slugs + dates for the sitemap. */
export async function listWritingSlugs(): Promise<{ slug: string; updated_at: string | null }[]> {
  const db = publicDb();
  if (!db) return [];
  try {
    return await cached("writing-slugs", 10 * 60_000, async () =>
      unwrap<{ slug: string; updated_at: string | null }[]>(
        (await liveWritings(db, "slug,updated_at")
          .order("published_at", { ascending: false })
          .limit(1000)) as Result<{ slug: string; updated_at: string | null }[]>,
      ),
    );
  } catch (error) {
    console.error("[writings] slugs unavailable:", error);
    return [];
  }
}

export async function listCollectionSlugs(): Promise<{ slug: string; chapterSlugs: string[] }[]> {
  const db = publicDb();
  if (!db) return [];
  try {
    return await cached("collection-slugs", 10 * 60_000, async () => {
      const collections = unwrap<{ id: string; slug: string }[]>(
        (await db.from("collections").select("id,slug")) as Result<{ id: string; slug: string }[]>,
      );
      const chapters = unwrap<{ collection_id: string; slug: string }[]>(
        (await db.from("chapters").select("collection_id,slug")) as Result<
          { collection_id: string; slug: string }[]
        >,
      );
      return collections.map((c) => ({
        slug: c.slug,
        chapterSlugs: chapters.filter((ch) => ch.collection_id === c.id).map((ch) => ch.slug),
      }));
    });
  } catch (error) {
    console.error("[writings] collection slugs unavailable:", error);
    return [];
  }
}
