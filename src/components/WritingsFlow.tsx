import * as React from "react";
import { Link } from "@tanstack/react-router";

import { JpMark } from "@/components/JpMark";
import type { HomeWriting } from "@/lib/content-types";

/** A preview of the Writings section on the home page, right below Thoughts. Same interaction as FlowingBlog. */
export function WritingsFlow({ writings }: { writings: readonly HomeWriting[] }) {
  const [active, setActive] = React.useState<number | null>(null);
  if (writings.length === 0) return null;
  return (
    <section id="writings-glimpse" className="fm section" aria-labelledby="wf-title">
      <JpMark tone="blue">随想</JpMark>
      <header className="fm-head">
        <span className="section-label" data-jp="随想">
          Personal writing
        </span>
        <h2 id="wf-title">WRITINGS</h2>
        <p>
          Poems, thoughts, questions and stories — a quieter room in the same house as the blog.
        </p>
      </header>
      <nav className={`fm-menu ${active !== null ? "has-active" : ""}`} aria-label="Writings">
        {writings.map((writing, index) => (
          <Link
            key={writing.id}
            to="/writings/$slug"
            params={{ slug: writing.slug }}
            className={`fm-item ${active === index ? "is-active" : ""}`}
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse") setActive(index);
            }}
            onPointerLeave={(event) => {
              if (event.pointerType === "mouse") setActive(null);
            }}
            onFocus={(event) => {
              if (event.currentTarget.matches(":focus-visible")) setActive(index);
            }}
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
              <h3>{writing.title}</h3>
              <p className="fm-glimpse" aria-hidden="true">
                <span className="mono">GLIMPSE</span>
                {writing.subtitle || writing.excerpt}
              </p>
            </div>
            <span className="mono fm-meta">{writing.type.toUpperCase()}</span>
            <span className="mono fm-open">READ ↗</span>
          </Link>
        ))}
      </nav>
      <div className="fm-all">
        <Link to="/writings" className="fm-all-link mono">
          ALL WRITINGS <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </section>
  );
}
