import { ChevronRight } from "lucide-react";

import type { Breadcrumb } from "@/lib/writings-types";

/**
 * Breadcrumb targets are built server-side from dynamic collection/chapter/section slugs, so they're
 * plain hrefs rather than TanStack Router's statically-typed `to` paths — a full navigation here (not a
 * client-side transition) is a fine trade-off for an infrequent, non-critical click.
 */
export function Breadcrumbs({ items }: { items: Breadcrumb[] }) {
  if (items.length <= 1) return null;
  return (
    <nav className="wr-crumbs mono" aria-label="Breadcrumb">
      {items.map((item, i) => (
        <span key={item.href + item.label} className="wr-crumb">
          {i === items.length - 1 ? (
            <span aria-current="page">{item.label}</span>
          ) : (
            <a href={item.href}>{item.label}</a>
          )}
          {i < items.length - 1 ? <ChevronRight size={11} aria-hidden="true" /> : null}
        </span>
      ))}
    </nav>
  );
}
