import type { TocEntry } from "@/lib/rich-text";

/** Sticky on desktop, a collapsible disclosure on mobile — driven purely by CSS media queries. */
export function TableOfContents({ items }: { items: TocEntry[] }) {
  if (items.length < 2) return null;
  return (
    <nav className="wr-toc" aria-label="Table of contents">
      <details className="wr-toc-mobile">
        <summary className="mono">CONTENTS</summary>
        <TocList items={items} />
      </details>
      <div className="wr-toc-desktop">
        <p className="wr-toc-label mono">CONTENTS</p>
        <TocList items={items} />
      </div>
    </nav>
  );
}

function TocList({ items }: { items: TocEntry[] }) {
  return (
    <ol className="wr-toc-list mono">
      {items.map((item, i) => (
        <li key={item.id} className={`wr-toc-level-${item.level}`}>
          <a href={`#${item.id}`}>
            <span className="wr-toc-num">{String(i + 1).padStart(2, "0")}</span>
            {item.text}
          </a>
        </li>
      ))}
    </ol>
  );
}
