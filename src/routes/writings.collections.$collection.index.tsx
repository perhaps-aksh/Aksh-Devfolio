import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { WritingCard } from "@/components/writings/WritingCard";
import { getCollectionFn } from "@/lib/content.functions";
import "@/styles-writings.css";

export const Route = createFileRoute("/writings/collections/$collection/")({
  loader: async ({ params }) => {
    const page = await getCollectionFn({ data: { slug: params.collection } });
    if (!page) throw notFound();
    return page;
  },
  head: ({ loaderData }) => {
    if (!loaderData)
      return {
        meta: [{ title: "Collection not found — AKSH" }, { name: "robots", content: "noindex" }],
      };
    const { collection } = loaderData;
    return {
      meta: [
        { title: `${collection.title} — AKSH Writings` },
        {
          name: "description",
          content: collection.description || `A collection of writing: ${collection.title}.`,
        },
        { property: "og:title", content: `${collection.title} — AKSH Writings` },
        { property: "og:type", content: "website" },
      ],
    };
  },
  notFoundComponent: () => (
    <main className="article-shell wr-shell">
      <div className="atmosphere" aria-hidden="true" />
      <div className="wr-state">
        <p className="wr-state-title">Collection not found.</p>
        <Link to="/writings" className="wr-btn mono">
          BROWSE ALL WRITINGS
        </Link>
      </div>
    </main>
  ),
  component: CollectionPage,
});

function CollectionPage() {
  const { collection, chapters, standaloneEntries } = Route.useLoaderData();
  return (
    <main className="article-shell wr-shell">
      <div className="atmosphere" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <div className="article-topbar">
        <Link to="/writings" className="article-back mono">
          <ArrowLeft size={14} strokeWidth={1.5} /> ALL WRITINGS
        </Link>
        <span className="mono article-sys">AKSH.OS / WRITINGS</span>
      </div>

      <header className="wr-head">
        <p className="article-kicker mono">
          COLLECTION <b className="jp">全集</b>
        </p>
        <h1 className="wr-title">{collection.title}</h1>
        {collection.description ? <p className="wr-sub">{collection.description}</p> : null}
      </header>

      {chapters.length ? (
        <section className="wr-chapters">
          <h2 className="wr-section-heading mono">CHAPTERS</h2>
          <ol className="wr-chapter-list">
            {chapters.map((chapter, i) => (
              <li key={chapter.id}>
                <a
                  className="wr-chapter-item"
                  href={`/writings/collections/${collection.slug}/${chapter.slug}`}
                >
                  <span className="mono wr-chapter-num">{String(i + 1).padStart(2, "0")}</span>
                  <span className="grow">
                    <span className="wr-chapter-title">{chapter.title}</span>
                    {chapter.subtitle ? (
                      <span className="wr-chapter-subtitle">{chapter.subtitle}</span>
                    ) : null}
                  </span>
                  <span className="mono wr-chapter-count">
                    {chapter.entryCount} {chapter.entryCount === 1 ? "ENTRY" : "ENTRIES"}
                  </span>
                  <ArrowRight size={16} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {standaloneEntries.length ? (
        <section className="wr-related">
          <h2 className="wr-section-heading mono">MORE IN THIS COLLECTION</h2>
          <ul className="wr-grid">
            {standaloneEntries.map((entry) => (
              <WritingCard key={entry.id} writing={entry} />
            ))}
          </ul>
        </section>
      ) : null}

      {chapters.length === 0 && standaloneEntries.length === 0 ? (
        <div className="wr-state">
          <p className="wr-state-title">Nothing published here yet.</p>
        </div>
      ) : null}
    </main>
  );
}
