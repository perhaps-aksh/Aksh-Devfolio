import { Link } from "@tanstack/react-router";

import { categoryKanji, formatDateLong } from "@/lib/blog-utils";
import type { PostSummary } from "@/lib/content-types";

/** One article in the blog grid / related list. */
export function BlogCard({ post, priority = false }: { post: PostSummary; priority?: boolean }) {
  return (
    <li className="blog-card-item">
      <article className="blog-card">
        <Link
          to="/blog/$slug"
          params={{ slug: post.slug }}
          className="blog-card-link"
          preload="intent"
        >
          <div className="blog-card-media">
            {post.cover_image ? (
              <img
                src={post.cover_image}
                alt={post.cover_alt}
                loading={priority ? "eager" : "lazy"}
                decoding="async"
                {...(priority ? { fetchPriority: "high" as const } : {})}
              />
            ) : (
              <span className="blog-card-fallback jp" aria-hidden="true">
                {categoryKanji(post.category)}
              </span>
            )}
          </div>
          <div className="blog-card-body">
            <div className="blog-card-meta mono">
              <span>{post.category}</span>
              <b className="jp">{categoryKanji(post.category)}</b>
              <span>{formatDateLong(post.published_at)}</span>
              <span>{post.reading_time} MIN</span>
              {post.series ? <span>PART {post.series_order ?? "—"}</span> : null}
            </div>
            <h2 className="blog-card-title">{post.title}</h2>
            {post.excerpt ? <p className="blog-card-excerpt">{post.excerpt}</p> : null}
            <span className="blog-card-open mono">
              READ <span aria-hidden="true">↗</span>
            </span>
          </div>
        </Link>
      </article>
    </li>
  );
}
