import type { ChapterSummary, CollectionSummary, StructureRef } from "@/lib/writings-types";

import { cached } from "./cache.server";
import { publicDb, type Db } from "./supabase.server";

/**
 * Collections / chapters / sections / series are a small, rarely-changing taxonomy — not thousands of
 * rows — so rather than relying on PostgREST's embedded-resource joins (`select=*,collection:collections(...)`)
 * this loads the whole set once (short TTL) and joins it in JS. Simpler to reason about and test, and
 * works the same way against the mock Supabase server used for testing.
 */
const TTL = 60_000;

export type StructureMaps = {
  collections: Map<string, CollectionSummary>;
  chapters: Map<string, ChapterSummary & { collection_id: string }>;
  sections: Map<string, StructureRef>;
  series: Map<string, StructureRef>;
};

type Row = Record<string, unknown>;
const asRef = (r: Row): StructureRef => ({
  id: r["id"] as string,
  slug: r["slug"] as string,
  title: r["title"] as string,
});

export async function getStructureMaps(): Promise<StructureMaps> {
  const db = publicDb();
  const empty: StructureMaps = {
    collections: new Map(),
    chapters: new Map(),
    sections: new Map(),
    series: new Map(),
  };
  if (!db) return empty;
  try {
    return await cached("structure-maps", TTL, () => loadStructureMaps(db));
  } catch (error) {
    console.error("[structure] unavailable:", error);
    return empty;
  }
}

export async function loadStructureMaps(db: Db): Promise<StructureMaps> {
  const [collections, chapters, sections, series] = await Promise.all([
    db.from("collections").select("id,slug,title,description,cover_image").order("display_order"),
    db.from("chapters").select("id,collection_id,slug,title,subtitle").order("display_order"),
    db.from("sections").select("id,slug,title").order("display_order"),
    db.from("series").select("id,slug,title").order("title"),
  ]);
  for (const r of [collections, chapters, sections, series])
    if (r.error) throw new Error(r.error.message);
  return {
    collections: new Map(
      ((collections.data ?? []) as Row[]).map((r) => [
        r["id"] as string,
        {
          ...asRef(r),
          description: (r["description"] as string) ?? "",
          cover_image: (r["cover_image"] as string) ?? null,
        },
      ]),
    ),
    chapters: new Map(
      ((chapters.data ?? []) as Row[]).map((r) => [
        r["id"] as string,
        {
          ...asRef(r),
          subtitle: (r["subtitle"] as string) ?? "",
          collection_id: r["collection_id"] as string,
        },
      ]),
    ),
    sections: new Map(((sections.data ?? []) as Row[]).map((r) => [r["id"] as string, asRef(r)])),
    series: new Map(((series.data ?? []) as Row[]).map((r) => [r["id"] as string, asRef(r)])),
  };
}

export function refOf(
  map: Map<string, StructureRef>,
  id: string | null | undefined,
): StructureRef | null {
  if (!id) return null;
  return map.get(id) ?? null;
}

export function collectionRefOf(
  map: StructureMaps["collections"],
  id: string | null | undefined,
): CollectionSummary | null {
  if (!id) return null;
  return map.get(id) ?? null;
}

export function chapterRefOf(
  map: StructureMaps["chapters"],
  id: string | null | undefined,
): ChapterSummary | null {
  if (!id) return null;
  const c = map.get(id);
  return c ? { id: c.id, slug: c.slug, title: c.title, subtitle: c.subtitle } : null;
}
