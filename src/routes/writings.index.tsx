import * as React from "react";
import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, Search, X } from "lucide-react";

import { WritingCard } from "@/components/writings/WritingCard";
import { listWritingsFn } from "@/lib/content.functions";
import "@/styles-writings.css";

const PAGE_SIZE = 9;

type WritingsSearch = {
  q?: string | undefined;
  type?: string | undefined;
  section?: string | undefined;
  series?: string | undefined;
  page?: number | undefined;
};

const text = (value: unknown, max: number) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;

export const Route = createFileRoute("/writings/")({
  validateSearch: (search: Record<string, unknown>): WritingsSearch => {
    const page = Number(search["page"]);
    const out: WritingsSearch = {};
    const q = text(search["q"], 80);
    const type = text(search["type"], 40);
    const section = text(search["section"], 100);
    const series = text(search["series"], 100);
    if (q) out.q = q;
    if (type) out.type = type;
    if (section) out.section = section;
    if (series) out.series = series;
    if (Number.isInteger(page) && page > 1 && page <= 500) out.page = page;
    return out;
  },
  loaderDeps: ({ search }) => ({
    q: search.q,
    type: search.type,
    section: search.section,
    series: search.series,
    page: search.page ?? 1,
  }),
  loader: ({ deps }) => listWritingsFn({ data: { ...deps, pageSize: PAGE_SIZE } }),
  staleTime: 30_000,
  head: () => ({
    meta: [
      { title: "Writings — AKSH" },
      {
        name: "description",
        content: "Poems, thoughts, questions and stories — personal writing by AKSH.",
      },
      { property: "og:title", content: "Writings — AKSH" },
      {
        property: "og:description",
        content: "Poems, thoughts, questions and stories — personal writing by AKSH.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  pendingComponent: WritingsSkeleton,
  errorComponent: WritingsError,
  component: WritingsIndex,
});

function WritingsShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="article-shell wr-shell">
      <div className="atmosphere" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <div className="article-topbar">
        <Link to="/" className="article-back mono">
          <ArrowLeft size={14} strokeWidth={1.5} /> BACK HOME
        </Link>
        <span className="mono article-sys">AKSH.OS / WRITINGS</span>
      </div>
      {children}
    </main>
  );
}

function WritingsHead() {
  return (
    <header className="wr-head">
      <p className="article-kicker mono">
        WRITINGS <b className="jp">随想</b>
      </p>
      <h1 className="wr-title">WRITINGS</h1>
      <p className="wr-sub">
        Poems, thoughts, questions and stories. A quieter room in the same house as the blog.
      </p>
    </header>
  );
}

function WritingsSkeleton() {
  return (
    <WritingsShell>
      <WritingsHead />
      <ul className="wr-grid" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="wr-card-item">
            <div className="wr-card wr-skeleton">
              <div className="wr-card-body">
                <span className="sk sk-s" />
                <span className="sk sk-l" />
                <span className="sk sk-m" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </WritingsShell>
  );
}

function WritingsError({ reset }: { reset: () => void }) {
  return (
    <WritingsShell>
      <WritingsHead />
      <div className="wr-state" role="alert">
        <p className="wr-state-title">The writings didn't load.</p>
        <p>Something went wrong on our end. Check your connection and try again.</p>
        <button type="button" className="wr-btn mono" onClick={reset}>
          TRY AGAIN
        </button>
      </div>
    </WritingsShell>
  );
}

function WritingsIndex() {
  const { items, total, page, pageSize, types } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/writings/" });
  const loading = useRouterState({ select: (s) => s.isLoading });

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
  const filtered = Boolean(search.q || search.type || search.section || search.series);

  return (
    <WritingsShell>
      <WritingsHead />

      <div className="wr-tools">
        <form className="wr-search" role="search" onSubmit={(e) => e.preventDefault()}>
          <Search size={16} strokeWidth={1.5} aria-hidden="true" />
          <input
            type="search"
            name="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search writings"
            aria-label="Search writings"
            maxLength={80}
            autoComplete="off"
          />
          {query ? (
            <button type="button" aria-label="Clear search" onClick={() => setQuery("")}>
              <X size={14} strokeWidth={1.6} />
            </button>
          ) : null}
        </form>

        {types.length > 1 ? (
          <div className="wr-chips" role="group" aria-label="Filter by type">
            <Link
              to="/writings"
              search={(prev) => ({ ...prev, type: undefined, page: undefined })}
              className={`wr-chip mono ${!search.type ? "is-on" : ""}`}
              aria-current={!search.type ? "true" : undefined}
            >
              ALL
            </Link>
            {types.map((type) => (
              <Link
                key={type}
                to="/writings"
                search={(prev) => ({ ...prev, type, page: undefined })}
                className={`wr-chip mono ${search.type === type ? "is-on" : ""}`}
                aria-current={search.type === type ? "true" : undefined}
              >
                {type}
              </Link>
            ))}
          </div>
        ) : null}
        {search.section ? (
          <p className="wr-active-filter mono">
            SECTION: {search.section}{" "}
            <Link
              to="/writings"
              search={(prev) => ({ ...prev, section: undefined, page: undefined })}
              aria-label="Clear section filter"
            >
              <X size={12} strokeWidth={1.6} />
            </Link>
          </p>
        ) : null}
        {search.series ? (
          <p className="wr-active-filter mono">
            SERIES: {search.series}{" "}
            <Link
              to="/writings"
              search={(prev) => ({ ...prev, series: undefined, page: undefined })}
              aria-label="Clear series filter"
            >
              <X size={12} strokeWidth={1.6} />
            </Link>
          </p>
        ) : null}
      </div>

      <p className="wr-count mono" role="status" aria-live="polite">
        {total} {total === 1 ? "WRITING" : "WRITINGS"}
        {filtered ? " FOUND" : ""}
      </p>

      {items.length === 0 ? (
        <div className="wr-state">
          <p className="wr-state-title">
            {filtered ? "Nothing matches that search." : "New writing is on the way."}
          </p>
          <p>{filtered ? "Try a different word or clear the filters." : "Check back soon."}</p>
          {filtered ? (
            <Link to="/writings" className="wr-btn mono">
              CLEAR FILTERS
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className={`wr-grid ${loading ? "is-loading" : ""}`}>
          {items.map((writing, index) => (
            <WritingCard key={writing.id} writing={writing} priority={index < 2 && page === 1} />
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <nav className="wr-pager mono" aria-label="Pagination">
          {page > 1 ? (
            <Link
              to="/writings"
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
            <Link to="/writings" search={(prev) => ({ ...prev, page: page + 1 })} rel="next">
              NEXT →
            </Link>
          ) : (
            <span aria-hidden="true" />
          )}
        </nav>
      ) : null}
    </WritingsShell>
  );
}
