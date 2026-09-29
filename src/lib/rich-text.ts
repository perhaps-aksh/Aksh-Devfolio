/**
 * Rich-text documents (TipTap / ProseMirror JSON).
 *
 * Articles are stored as JSON, never as HTML. Two pure functions do all the work and have no
 * dependencies, so they run on the server (Cloudflare Worker) and in the browser alike:
 *
 *  - `sanitizeDoc`  validates a document against an allow-list of nodes, marks and attributes
 *                   (unknown nodes are dropped, URLs are checked, sizes are capped). It runs on
 *                   every save and again before rendering.
 *  - `renderDoc`    turns a sanitised document into HTML. Every string is escaped and only
 *                   allow-listed tags are ever produced, so user content cannot inject markup.
 */

/** Attribute values are plain JSON scalars (which also keeps documents serialisable across server functions). */
export type Attr = string | number | boolean | null;
export type PMMark = { type: string; attrs?: Record<string, Attr> };
export type PMNode = {
  type: string;
  attrs?: Record<string, Attr>;
  content?: PMNode[];
  marks?: PMMark[];
  text?: string;
};

export const EMPTY_DOC: PMNode = { type: "doc", content: [] };

const MAX_DEPTH = 12;
const MAX_NODES = 20_000;
const MAX_TEXT = 200_000;

const ALIGNS = new Set(["left", "center", "right", "justify"]);
const INLINE = new Set(["text", "hardBreak"]);
const BLOCKS = new Set([
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "blockquote",
  "codeBlock",
  "horizontalRule",
  "image",
  "table",
]);
const MARKS = new Set(["bold", "italic", "underline", "strike", "code", "link"]);

/** Allowed URL shapes: same-site paths, anchors, http(s), mailto and tel. Everything else (javascript:, data:, …) is rejected. */
export function safeUrl(value: unknown, opts: { images?: boolean } = {}): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  // Reject embedded control characters and whitespace — browsers strip these from a URL before
  // parsing it, which is how "java\tscript:" and similar tricks smuggle a disallowed scheme past a
  // naive check.
  // eslint-disable-next-line no-control-regex -- intentional: rejecting control characters, not a typo.
  if (!url || url.length > 2000 || /[\u0000-\u001f\u007f\s]/.test(url)) return null;
  if (url.startsWith("/")) return url.startsWith("//") ? null : url;
  if (!opts.images && url.startsWith("#")) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") return url;
    if (!opts.images && (parsed.protocol === "mailto:" || parsed.protocol === "tel:")) return url;
  } catch {
    /* not an absolute URL */
  }
  return null;
}

type Budget = { nodes: number; text: number };

function cleanText(text: string, budget: Budget): string {
  const room = Math.max(0, MAX_TEXT - budget.text);
  const out = text.length > room ? text.slice(0, room) : text;
  budget.text += out.length;
  return out;
}

function cleanMarks(marks: unknown): PMMark[] | undefined {
  if (!Array.isArray(marks)) return undefined;
  const out: PMMark[] = [];
  for (const mark of marks) {
    if (!mark || typeof mark !== "object") continue;
    const type = (mark as PMMark).type;
    if (typeof type !== "string" || !MARKS.has(type)) continue;
    if (type === "link") {
      const href = safeUrl((mark as PMMark).attrs?.["href"]);
      if (href) out.push({ type, attrs: { href } });
      continue;
    }
    if (!out.some((m) => m.type === type)) out.push({ type });
  }
  return out.length ? out : undefined;
}

function cleanInline(nodes: unknown, budget: Budget): PMNode[] {
  if (!Array.isArray(nodes)) return [];
  const out: PMNode[] = [];
  for (const raw of nodes) {
    if (!raw || typeof raw !== "object" || ++budget.nodes > MAX_NODES) continue;
    const node = raw as PMNode;
    if (!INLINE.has(node.type)) continue;
    if (node.type === "hardBreak") {
      out.push({ type: "hardBreak" });
    } else if (typeof node.text === "string" && node.text.length > 0) {
      const text = cleanText(node.text, budget);
      if (!text) continue;
      const marks = cleanMarks(node.marks);
      out.push(marks ? { type: "text", text, marks } : { type: "text", text });
    }
  }
  return out;
}

function align(attrs: Record<string, Attr> | undefined): Record<string, Attr> | undefined {
  const value = attrs?.["textAlign"];
  return typeof value === "string" && ALIGNS.has(value) && value !== "left"
    ? { textAlign: value }
    : undefined;
}

function int(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.trunc(n))) : fallback;
}

function cleanBlocks(
  nodes: unknown,
  depth: number,
  budget: Budget,
  allowed: Set<string> = BLOCKS,
): PMNode[] {
  if (!Array.isArray(nodes) || depth > MAX_DEPTH) return [];
  const out: PMNode[] = [];
  for (const raw of nodes) {
    if (!raw || typeof raw !== "object" || ++budget.nodes > MAX_NODES) continue;
    const node = raw as PMNode;
    if (!allowed.has(node.type)) continue;
    const cleaned = cleanBlock(node, depth, budget);
    if (cleaned) out.push(cleaned);
  }
  return out;
}

function cleanBlock(node: PMNode, depth: number, budget: Budget): PMNode | null {
  switch (node.type) {
    case "paragraph": {
      const attrs = align(node.attrs);
      const content = cleanInline(node.content, budget);
      return {
        type: "paragraph",
        ...(attrs ? { attrs } : {}),
        ...(content.length ? { content } : {}),
      };
    }
    case "heading": {
      const content = cleanInline(node.content, budget);
      const attrs = { level: int(node.attrs?.["level"], 1, 3, 2), ...align(node.attrs) };
      return { type: "heading", attrs, ...(content.length ? { content } : {}) };
    }
    case "bulletList":
    case "orderedList": {
      const items = (Array.isArray(node.content) ? node.content : [])
        .filter(
          (item) =>
            item &&
            typeof item === "object" &&
            item.type === "listItem" &&
            ++budget.nodes <= MAX_NODES,
        )
        .map((item) => ({
          type: "listItem",
          content: cleanBlocks(item.content, depth + 1, budget),
        }))
        .filter((item) => item.content.length > 0);
      if (!items.length) return null;
      const attrs =
        node.type === "orderedList" ? { start: int(node.attrs?.["start"], 1, 9999, 1) } : undefined;
      return { type: node.type, ...(attrs ? { attrs } : {}), content: items };
    }
    case "blockquote": {
      const content = cleanBlocks(node.content, depth + 1, budget);
      return content.length ? { type: "blockquote", content } : null;
    }
    case "codeBlock": {
      const text = (Array.isArray(node.content) ? node.content : [])
        .map((child) =>
          child && child.type === "text" && typeof child.text === "string" ? child.text : "",
        )
        .join("");
      const language = node.attrs?.["language"];
      const attrs =
        typeof language === "string" && /^[a-z0-9+#._-]{1,20}$/i.test(language)
          ? { language }
          : undefined;
      const value = cleanText(text, budget);
      return {
        type: "codeBlock",
        ...(attrs ? { attrs } : {}),
        ...(value ? { content: [{ type: "text", text: value }] } : {}),
      };
    }
    case "horizontalRule":
      return { type: "horizontalRule" };
    case "image": {
      const src = safeUrl(node.attrs?.["src"], { images: true });
      if (!src) return null;
      const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
      return {
        type: "image",
        attrs: { src, alt: str(node.attrs?.["alt"], 200), title: str(node.attrs?.["title"], 200) },
      };
    }
    case "table": {
      const rows = (Array.isArray(node.content) ? node.content : [])
        .filter(
          (row) =>
            row &&
            typeof row === "object" &&
            row.type === "tableRow" &&
            ++budget.nodes <= MAX_NODES,
        )
        .map((row) => ({
          type: "tableRow",
          content: (Array.isArray(row.content) ? row.content : [])
            .filter(
              (cell) =>
                cell &&
                typeof cell === "object" &&
                (cell.type === "tableCell" || cell.type === "tableHeader") &&
                ++budget.nodes <= MAX_NODES,
            )
            .map((cell) => ({
              type: cell.type,
              attrs: {
                colspan: int(cell.attrs?.["colspan"], 1, 20, 1),
                rowspan: int(cell.attrs?.["rowspan"], 1, 20, 1),
              },
              content: cleanBlocks(
                cell.content,
                depth + 1,
                budget,
                new Set(["paragraph", "bulletList", "orderedList", "image"]),
              ),
            })),
        }))
        .filter((row) => row.content.length > 0);
      return rows.length ? { type: "table", content: rows } : null;
    }
    default:
      return null;
  }
}

/** Validate and clean an arbitrary value into a safe document. Never throws. */
export function sanitizeDoc(input: unknown): PMNode {
  if (!input || typeof input !== "object" || (input as PMNode).type !== "doc")
    return { ...EMPTY_DOC };
  const budget: Budget = { nodes: 0, text: 0 };
  return { type: "doc", content: cleanBlocks((input as PMNode).content, 0, budget) };
}

// ---------------------------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------------------------

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (ch) => ESCAPES[ch] ?? ch);

/** Wrap order, innermost first. */
const MARK_ORDER = ["code", "strike", "underline", "italic", "bold", "link"] as const;

function renderText(node: PMNode): string {
  let html = escapeHtml(node.text ?? "");
  const marks = node.marks ?? [];
  for (const type of MARK_ORDER) {
    const mark = marks.find((m) => m.type === type);
    if (!mark) continue;
    if (type === "bold") html = `<strong>${html}</strong>`;
    else if (type === "italic") html = `<em>${html}</em>`;
    else if (type === "underline") html = `<u>${html}</u>`;
    else if (type === "strike") html = `<s>${html}</s>`;
    else if (type === "code") html = `<code>${html}</code>`;
    else if (type === "link") {
      const href = String(mark.attrs?.["href"] ?? "");
      const external = /^https?:/i.test(href);
      html = `<a href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${html}</a>`;
    }
  }
  return html;
}

const alignClass = (node: PMNode) => {
  const value = node.attrs?.["textAlign"];
  return typeof value === "string" && ALIGNS.has(value) ? ` class="ta-${value}"` : "";
};

function slugId(text: string, used: Map<string, number>): string {
  const base =
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9぀-ヿ一-鿿]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "section";
  const count = used.get(base) ?? 0;
  used.set(base, count + 1);
  return count ? `${base}-${count + 1}` : base;
}

type RenderState = { ids: Map<string, number> };

function renderChildren(nodes: PMNode[] | undefined, state: RenderState): string {
  return (nodes ?? []).map((node) => renderNode(node, state)).join("");
}

function nodeText(node: PMNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return " ";
  return (node.content ?? []).map(nodeText).join("");
}

function renderNode(node: PMNode, state: RenderState): string {
  switch (node.type) {
    case "text":
      return renderText(node);
    case "hardBreak":
      return "<br>";
    case "paragraph":
      return `<p${alignClass(node)}>${renderChildren(node.content, state)}</p>`;
    case "heading": {
      // The article title is the page's <h1>, so editor levels 1–3 render as h2–h4.
      const level = int(node.attrs?.["level"], 1, 3, 2) + 1;
      const id = slugId(nodeText(node), state.ids);
      return `<h${level} id="${escapeHtml(id)}"${alignClass(node)}>${renderChildren(node.content, state)}</h${level}>`;
    }
    case "bulletList":
      return `<ul>${renderChildren(node.content, state)}</ul>`;
    case "orderedList": {
      const start = int(node.attrs?.["start"], 1, 9999, 1);
      return `<ol${start !== 1 ? ` start="${start}"` : ""}>${renderChildren(node.content, state)}</ol>`;
    }
    case "listItem":
      return `<li>${renderChildren(node.content, state)}</li>`;
    case "blockquote":
      return `<blockquote>${renderChildren(node.content, state)}</blockquote>`;
    case "codeBlock": {
      const language = typeof node.attrs?.["language"] === "string" ? node.attrs["language"] : "";
      const code = escapeHtml(nodeText(node));
      return language
        ? `<pre data-lang="${escapeHtml(language)}"><code class="language-${escapeHtml(language)}">${code}</code></pre>`
        : `<pre><code>${code}</code></pre>`;
    }
    case "horizontalRule":
      return "<hr>";
    case "image": {
      const src = escapeHtml(String(node.attrs?.["src"] ?? ""));
      const alt = escapeHtml(String(node.attrs?.["alt"] ?? ""));
      const title = String(node.attrs?.["title"] ?? "");
      const img = `<img src="${src}" alt="${alt}" loading="lazy" decoding="async">`;
      return title
        ? `<figure>${img}<figcaption>${escapeHtml(title)}</figcaption></figure>`
        : `<figure>${img}</figure>`;
    }
    case "table":
      return `<div class="table-wrap"><table><tbody>${renderChildren(node.content, state)}</tbody></table></div>`;
    case "tableRow":
      return `<tr>${renderChildren(node.content, state)}</tr>`;
    case "tableCell":
    case "tableHeader": {
      const tag = node.type === "tableHeader" ? "th" : "td";
      const colspan = int(node.attrs?.["colspan"], 1, 20, 1);
      const rowspan = int(node.attrs?.["rowspan"], 1, 20, 1);
      return `<${tag}${colspan > 1 ? ` colspan="${colspan}"` : ""}${rowspan > 1 ? ` rowspan="${rowspan}"` : ""}>${renderChildren(node.content, state)}</${tag}>`;
    }
    default:
      return "";
  }
}

/** Sanitise then render. The result contains only allow-listed, escaped markup. */
export function renderDoc(input: unknown): string {
  const doc = sanitizeDoc(input);
  return renderChildren(doc.content, { ids: new Map() });
}

export type TocEntry = { id: string; text: string; level: number };

/**
 * Table of contents from a document's headings. Uses the same id-slugging as `renderDoc`'s own
 * heading ids (a fresh dedup map, walked in the same top-to-bottom order), so a TOC link's `href`
 * always matches the heading's actual rendered `id` — the two never need to share state.
 */
export function extractToc(input: unknown): TocEntry[] {
  const doc = sanitizeDoc(input);
  const used = new Map<string, number>();
  const entries: TocEntry[] = [];
  const walk = (nodes: PMNode[] | undefined) => {
    for (const node of nodes ?? []) {
      if (node.type === "heading") {
        const text = nodeText(node).trim();
        const id = slugId(text, used);
        if (text) entries.push({ id, text, level: int(node.attrs?.["level"], 1, 3, 2) });
      } else {
        walk(node.content);
      }
    }
  };
  walk(doc.content);
  return entries;
}

/** Plain text of a document (used for reading time and excerpts). */
export function docToText(input: unknown): string {
  const doc = sanitizeDoc(input);
  const parts: string[] = [];
  const walk = (node: PMNode) => {
    if (node.type === "text") parts.push(node.text ?? "");
    else if (node.type === "hardBreak") parts.push(" ");
    else {
      (node.content ?? []).forEach(walk);
      if (BLOCKS.has(node.type) || node.type === "listItem" || node.type === "tableRow")
        parts.push(" ");
    }
  };
  (doc.content ?? []).forEach(walk);
  return parts.join("").replace(/\s+/g, " ").trim();
}

export function readingTime(input: unknown): number {
  const words = docToText(input).split(/\s+/).filter(Boolean).length;
  return words === 0 ? 1 : Math.max(1, Math.ceil(words / 200));
}

export function isEmptyDoc(input: unknown): boolean {
  return (
    docToText(input).length === 0 &&
    !JSON.stringify(sanitizeDoc(input).content ?? []).includes('"image"')
  );
}

/** Build a document from simple text sections (used for the built-in placeholder articles). */
export function docFromSections(
  sections: readonly { heading: string; body: readonly string[] }[],
): PMNode {
  const content: PMNode[] = [];
  for (const section of sections) {
    content.push({
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: section.heading }],
    });
    for (const paragraph of section.body) {
      content.push({ type: "paragraph", content: [{ type: "text", text: paragraph }] });
    }
  }
  return { type: "doc", content };
}
