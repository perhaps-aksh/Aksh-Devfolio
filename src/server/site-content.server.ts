import {
  type FieldDef,
  isServiceKind,
  type MediaKind,
  PROFILE_FIELDS,
  SECTIONS,
  type SectionDef,
  type SectionKey,
  type SectionRow,
  type SiteContent,
  type SiteProfile,
} from "@/lib/site-content";
import { defaultSiteContent } from "@/lib/site-defaults";

import { HttpError, requireAdmin } from "./admin-auth.server";
import { invalidateContent } from "./cache.server";
import { adminDb, type Db } from "./supabase.server";

/**
 * Editable home-page content. Public reads use the anon key (Row Level Security: published rows only);
 * admin writes use the service-role key after the admin session has been verified.
 */
type Result<T> = {
  data: T | null;
  error: { message: string; code?: string } | null;
  count?: number | null;
};

const chars = (text: string) => Array.from(text).length;

// --- public read -----------------------------------------------------------------------------------------

const publicColumns = (def: SectionDef): string =>
  [
    "id",
    ...def.fields.flatMap((field) => (field.kindKey ? [field.key, field.kindKey] : [field.key])),
  ].join(",");

async function readList<T>(db: Db, key: SectionKey): Promise<T[] | null> {
  const def = SECTIONS[key];
  try {
    const res = (await db
      .from(def.table)
      .select(publicColumns(def))
      .eq("published", true)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true })) as Result<T[]>;
    if (res.error) throw new Error(res.error.message);
    return res.data ?? [];
  } catch (error) {
    console.error(`[site-content] ${def.table} unavailable:`, error);
    return null;
  }
}

/**
 * Loads every editable section. Each one degrades on its own: if a table cannot be read (for example
 * the site-content migration has not been run yet) that section falls back to its built-in default (or
 * to empty) instead of taking the whole page down.
 */
export async function loadSiteContent(db: Db): Promise<SiteContent> {
  const content = defaultSiteContent();
  const [profile, identity, journey, services, achievements, exploring, toolbox, faqs] =
    await Promise.all([
      (async () => {
        try {
          const res = (await db
            .from("site_profile")
            .select(PROFILE_FIELDS.map((f) => f.key).join(","))
            .eq("id", 1)
            .maybeSingle()) as Result<SiteProfile>;
          if (res.error) throw new Error(res.error.message);
          return res.data;
        } catch (error) {
          console.error("[site-content] site_profile unavailable:", error);
          return null;
        }
      })(),
      readList<SiteContent["identity"][number]>(db, "identity"),
      readList<SiteContent["journey"][number]>(db, "journey"),
      readList<SiteContent["services"][number]>(db, "services"),
      readList<SiteContent["achievements"][number]>(db, "achievements"),
      readList<SiteContent["exploring"][number]>(db, "exploring"),
      readList<SiteContent["toolbox"][number]>(db, "toolbox"),
      readList<SiteContent["faqs"][number]>(db, "faq"),
    ]);

  if (profile) content.profile = { ...content.profile, ...profile };
  if (identity) content.identity = identity;
  if (journey) content.journey = journey;
  if (services)
    content.services = services.map((item) => ({
      ...item,
      kind: isServiceKind(item.kind) ? item.kind : "dev",
    }));
  if (achievements) content.achievements = achievements;
  if (exploring) content.exploring = exploring;
  if (toolbox) content.toolbox = toolbox;
  if (faqs) content.faqs = faqs;
  return content;
}

// --- validation ----------------------------------------------------------------------------------------------

function cleanText(field: FieldDef, value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (field.required && !text) throw new HttpError(400, `${field.label} is required.`);
  if (chars(text) > field.max)
    throw new HttpError(400, `${field.label} must be ${field.max} characters or fewer.`);
  return text;
}

function cleanTags(field: FieldDef, value: unknown): string[] {
  const list = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  for (const entry of list) {
    const tag = typeof entry === "string" ? entry.trim() : "";
    if (!tag) continue;
    if (chars(tag) > field.max)
      throw new HttpError(
        400,
        `Each item in ${field.label} must be ${field.max} characters or fewer.`,
      );
    seen.add(tag);
  }
  const tags = [...seen];
  if (field.maxItems && tags.length > field.maxItems)
    throw new HttpError(400, `${field.label} can have at most ${field.maxItems} items.`);
  return tags;
}

function cleanMediaUrl(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  if (text.startsWith("/") && !text.startsWith("//")) return text;
  try {
    const url = new URL(text);
    if (url.protocol === "https:" || url.protocol === "http:") return text;
  } catch {
    /* fall through */
  }
  throw new HttpError(400, "The media link must be a full http(s) URL.");
}

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

function cleanMediaKind(url: string, value: unknown): MediaKind {
  if (value === "image" || value === "video") return value;
  return VIDEO_EXT.test(url) ? "video" : "image";
}

/** Turns untrusted form values into a database row, using only the fields the section declares. */
export function cleanSectionValues(
  def: SectionDef,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const field of def.fields) {
    switch (field.type) {
      case "text":
      case "longtext":
        row[field.key] = cleanText(field, values[field.key]);
        break;
      case "tags":
        row[field.key] = cleanTags(field, values[field.key]);
        break;
      case "select": {
        const chosen = typeof values[field.key] === "string" ? (values[field.key] as string) : "";
        const allowed = field.options?.map((option) => option.value) ?? [];
        row[field.key] = allowed.includes(chosen) ? chosen : (allowed[0] ?? "");
        break;
      }
      case "media": {
        const url = cleanMediaUrl(values[field.key]);
        row[field.key] = url;
        if (field.kindKey)
          row[field.kindKey] = url ? cleanMediaKind(url, values[field.kindKey]) : null;
        break;
      }
    }
  }
  return row;
}

// --- admin CRUD ------------------------------------------------------------------------------------------------

async function admin(): Promise<Db> {
  await requireAdmin();
  return adminDb();
}

function unwrap<T>(result: Result<T>): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

export async function listSectionRows(key: SectionKey): Promise<SectionRow[]> {
  const db = await admin();
  return unwrap<SectionRow[]>(
    (await db
      .from(SECTIONS[key].table)
      .select("*")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true })) as Result<SectionRow[]>,
  );
}

export async function saveSectionRow(
  key: SectionKey,
  input: { id?: string | undefined; values: Record<string, unknown>; published: boolean },
): Promise<SectionRow> {
  const db = await admin();
  const def = SECTIONS[key];
  const row = { ...cleanSectionValues(def, input.values), published: input.published };

  if (input.id) {
    const res = (await db
      .from(def.table)
      .update(row)
      .eq("id", input.id)
      .select("*")
      .single()) as Result<SectionRow>;
    const saved = unwrap(res);
    invalidateContent();
    return saved;
  }

  const last = (await db
    .from(def.table)
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1)) as Result<{ display_order: number }[]>;
  const next = (last.data?.[0]?.display_order ?? 0) + 10;
  const saved = unwrap(
    (await db
      .from(def.table)
      .insert({ ...row, display_order: next })
      .select("*")
      .single()) as Result<SectionRow>,
  );
  invalidateContent();
  return saved;
}

export async function setSectionRowPublished(
  key: SectionKey,
  id: string,
  published: boolean,
): Promise<SectionRow> {
  const db = await admin();
  const saved = unwrap(
    (await db
      .from(SECTIONS[key].table)
      .update({ published })
      .eq("id", id)
      .select("*")
      .single()) as Result<SectionRow>,
  );
  invalidateContent();
  return saved;
}

export async function deleteSectionRow(key: SectionKey, id: string): Promise<void> {
  const db = await admin();
  unwrap((await db.from(SECTIONS[key].table).delete().eq("id", id)) as Result<unknown>);
  invalidateContent();
}

export async function reorderSectionRows(key: SectionKey, ids: string[]): Promise<void> {
  const db = await admin();
  const table = SECTIONS[key].table;
  const results = await Promise.all(
    ids.slice(0, 200).map((id, index) =>
      db
        .from(table)
        .update({ display_order: (index + 1) * 10 })
        .eq("id", id),
    ),
  );
  for (const res of results) if (res.error) throw new Error(res.error.message);
  invalidateContent();
}

// --- profile (single row) -----------------------------------------------------------------------------------

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function getAdminProfile(): Promise<SiteProfile> {
  const db = await admin();
  const res = (await db
    .from("site_profile")
    .select(PROFILE_FIELDS.map((f) => f.key).join(","))
    .eq("id", 1)
    .maybeSingle()) as Result<SiteProfile>;
  const row = unwrap(res);
  return row ?? { ...defaultSiteContent().profile };
}

export async function saveAdminProfile(values: Record<string, unknown>): Promise<SiteProfile> {
  const db = await admin();
  const row: Record<string, unknown> = {};
  for (const field of PROFILE_FIELDS) row[field.key] = cleanText(field, values[field.key]);
  if (!EMAIL.test(row["contact_email"] as string))
    throw new HttpError(400, "Please enter a valid contact email address.");
  const res = (await db
    .from("site_profile")
    .upsert({ id: 1, ...row }, { onConflict: "id" })
    .select(PROFILE_FIELDS.map((f) => f.key).join(","))
    .single()) as Result<SiteProfile>;
  const saved = unwrap(res);
  invalidateContent();
  return saved;
}
