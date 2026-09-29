/** Small pure helpers shared by the public blog, the home page and the admin editor. */

const KANJI: Record<string, string> = {
  PROCESS: "工程",
  SECURITY: "防衛",
  DESIGN: "意匠",
  DEVELOPMENT: "開発",
  ENGINEERING: "技術",
  RESEARCH: "研究",
  NOTES: "覚書",
  LIFE: "日常",
};

/** Japanese accent for a category tag; unknown categories fall back to 随筆 (essay). */
export const categoryKanji = (category: string): string =>
  KANJI[category.trim().toUpperCase()] ?? "随筆";

/** `2026.08` — the compact date style used on the home page list. */
export function formatDateDots(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getUTCFullYear()}.${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** `27 Sep 2026` (UTC, so server and browser render the same text). */
export function formatDateLong(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * `trailing: false` (the default) strips a dangling hyphen, for a final value that will be saved or
 * displayed as-is (e.g. deriving a slug from a title, or normalizing on blur/submit).
 *
 * `trailing: true` keeps one, for a *live* onChange handler on a field the person is actively typing
 * into: stripping the trailing hyphen on every keystroke — before they've had a chance to type the next
 * word — would otherwise eat every hyphen a user types by hand, since the moment right after typing "-"
 * is indistinguishable from "finished typing". The server re-normalizes with `trailing: false` before
 * anything is saved, so this only affects what the input field shows while typing.
 */
export function slugify(input: string, max = 80, opts: { trailing?: boolean } = {}): string {
  const base = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, max);
  return (opts.trailing ? base : base.replace(/-+$/, "")) || "";
}

export const isValidSlug = (slug: string) =>
  slug.length > 0 && slug.length <= 120 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);

export function normalizeTags(input: readonly string[] | string): string[] {
  const list = typeof input === "string" ? input.split(",") : input;
  const seen = new Set<string>();
  for (const raw of list) {
    const tag = raw
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30);
    if (tag) seen.add(tag);
    if (seen.size >= 12) break;
  }
  return [...seen];
}

export function normalizeCategory(input: string): string {
  const value = input
    .replace(/[^\p{L}\p{N} &-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, 40);
  return value || "GENERAL";
}

/** A writing's `type` (poem, thought, question, …) is free text, not an enum — just lightly normalized. */
export function normalizeWritingType(input: string): string {
  const value = input
    .toLowerCase()
    .replace(/[^\p{L}\p{N} -]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
  return value || "thought";
}

/** Remove characters that have a meaning inside a PostgREST filter expression. */
export function safeSearchTerm(input: string): string {
  return input
    .replace(/[^\p{L}\p{N} .'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}
