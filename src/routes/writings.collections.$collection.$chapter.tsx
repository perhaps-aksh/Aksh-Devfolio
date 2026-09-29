import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { WritingCard } from "@/components/writings/WritingCard";
import { getChapterFn } from "@/lib/content.functions";
import "@/styles-writings.css";

export const Route = createFileRoute("/writings/collections/$collection/$chapter")({
  loader: async ({ params }) => {
    const page = await getChapterFn({
      data: { collection: params.collection, chapter: params.chapter },
    });
    if (!page) throw notFound();
    return page;
  },
  head: ({ loaderData }) => {
    if (!loaderData)
      return {
        meta: [{ title: "Chapter not found — AKSH" }, { name: "robots", content: "noindex" }],
      };
    const { collection, chapter } = loaderData;
    return {
      meta: [
        { title: `${chapter.title} — ${collection.title} — AKSH Writings` },
        {
          name: "description",
          content: chapter.subtitle || `${chapter.title}, a chapter of ${collection.title}.`,
        },
        { property: "og:title", content: `${chapter.title} — ${collection.title}` },
        { property: "og:type", content: "website" },
      ],
    };
  },
  notFoundComponent: () => (
    <main className="article-shell wr-shell">
      <div className="atmosphere" aria-hidden="true" />
      <div className="wr-state">
        <p className="wr-state-title">Chapter not found.</p>
        <Link to="/writings" className="wr-btn mono">
          BROWSE ALL WRITINGS
        </Link>
      </div>
    </main>
  ),
  component: ChapterPage,
});

function ChapterPage() {
  const { collection, chapter, entries, prev, next } = Route.useLoaderData();
  return (
    <main className="article-shell wr-shell">
      <div className="atmosphere" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <div className="article-topbar">
        <a className="article-back mono" href={`/writings/collections/${collection.slug}`}>
          <ArrowLeft size={14} strokeWidth={1.5} /> {collection.title.toUpperCase()}
        </a>
        <span className="mono article-sys">AKSH.OS / WRITINGS</span>
      </div>

      <nav className="wr-crumbs mono" aria-label="Breadcrumb">
        <span className="wr-crumb">
          <Link to="/writings">Writings</Link>
        </span>
        <span className="wr-crumb">
          <a href={`/writings/collections/${collection.slug}`}>{collection.title}</a>
        </span>
        <span className="wr-crumb">
          <span aria-current="page">{chapter.title}</span>
        </span>
      </nav>

      <header className="wr-head">
        <p className="article-kicker mono">
          CHAPTER <b className="jp">章</b>
        </p>
        <h1 className="wr-title">{chapter.title}</h1>
        {chapter.subtitle ? <p className="wr-sub">{chapter.subtitle}</p> : null}
      </header>

      {entries.length ? (
        <ul className="wr-grid">
          {entries.map((entry) => (
            <WritingCard key={entry.id} writing={entry} />
          ))}
        </ul>
      ) : (
        <div className="wr-state">
          <p className="wr-state-title">Nothing published in this chapter yet.</p>
        </div>
      )}

      <nav className="wr-chapter-nav" aria-label="Chapter navigation">
        {prev ? (
          <a
            className="wr-chapter-link is-prev"
            href={`/writings/collections/${collection.slug}/${prev.slug}`}
          >
            <ArrowLeft size={14} /> <span>{prev.title}</span>
          </a>
        ) : (
          <span />
        )}
        <span className="mono">{collection.title.toUpperCase()}</span>
        {next ? (
          <a
            className="wr-chapter-link is-next"
            href={`/writings/collections/${collection.slug}/${next.slug}`}
          >
            <span>{next.title}</span> <ArrowRight size={14} />
          </a>
        ) : (
          <span />
        )}
      </nav>
    </main>
  );
}
