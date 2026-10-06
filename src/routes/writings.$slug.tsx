import * as React from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Link2 } from "lucide-react";

import { SocialIcon } from "@/components/SocialIcon";
import { Breadcrumbs } from "@/components/writings/Breadcrumbs";
import { ReadingProgress } from "@/components/writings/ReadingProgress";
import { TableOfContents } from "@/components/writings/TableOfContents";
import { WritingCard } from "@/components/writings/WritingCard";
import { formatDateLong } from "@/lib/blog-utils";
import { getWritingFn } from "@/lib/content.functions";
import { externalLinkProps, heroSocials, profileLinkProps } from "@/lib/socials";
// Reuses the blog article's shared chrome (kicker/meta/tags/cover/footer/author-card/share-row/.prose)
// so the two reading experiences stay visually related; styles-writings.css adds only what's new here.
import "@/styles-blog.css";
import "@/styles-writings.css";

export const Route = createFileRoute("/writings/$slug")({
  validateSearch: (search: Record<string, unknown>): { preview?: boolean } =>
    search["preview"] === true || search["preview"] === "1" || search["preview"] === 1
      ? { preview: true }
      : {},
  loaderDeps: ({ search }) => ({ preview: Boolean(search.preview) }),
  loader: async ({ params, deps }) => {
    const page = await getWritingFn({ data: { slug: params.slug, preview: deps.preview } });
    if (!page) throw notFound();
    return page;
  },
  staleTime: 30_000,
  head: ({ loaderData }) => {
    if (!loaderData)
      return {
        meta: [{ title: "Writing not found — AKSH" }, { name: "robots", content: "noindex" }],
      };
    const { writing, siteUrl, preview } = loaderData;
    const url = `${siteUrl}/writings/${writing.slug}`;
    const description =
      writing.subtitle ||
      writing.excerpt ||
      `${writing.title} — a ${writing.type} by ${writing.author_name}.`;
    const image = writing.cover_image
      ? writing.cover_image.startsWith("/")
        ? `${siteUrl}${writing.cover_image}`
        : writing.cover_image
      : null;
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "CreativeWork",
      headline: writing.title,
      description,
      genre: writing.type,
      datePublished: writing.published_at ?? undefined,
      dateModified: writing.updated_at,
      author: { "@type": "Person", name: writing.author_name },
      mainEntityOfPage: url,
      ...(image ? { image } : {}),
      keywords: writing.tags.join(", ") || undefined,
    };
    return {
      meta: [
        { title: `${writing.title} — AKSH` },
        { name: "description", content: description },
        ...(preview ? [{ name: "robots", content: "noindex, nofollow" }] : []),
        { property: "og:title", content: writing.title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { property: "og:site_name", content: "AKSH" },
        ...(writing.published_at
          ? [{ property: "article:published_time", content: writing.published_at }]
          : []),
        { property: "article:modified_time", content: writing.updated_at },
        { property: "article:section", content: writing.type },
        ...writing.tags.map((tag) => ({ property: "article:tag", content: tag })),
        ...(image ? [{ property: "og:image", content: image }] : []),
        { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
        { name: "twitter:title", content: writing.title },
        { name: "twitter:description", content: description },
        ...(image ? [{ name: "twitter:image", content: image }] : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(jsonLd).replace(/</g, "\\u003c") },
      ],
    };
  },
  notFoundComponent: WritingNotFound,
  errorComponent: WritingError,
  component: WritingPage,
});

function Shell({ children }: { children: React.ReactNode }) {
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
      {children}
    </main>
  );
}

function WritingNotFound() {
  return (
    <Shell>
      <div className="wr-state">
        <p className="wr-state-title">Writing not found.</p>
        <p>It may have been moved, unpublished, or the link is mistyped.</p>
        <Link to="/writings" className="wr-btn mono">
          BROWSE ALL WRITINGS
        </Link>
      </div>
    </Shell>
  );
}

function WritingError({ reset }: { reset: () => void }) {
  return (
    <Shell>
      <div className="wr-state" role="alert">
        <p className="wr-state-title">This writing didn't load.</p>
        <p>Something went wrong on our end. Try again in a moment.</p>
        <button type="button" className="wr-btn mono" onClick={reset}>
          TRY AGAIN
        </button>
      </div>
    </Shell>
  );
}

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      className="share-btn mono"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        } catch {
          window.prompt("Copy this link", url);
        }
      }}
    >
      {copied ? <Check size={14} strokeWidth={1.8} /> : <Link2 size={14} strokeWidth={1.6} />}
      {copied ? "COPIED" : "COPY LINK"}
    </button>
  );
}

function WritingPage() {
  const { writing, related, seriesEntries, chapterNav, breadcrumbs, toc, siteUrl, preview } =
    Route.useLoaderData();
  const url = `${siteUrl}/writings/${writing.slug}`;
  const shareText = encodeURIComponent(writing.title);
  const shareUrl = encodeURIComponent(url);
  const bodyRef = React.useRef<HTMLElement>(null);
  const isPoem = writing.type === "poem";

  return (
    <Shell>
      <ReadingProgress targetRef={bodyRef} />
      {preview ? (
        <p className="wr-preview mono" role="status">
          PREVIEW —{" "}
          {writing.status === "published"
            ? "this writing is live"
            : "this writing is not public yet"}
        </p>
      ) : null}

      <Breadcrumbs items={breadcrumbs} />

      <article ref={bodyRef} className={`wr-article ${isPoem ? "is-poem" : ""}`}>
        <header className="wr-article-head">
          <p className="article-kicker mono">
            WRITINGS / {writing.type} <b className="jp">随想</b>
          </p>
          <div className="article-meta mono">
            {writing.published_at ? (
              <time dateTime={writing.published_at}>{formatDateLong(writing.published_at)}</time>
            ) : (
              <span>DRAFT</span>
            )}
            {writing.reading_time ? <span>{writing.reading_time} MIN READ</span> : null}
            {writing.series ? (
              <span>
                PART {writing.series_order ?? "—"} OF {writing.series.title.toUpperCase()}
              </span>
            ) : null}
          </div>
          <h1 className="wr-article-title">{writing.title}</h1>
          {writing.subtitle ? <p className="wr-article-subtitle">{writing.subtitle}</p> : null}

          {writing.tags.length ? (
            <ul className="article-tags mono" aria-label="Tags">
              {writing.tags.map((tag) => (
                <li key={tag}>
                  <span>#{tag}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {writing.cover_image ? (
            <figure className="article-cover">
              <img
                src={writing.cover_image}
                alt={writing.cover_alt}
                decoding="async"
                fetchPriority="high"
              />
            </figure>
          ) : null}
        </header>

        <div className="wr-layout">
          <TableOfContents items={toc} />
          <div className="wr-body prose" dangerouslySetInnerHTML={{ __html: writing.html }} />
        </div>

        {chapterNav ? (
          <nav className="wr-chapter-nav" aria-label="Chapter navigation">
            {chapterNav.prev ? (
              <a
                className="wr-chapter-link is-prev"
                href={`/writings/collections/${chapterNav.collection.slug}/${chapterNav.prev.slug}`}
              >
                <ArrowLeft size={14} /> <span>{chapterNav.prev.title}</span>
              </a>
            ) : (
              <span />
            )}
            <a
              className="wr-chapter-current mono"
              href={`/writings/collections/${chapterNav.collection.slug}/${chapterNav.chapter.slug}`}
            >
              {chapterNav.chapter.title}
            </a>
            {chapterNav.next ? (
              <a
                className="wr-chapter-link is-next"
                href={`/writings/collections/${chapterNav.collection.slug}/${chapterNav.next.slug}`}
              >
                <span>{chapterNav.next.title}</span> <ArrowRight size={14} />
              </a>
            ) : (
              <span />
            )}
          </nav>
        ) : null}

        <footer className="article-foot article-end">
          <div className="author-card">
            <span className="hanko jp" aria-hidden="true">
              暁
            </span>
            <div>
              <p className="author-name">{writing.author_name}</p>
              <p className="author-role mono">CREATIVE DEVELOPER × CYBERSECURITY</p>
              <div className="author-links">
                {heroSocials.map(({ id, label, href }) => (
                  <a key={id} href={href} {...profileLinkProps} aria-label={label} title={label}>
                    <SocialIcon name={id} size={15} />
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="share-row">
            <span className="mono share-label">SHARE</span>
            <a
              className="share-btn mono"
              href={`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`}
              {...externalLinkProps}
            >
              <SocialIcon name="x" size={13} /> X
            </a>
            <a
              className="share-btn mono"
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`}
              {...externalLinkProps}
            >
              <SocialIcon name="linkedin" size={13} /> LINKEDIN
            </a>
            <CopyLink url={url} />
          </div>

          <Link to="/writings" className="article-back mono">
            <ArrowLeft size={14} strokeWidth={1.5} /> ALL WRITINGS
          </Link>
        </footer>
      </article>

      {seriesEntries.length > 1 ? (
        <section className="wr-related" aria-labelledby="series-title">
          <h2 id="series-title" className="wr-related-title">
            {writing.series?.title.toUpperCase()} <b className="jp">連載</b>
          </h2>
          <ol className="wr-series-list mono">
            {seriesEntries.map((entry, i) => (
              <li key={entry.id} className={entry.id === writing.id ? "is-current" : ""}>
                <span>{String(entry.series_order ?? i + 1).padStart(2, "0")}</span>
                {entry.id === writing.id ? (
                  <span>{entry.title}</span>
                ) : (
                  <Link to="/writings/$slug" params={{ slug: entry.slug }}>
                    {entry.title}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {related.length ? (
        <section className="wr-related" aria-labelledby="related-title">
          <h2 id="related-title" className="wr-related-title">
            KEEP READING <b className="jp">続き</b>
          </h2>
          <ul className="wr-grid">
            {related.map((item) => (
              <WritingCard key={item.id} writing={item} />
            ))}
          </ul>
        </section>
      ) : null}
    </Shell>
  );
}
