import { getRequest } from "@tanstack/react-start/server";

import { safeSearchTerm } from "@/lib/blog-utils";
import type {
  HomeContent,
  HomeWriting,
  PostFull,
  PostList,
  PostPage,
  PostSummary,
  Project,
} from "@/lib/content-types";
import { renderDoc } from "@/lib/rich-text";
import { defaultSiteContent } from "@/lib/site-defaults";

import { isAdminRequest } from "./admin-auth.server";
import { cached } from "./cache.server";
import { config } from "./env.server";
import { loadSiteContent } from "./site-content.server";
import { adminDb, publicDb, type Db } from "./supabase.server";

/**
 * Public content: reads published posts, projects, writings and the editable home-page sections. Uses
 * the anon key (Row Level Security applies) and caches results briefly. There is no built-in sample
 * content: when Supabase is not configured or unreachable the lists are simply empty (the sections
 * that ship with real copy — about, services, toolbox — fall back to their defaults), so the public
 * site never breaks.
 */
const TTL = 60_000;
const SUMMARY_COLUMNS =
  "id,slug,title,excerpt,cover_image,cover_alt,category,tags,author_name,published_at,reading_time";
const HOME_WRITING_COLUMNS = "id,slug,title,subtitle,excerpt,type,published_at";

type Result<T> = { data: T | null; error: { message: string } | null; count?: number | null };

function unwrap<T>(result: Result<T>): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

export function siteOrigin(): string {
  return config.siteUrl() ?? new URL(getRequest().url).origin;
}

// --- mapping -------------------------------------------------------------------------------------

type ProjectRow = {
  slug: string;
  title: string;
  year: string;
  category: string;
  description: string;
  image_url: string | null;
  technologies: string[] | null;
  github_url: string | null;
  live_url: string | null;
  featured: boolean;
};

export function toProject(row: ProjectRow): Project {
  const project: Project = {
    id: row.slug,
    title: row.title,
    year: row.year,
    category: row.category,
    description: row.description,
    image: row.image_url || null,
    technologies: row.technologies ?? [],
    featured: row.featured,
  };
  if (row.github_url) project.githubUrl = row.github_url;
  if (row.live_url) project.liveUrl = row.live_url;
  return project;
}

const nowIso = () => new Date().toISOString();

function livePosts(db: Db, columns: string, count?: "exact") {
  return db
    .from("posts")
    .select(columns, count ? { count } : undefined)
    .eq("status", "published")
    .lte("published_at", nowIso());
}

// --- queries -------------------------------------------------------------------------------------

const emptyHome = (): HomeContent => ({
  projects: [],
  posts: [],
  writings: [],
  site: defaultSiteContent(),
});

/** Latest published writings for the home page. Never throws: the writings tables may not exist yet. */
async function loadHomeWritings(db: Db): Promise<HomeWriting[]> {
  try {
    const res = (await db
      .from("writings")
      .select(HOME_WRITING_COLUMNS)
      .eq("status", "published")
      .lte("published_at", nowIso())
      .order("featured", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(6)) as Result<HomeWriting[]>;
    return unwrap(res);
  } catch (error) {
    console.error("[content] writings unavailable for the home page:", error);
    return [];
  }
}

export async function getHomeContent(): Promise<HomeContent> {
  const db = publicDb();
  if (!db) return emptyHome();
  try {
    return await cached("home", TTL, async () => {
      const [projects, posts, writings, site] = await Promise.all([
        db
          .from("projects")
          .select(
            "slug,title,year,category,description,image_url,technologies,github_url,live_url,featured",
          )
          .eq("published", true)
          .order("display_order", { ascending: true })
          .order("created_at", { ascending: true }),
        livePosts(db, SUMMARY_COLUMNS).order("published_at", { ascending: false }).limit(6),
        loadHomeWritings(db),
        loadSiteContent(db),
      ]);
      return {
        projects: unwrap<ProjectRow[]>(projects as Result<ProjectRow[]>).map(toProject),
        posts: unwrap<PostSummary[]>(posts as Result<PostSummary[]>),
        writings,
        site,
      };
    });
  } catch (error) {
    console.error("[content] home content unavailable:", error);
    return emptyHome();
  }
}

export type ListInput = {
  q?: string | undefined;
  category?: string | undefined;
  tag?: string | undefined;
  page: number;
  pageSize: number;
};

export async function listPosts(input: ListInput): Promise<PostList> {
  const q = safeSearchTerm(input.q ?? "");
  const { category, tag } = input;
  const page = Math.max(1, input.page);
  const pageSize = Math.min(24, Math.max(1, input.pageSize));
  const db = publicDb();

  const empty = (): PostList => ({ items: [], total: 0, page, pageSize, categories: [] });
  if (!db) return empty();

  try {
    return await cached(
      `list:${q}|${category ?? ""}|${tag ?? ""}|${page}|${pageSize}`,
      TTL,
      async () => {
        let query = livePosts(db, SUMMARY_COLUMNS, "exact");
        if (category) query = query.eq("category", category);
        if (tag) query = query.contains("tags", [tag]);
        if (q) query = query.or(`title.ilike.*${q}*,excerpt.ilike.*${q}*`);
        const from = (page - 1) * pageSize;
        const [list, categories] = await Promise.all([
          query
            .order("published_at", { ascending: false })
            .order("id")
            .range(from, from + pageSize - 1),
          listCategories(db),
        ]);
        const rows = unwrap<PostSummary[]>(list as Result<PostSummary[]>);
        return {
          items: rows,
          total: (list as Result<unknown>).count ?? rows.length,
          page,
          pageSize,
          categories,
        };
      },
    );
  } catch (error) {
    console.error("[content] post list unavailable:", error);
    return empty();
  }
}

async function listCategories(db: Db): Promise<string[]> {
  return cached("categories", 5 * 60_000, async () => {
    const rows = unwrap<{ category: string }[]>(
      (await livePosts(db, "category").limit(1000)) as Result<{ category: string }[]>,
    );
    return [...new Set(rows.map((r) => r.category))].sort();
  });
}

type PostRow = PostSummary & {
  content: unknown;
  status: "draft" | "published";
  updated_at: string;
};

function toFull(row: PostRow): PostFull {
  const { content, ...rest } = row;
  return { ...rest, html: renderDoc(content) };
}

function rankRelated(current: PostSummary, candidates: PostSummary[]): PostSummary[] {
  const score = (p: PostSummary) =>
    (p.category === current.category ? 2 : 0) +
    p.tags.filter((t) => current.tags.includes(t)).length;
  return candidates
    .filter((p) => p.id !== current.id)
    .map((p) => ({ p, s: score(p) }))
    .sort((a, b) => b.s - a.s || (b.p.published_at ?? "").localeCompare(a.p.published_at ?? ""))
    .slice(0, 3)
    .map((x) => x.p);
}

/** Loads one article (and related posts). `preview` lets a signed-in admin open a draft or scheduled post. */
export async function getPostPage(slug: string, preview: boolean): Promise<PostPage | null> {
  const siteUrl = siteOrigin();

  if (preview && (await isAdminRequest())) {
    try {
      const db = adminDb();
      const row = (await db
        .from("posts")
        .select("*")
        .eq("slug", slug)
        .maybeSingle()) as Result<PostRow>;
      if (row.error || !row.data) return null;
      return { post: toFull(row.data), related: [], siteUrl, preview: true };
    } catch (error) {
      console.error("[content] preview failed:", error);
      return null;
    }
  }

  const db = publicDb();
  if (!db) return null;

  try {
    const page = await cached(`post:${slug}`, TTL, async () => {
      const row = (await livePosts(db, "*").eq("slug", slug).maybeSingle()) as Result<PostRow>;
      if (row.error) throw new Error(row.error.message);
      if (!row.data) return null;
      const pool = unwrap<PostSummary[]>(
        (await livePosts(db, SUMMARY_COLUMNS)
          .neq("id", row.data.id)
          .order("published_at", { ascending: false })
          .limit(12)) as Result<PostSummary[]>,
      );
      return { post: toFull(row.data), related: rankRelated(row.data, pool) };
    });
    return page ? { ...page, siteUrl, preview: false } : null;
  } catch (error) {
    console.error("[content] article unavailable:", error);
    return null;
  }
}

/** Slugs + dates for the sitemap. */
export async function listPostSlugs(): Promise<{ slug: string; updated_at: string | null }[]> {
  const db = publicDb();
  if (!db) return [];
  try {
    return await cached("slugs", 10 * 60_000, async () =>
      unwrap<{ slug: string; updated_at: string | null }[]>(
        (await livePosts(db, "slug,updated_at")
          .order("published_at", { ascending: false })
          .limit(1000)) as Result<{ slug: string; updated_at: string | null }[]>,
      ),
    );
  } catch (error) {
    console.error("[content] slugs unavailable:", error);
    return [];
  }
}
