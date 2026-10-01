import * as React from "react";
import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, Compass, Search, X } from "lucide-react";

import { BlogCard } from "@/components/blog/BlogCard";
import { listPostsFn } from "@/lib/content.functions";
import "@/styles-blog.css";

const PAGE_SIZE = 9;

type BlogSearch = {
  q?: string | undefined;
  category?: string | undefined;
  tag?: string | undefined;
  collection?: string | undefined;
  section?: string | undefined;
  series?: string | undefined;
  page?: number | undefined;
};

const text = (value: unknown, max: number) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;

export const Route = createFileRoute("/blog/")({
  validateSearch: (search: Record<string, unknown>): BlogSearch => {
    const page = Number(search["page"]);
    const out: BlogSearch = {};
    const q = text(search["q"], 80);
    const category = text(search["category"], 40);
    const tag = text(search["tag"], 30);
    const collection = text(search["collection"], 100);
    const section = text(search["section"], 100);
    const series = text(search["series"], 100);
    if (q) out.q = q;
    if (category) out.category = category;
    if (tag) out.tag = tag;
    if (collection) out.collection = collection;
    if (section) out.section = section;
    if (series) out.series = series;
    if (Number.isInteger(page) && page > 1 && page <= 500) out.page = page;
    return out;
  },
  loaderDeps: ({ search }) => ({
    q: search.q,
    category: search.category,
    tag: search.tag,
    collection: search.collection,
    section: search.section,
    series: search.series,
    page: search.page ?? 1,
  }),
  loader: ({ deps }) => listPostsFn({ data: { ...deps, pageSize: PAGE_SIZE } }),
  staleTime: 30_000,
  head: () => ({
    meta: [
      { title: "Thoughts — AKSH" },
      {
        name: "description",
        content:
          "Notes on creative development, security, and the craft of building for the web — writing by AKSH.",
      },
      { property: "og:title", content: "Thoughts — AKSH" },
      {
        property: "og:description",
        content: "Notes on creative development, security, and the craft of building for the web.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  pendingComponent: BlogSkeleton,
  errorComponent: BlogError,
  component: BlogIndex,
});

function BlogShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="article-shell blog-shell">
      <div className="atmosphere" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <div className="article-topbar">
        <Link to="/" hash="blog" className="article-back mono">
          <ArrowLeft size={14} strokeWidth={1.5} /> BACK HOME
        </Link>
        <span className="mono article-sys">AKSH.OS / BLOG</span>
      </div>
      {children}
    </main>
  );
}

function BlogHead() {
  return (
    <header className="blog-head">
      <p className="article-kicker mono">
        BLOG / THOUGHTS <b className="jp">随筆</b>
      </p>
      <h1 className="blog-title">THOUGHTS</h1>
      <p className="blog-sub">
        Notes on creative development, security, and the craft of building for the web.
      </p>
    </header>
  );
}

function BlogSkeleton() {
  return (
    <BlogShell>
      <BlogHead />
      <ul className="blog-grid" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="blog-card-item">
            <div className="blog-card blog-skeleton">
              <div className="blog-card-media" />
              <div className="blog-card-body">
                <span className="sk sk-s" />
                <span className="sk sk-l" />
                <span className="sk sk-m" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </BlogShell>
  );
}

function BlogError({ reset }: { reset: () => void }) {
  return (
    <BlogShell>
      <BlogHead />
      <div className="blog-state" role="alert">
        <p className="blog-state-title">The articles didn't load.</p>
        <p>Something went wrong on our end. Check your connection and try again.</p>
        <button type="button" className="blog-btn mono" onClick={reset}>
          TRY AGAIN
        </button>
      </div>
    </BlogShell>
  );
}

function BlogIndex() {
  const { items, total, page, pageSize, categories, collections, sections, series } =
    Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/blog/" });
  const loading = useRouterState({ select: (s) => s.isLoading });
  const [browseOpen, setBrowseOpen] = React.useState(false);
  const hasStructure = collections.length > 0 || sections.length > 0 || series.length > 0;

  // Debounced search: typing updates the URL (and therefore the list) 300 ms after the last keystroke.
  const [query, setQuery] = React.useState(search.q ?? "");
  React.useEffect(() => setQuery(search.q ?? ""), [search.q]);
  React.useEffect(() => {
    const clean = query.trim();
    if (clean === (search.q ?? "")) return;
    const id = window.setTimeout(() => {
      void navigate({
        search: (prev) => ({ ...prev, q: clean || undefined, page: undefined }),
        replace: true,
        resetScroll: false,
      });
    }, 300);
    return () => window.clearTimeout(id);
  }, [query, search.q, navigate]);

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const filtered = Boolean(
    search.q ||
    search.category ||
    search.tag ||
    search.collection ||
    search.section ||
    search.series,
  );

  return (
    <BlogShell>
      <BlogHead />

      <div className="blog-tools">
        <form className="blog-search" role="search" onSubmit={(e) => e.preventDefault()}>
          <Search size={16} strokeWidth={1.5} aria-hidden="true" />
          <input
            type="search"
            name="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search articles"
            aria-label="Search articles"
            maxLength={80}
            autoComplete="off"
          />
          {query ? (
            <button type="button" aria-label="Clear search" onClick={() => setQuery("")}>
              <X size={14} strokeWidth={1.6} />
            </button>
          ) : null}
        </form>

        {categories.length > 1 ? (
          <div className="blog-chips" role="group" aria-label="Filter by category">
            <Link
              to="/blog"
              search={(prev) => ({ ...prev, category: undefined, page: undefined })}
              className={`blog-chip mono ${!search.category ? "is-on" : ""}`}
              aria-current={!search.category ? "true" : undefined}
            >
              ALL
            </Link>
            {categories.map((category) => (
              <Link
                key={category}
                to="/blog"
                search={(prev) => ({ ...prev, category, page: undefined })}
                className={`blog-chip mono ${search.category === category ? "is-on" : ""}`}
                aria-current={search.category === category ? "true" : undefined}
              >
                {category}
              </Link>
            ))}
          </div>
        ) : null}
        {hasStructure ? (
          <button
            type="button"
            className={`blog-browse-btn mono ${browseOpen ? "is-on" : ""}`}
            aria-expanded={browseOpen}
            aria-controls="blog-browse-panel"
            onClick={() => setBrowseOpen((v) => !v)}
          >
            <Compass size={14} strokeWidth={1.6} /> BROWSE
          </button>
        ) : null}

        {search.tag ? (
          <p className="blog-active-tag mono">
            TAG: #{search.tag}{" "}
            <Link
              to="/blog"
              search={(prev) => ({ ...prev, tag: undefined, page: undefined })}
              aria-label="Clear tag filter"
            >
              <X size={12} strokeWidth={1.6} />
            </Link>
          </p>
        ) : null}
        {search.collection ? (
          <p className="blog-active-tag mono">
            COLLECTION:{" "}
            {collections.find((c) => c.slug === search.collection)?.title ?? search.collection}{" "}
            <Link
              to="/blog"
              search={(prev) => ({ ...prev, collection: undefined, page: undefined })}
              aria-label="Clear collection filter"
            >
              <X size={12} strokeWidth={1.6} />
            </Link>
          </p>
        ) : null}
        {search.section ? (
          <p className="blog-active-tag mono">
            SECTION: {sections.find((s) => s.slug === search.section)?.title ?? search.section}{" "}
            <Link
              to="/blog"
              search={(prev) => ({ ...prev, section: undefined, page: undefined })}
              aria-label="Clear section filter"
            >
              <X size={12} strokeWidth={1.6} />
            </Link>
          </p>
        ) : null}
        {search.series ? (
          <p className="blog-active-tag mono">
            SERIES: {series.find((s) => s.slug === search.series)?.title ?? search.series}{" "}
            <Link
              to="/blog"
              search={(prev) => ({ ...prev, series: undefined, page: undefined })}
              aria-label="Clear series filter"
            >
              <X size={12} strokeWidth={1.6} />
            </Link>
          </p>
        ) : null}
      </div>

      {browseOpen && hasStructure ? (
        <div id="blog-browse-panel" className="blog-browse-panel">
          {collections.length ? (
            <div className="blog-browse-group">
              <span className="blog-browse-label mono">COLLECTIONS</span>
              <div className="blog-chips">
                {collections.map((c) => (
                  <Link
                    key={c.id}
                    to="/blog"
                    search={(prev) => ({ ...prev, collection: c.slug, page: undefined })}
                    className={`blog-chip mono ${search.collection === c.slug ? "is-on" : ""}`}
                    aria-current={search.collection === c.slug ? "true" : undefined}
                  >
                    {c.title}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
          {sections.length ? (
            <div className="blog-browse-group">
              <span className="blog-browse-label mono">SECTIONS</span>
              <div className="blog-chips">
                {sections.map((s) => (
                  <Link
                    key={s.id}
                    to="/blog"
                    search={(prev) => ({ ...prev, section: s.slug, page: undefined })}
                    className={`blog-chip mono ${search.section === s.slug ? "is-on" : ""}`}
                    aria-current={search.section === s.slug ? "true" : undefined}
                  >
                    {s.title}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
          {series.length ? (
            <div className="blog-browse-group">
              <span className="blog-browse-label mono">SERIES</span>
              <div className="blog-chips">
                {series.map((s) => (
                  <Link
                    key={s.id}
                    to="/blog"
                    search={(prev) => ({ ...prev, series: s.slug, page: undefined })}
                    className={`blog-chip mono ${search.series === s.slug ? "is-on" : ""}`}
                    aria-current={search.series === s.slug ? "true" : undefined}
                  >
                    {s.title}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="blog-count mono" role="status" aria-live="polite">
        {total} {total === 1 ? "ARTICLE" : "ARTICLES"}
        {filtered ? " FOUND" : ""}
      </p>

      {items.length === 0 ? (
        <div className="blog-state">
          <p className="blog-state-title">
            {filtered ? "Nothing matches that search." : "New writing is on the way."}
          </p>
          <p>
            {filtered
              ? "Try a different word or clear the filters."
              : "Check back soon — the first articles are being written."}
          </p>
          {filtered ? (
            <Link to="/blog" className="blog-btn mono">
              CLEAR FILTERS
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className={`blog-grid ${loading ? "is-loading" : ""}`}>
          {items.map((post, index) => (
            <BlogCard key={post.id} post={post} priority={index < 2 && page === 1} />
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <nav className="blog-pager mono" aria-label="Pagination">
          {page > 1 ? (
            <Link
              to="/blog"
              search={(prev) => ({ ...prev, page: page - 1 > 1 ? page - 1 : undefined })}
              rel="prev"
            >
              ← PREV
            </Link>
          ) : (
            <span aria-hidden="true" />
          )}
          <span>
            PAGE {page} / {pages}
          </span>
          {page < pages ? (
            <Link to="/blog" search={(prev) => ({ ...prev, page: page + 1 })} rel="next">
              NEXT →
            </Link>
          ) : (
            <span aria-hidden="true" />
          )}
        </nav>
      ) : null}
    </BlogShell>
  );
}
