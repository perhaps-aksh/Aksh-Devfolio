import * as React from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Check, Link2 } from "lucide-react";

import { SocialIcon } from "@/components/SocialIcon";
import { BlogCard } from "@/components/blog/BlogCard";
import { categoryKanji, formatDateLong } from "@/lib/blog-utils";
import { getPostFn } from "@/lib/content.functions";
import { externalLinkProps, heroSocials } from "@/lib/socials";
import "@/styles-blog.css";

export const Route = createFileRoute("/blog/$slug")({
  validateSearch: (search: Record<string, unknown>): { preview?: boolean } =>
    search["preview"] === true || search["preview"] === "1" || search["preview"] === 1
      ? { preview: true }
      : {},
  loaderDeps: ({ search }) => ({ preview: Boolean(search.preview) }),
  loader: async ({ params, deps }) => {
    const page = await getPostFn({ data: { slug: params.slug, preview: deps.preview } });
    if (!page) throw notFound();
    return page;
  },
  staleTime: 30_000,
  head: ({ loaderData }) => {
    if (!loaderData)
      return {
        meta: [{ title: "Article not found — AKSH" }, { name: "robots", content: "noindex" }],
      };
    const { post, siteUrl, preview } = loaderData;
    const url = `${siteUrl}/blog/${post.slug}`;
    const description = post.excerpt || `${post.title} — an article by ${post.author_name}.`;
    const image = post.cover_image
      ? post.cover_image.startsWith("/")
        ? `${siteUrl}${post.cover_image}`
        : post.cover_image
      : null;
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description,
      datePublished: post.published_at ?? undefined,
      dateModified: post.updated_at,
      author: { "@type": "Person", name: post.author_name },
      mainEntityOfPage: url,
      ...(image ? { image } : {}),
      keywords: post.tags.join(", ") || undefined,
    };
    return {
      meta: [
        { title: `${post.title} — AKSH` },
        { name: "description", content: description },
        ...(preview ? [{ name: "robots", content: "noindex, nofollow" }] : []),
        { property: "og:title", content: post.title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { property: "og:site_name", content: "AKSH" },
        ...(post.published_at
          ? [{ property: "article:published_time", content: post.published_at }]
          : []),
        { property: "article:modified_time", content: post.updated_at },
        { property: "article:section", content: post.category },
        ...post.tags.map((tag) => ({ property: "article:tag", content: tag })),
        ...(image ? [{ property: "og:image", content: image }] : []),
        { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
        { name: "twitter:title", content: post.title },
        { name: "twitter:description", content: description },
        ...(image ? [{ name: "twitter:image", content: image }] : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(jsonLd).replace(/</g, "\\u003c") },
      ],
    };
  },
  notFoundComponent: ArticleNotFound,
  errorComponent: ArticleError,
  component: ArticlePage,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="article-shell blog-shell">
      <div className="atmosphere" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <div className="article-topbar">
        <Link to="/blog" className="article-back mono">
          <ArrowLeft size={14} strokeWidth={1.5} /> ALL ARTICLES
        </Link>
        <span className="mono article-sys">AKSH.OS / BLOG</span>
      </div>
      {children}
    </main>
  );
}

function ArticleNotFound() {
  return (
    <Shell>
      <div className="blog-state">
        <p className="blog-state-title">Article not found.</p>
        <p>It may have been moved, unpublished, or the link is mistyped.</p>
        <Link to="/blog" className="blog-btn mono">
          BROWSE ALL ARTICLES
        </Link>
      </div>
    </Shell>
  );
}

function ArticleError({ reset }: { reset: () => void }) {
  return (
    <Shell>
      <div className="blog-state" role="alert">
        <p className="blog-state-title">This article didn't load.</p>
        <p>Something went wrong on our end. Try again in a moment.</p>
        <button type="button" className="blog-btn mono" onClick={reset}>
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

function ArticlePage() {
  const { post, related, siteUrl, preview } = Route.useLoaderData();
  const url = `${siteUrl}/blog/${post.slug}`;
  const shareText = encodeURIComponent(post.title);
  const shareUrl = encodeURIComponent(url);

  return (
    <Shell>
      {preview ? (
        <p className="blog-preview mono" role="status">
          PREVIEW —{" "}
          {post.status === "published" ? "this post is live" : "this post is not public yet"}
        </p>
      ) : null}

      <article className="article">
        <p className="article-kicker mono">
          BLOG / {post.category} <b className="jp">{categoryKanji(post.category)}</b>
        </p>
        <div className="article-meta mono">
          <span>{post.category}</span>
          {post.published_at ? (
            <time dateTime={post.published_at}>{formatDateLong(post.published_at)}</time>
          ) : (
            <span>DRAFT</span>
          )}
          <span>{post.reading_time} MIN READ</span>
        </div>
        <h1 className="article-title">{post.title}</h1>
        {post.excerpt ? <p className="article-lead">{post.excerpt}</p> : null}

        {post.tags.length ? (
          <ul className="article-tags mono" aria-label="Tags">
            {post.tags.map((tag) => (
              <li key={tag}>
                <Link to="/blog" search={{ tag }}>
                  #{tag}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        {post.cover_image ? (
          <figure className="article-cover">
            <img
              src={post.cover_image}
              alt={post.cover_alt}
              decoding="async"
              fetchPriority="high"
            />
          </figure>
        ) : null}

        <hr className="article-rule" />

        <div className="article-body prose" dangerouslySetInnerHTML={{ __html: post.html }} />

        <footer className="article-foot article-end">
          <div className="author-card">
            <span className="hanko jp" aria-hidden="true">
              暁
            </span>
            <div>
              <p className="author-name">{post.author_name}</p>
              <p className="author-role mono">CREATIVE DEVELOPER × CYBERSECURITY</p>
              <div className="author-links">
                {heroSocials.map(({ id, label, href }) => (
                  <a key={id} href={href} {...externalLinkProps} aria-label={label} title={label}>
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

          <Link to="/blog" className="article-back mono">
            <ArrowLeft size={14} strokeWidth={1.5} /> ALL ARTICLES
          </Link>
        </footer>
      </article>

      {related.length ? (
        <section className="blog-related" aria-labelledby="related-title">
          <h2 id="related-title" className="blog-related-title">
            KEEP READING <b className="jp">続き</b>
          </h2>
          <ul className="blog-grid">
            {related.map((item) => (
              <BlogCard key={item.id} post={item} />
            ))}
          </ul>
        </section>
      ) : null}
    </Shell>
  );
}
