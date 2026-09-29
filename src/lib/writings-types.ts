import type { TocEntry } from "@/lib/rich-text";

/** A handful of common types the editor offers as quick picks. The column itself is free text
 * (not an enum), so a new type never needs a migration — see the writings table's `type` column. */
export const WRITING_TYPES = [
  "thought",
  "poem",
  "question",
  "story",
  "essay",
  "reflection",
  "letter",
  "journal",
  "quote",
  "other",
] as const;
export type WritingType = (typeof WRITING_TYPES)[number] | (string & {});

export type StructureRef = { id: string; slug: string; title: string };

export type WritingSummary = {
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
  collection: StructureRef | null;
  chapter: StructureRef | null;
  section: StructureRef | null;
  series: StructureRef | null;
  series_order: number | null;
};

export type WritingFull = WritingSummary & {
  /** Sanitised HTML rendered from the stored document on the server. */
  html: string;
  status: "draft" | "published";
  updated_at: string;
};

export type Breadcrumb = { label: string; href: string };

export type WritingPage = {
  writing: WritingFull;
  related: WritingSummary[];
  /** Other entries in the same series, in order, when the writing belongs to one. */
  seriesEntries: WritingSummary[];
  /** Present only when the writing belongs to a chapter. */
  chapterNav: {
    collection: StructureRef;
    chapter: StructureRef;
    prev: StructureRef | null;
    next: StructureRef | null;
  } | null;
  breadcrumbs: Breadcrumb[];
  toc: TocEntry[];
  siteUrl: string;
  preview: boolean;
};

export type WritingList = {
  items: WritingSummary[];
  total: number;
  page: number;
  pageSize: number;
  types: string[];
};

export type CollectionSummary = {
  id: string;
  slug: string;
  title: string;
  description: string;
  cover_image: string | null;
};
export type ChapterSummary = { id: string; slug: string; title: string; subtitle: string };

export type CollectionPage = {
  collection: CollectionSummary;
  chapters: (ChapterSummary & { entryCount: number })[];
  /** Writings/posts attached to the collection directly, with no chapter. */
  standaloneEntries: WritingSummary[];
};

export type ChapterPage = {
  collection: CollectionSummary;
  chapter: ChapterSummary;
  entries: WritingSummary[];
  prev: ChapterSummary | null;
  next: ChapterSummary | null;
};
