import { createFileRoute } from "@tanstack/react-router";

import { config } from "@/server/env.server";
import { listPostSlugs } from "@/server/content.server";
import { listCollectionSlugs, listWritingSlugs } from "@/server/writings.server";

const esc = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = config.siteUrl() ?? new URL(request.url).origin;
        const [posts, writings, collections] = await Promise.all([
          listPostSlugs(),
          listWritingSlugs(),
          listCollectionSlugs(),
        ]);
        const urls = [
          { loc: `${origin}/`, lastmod: null },
          { loc: `${origin}/blog`, lastmod: posts[0]?.updated_at ?? null },
          ...posts.map((p) => ({ loc: `${origin}/blog/${p.slug}`, lastmod: p.updated_at })),
          { loc: `${origin}/writings`, lastmod: writings[0]?.updated_at ?? null },
          ...writings.map((w) => ({ loc: `${origin}/writings/${w.slug}`, lastmod: w.updated_at })),
          ...collections.flatMap((c) => [
            { loc: `${origin}/writings/collections/${c.slug}`, lastmod: null },
            ...c.chapterSlugs.map((chapterSlug) => ({
              loc: `${origin}/writings/collections/${c.slug}/${chapterSlug}`,
              lastmod: null,
            })),
          ]),
        ];
        const xml =
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          urls
            .map(
              (u) =>
                `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${new Date(u.lastmod).toISOString()}</lastmod>` : ""}</url>`,
            )
            .join("\n") +
          `\n</urlset>\n`;
        return new Response(xml, {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=600",
          },
        });
      },
    },
  },
});
