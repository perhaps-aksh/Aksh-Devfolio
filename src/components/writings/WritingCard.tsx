import { Link } from "@tanstack/react-router";

import { formatDateLong } from "@/lib/blog-utils";
import type { WritingSummary } from "@/lib/writings-types";

/** One writing in the index / related / collection listings. More editorial and text-led than BlogCard. */
export function WritingCard({
  writing,
  priority = false,
}: {
  writing: WritingSummary;
  priority?: boolean;
}) {
  return (
    <li className="wr-card-item">
      <article className="wr-card">
        <Link
          to="/writings/$slug"
          params={{ slug: writing.slug }}
          className="wr-card-link"
          preload="intent"
        >
          {writing.cover_image ? (
            <div className="wr-card-media">
              <img
                src={writing.cover_image}
                alt={writing.cover_alt}
                loading={priority ? "eager" : "lazy"}
                decoding="async"
                {...(priority ? { fetchPriority: "high" as const } : {})}
              />
            </div>
          ) : null}
          <div className="wr-card-body">
            <span className="wr-card-type mono">{writing.type}</span>
            <h2 className="wr-card-title">{writing.title}</h2>
            {writing.subtitle ? (
              <p className="wr-card-subtitle">{writing.subtitle}</p>
            ) : writing.excerpt ? (
              <p className="wr-card-subtitle">{writing.excerpt}</p>
            ) : null}
            <span className="wr-card-meta mono">
              {writing.published_at ? formatDateLong(writing.published_at) : "DRAFT"}
              {writing.reading_time ? ` · ${writing.reading_time} MIN` : ""}
              {writing.series ? ` · PART ${writing.series_order ?? "—"}` : ""}
            </span>
          </div>
        </Link>
      </article>
    </li>
  );
}
