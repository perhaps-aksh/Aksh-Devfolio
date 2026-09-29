import * as React from "react";
import { Link } from "@tanstack/react-router";

import { JpMark } from "@/components/JpMark";
import { categoryKanji, formatDateDots } from "@/lib/blog-utils";
import type { PostSummary } from "@/lib/content-types";

export function FlowingBlog({ posts }: { posts: readonly PostSummary[] }) {
  const [active, setActive] = React.useState<number | null>(null);
  return (
    <section id="blog" className="fm section" aria-labelledby="fm-title">
      <JpMark tone="red">随筆</JpMark>
      <header className="fm-head">
        <span className="section-label" data-jp="随筆">Chapter 09 / Blog / Thoughts</span>
        <h2 id="fm-title">THOUGHTS</h2>
        <p>Notes on creative development, security, and the craft of building for the web.</p>
      </header>
      <nav className={`fm-menu ${active !== null ? "has-active" : ""}`} aria-label="Articles">
        {posts.length === 0 ? <p className="fm-empty mono">NEW WRITING SOON</p> : null}
        {posts.map((post, index) => (
          <Link
            key={post.slug}
            to="/blog/$slug"
            params={{ slug: post.slug }}
            className={`fm-item ${active === index ? "is-active" : ""}`}
            onPointerEnter={(event) => { if (event.pointerType === "mouse") setActive(index); }}
            onPointerLeave={(event) => { if (event.pointerType === "mouse") setActive(null); }}
            onFocus={(event) => { if (event.currentTarget.matches(":focus-visible")) setActive(index); }}
            onBlur={() => setActive(null)}
            onClick={(event) => {
              if (window.matchMedia("(pointer: coarse)").matches && active !== index) {
                event.preventDefault();
                setActive(index);
              }
            }}
          >
            <span className="mono fm-num">{String(index + 1).padStart(2, "0")}</span>
            <div className="fm-title-wrap">
              <h3>{post.title}</h3>
              <p className="fm-glimpse" aria-hidden="true">
                <span className="mono">GLIMPSE</span>
                {post.excerpt}
              </p>
            </div>
            <span className="mono fm-meta">{post.category} <b className="jp">{categoryKanji(post.category)}</b> / {formatDateDots(post.published_at)}</span>
            <span className="mono fm-open">READ ↗</span>
          </Link>
        ))}
      </nav>
      <div className="fm-all">
        <Link to="/blog" className="fm-all-link mono">
          ALL ARTICLES <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </section>
  );
}
