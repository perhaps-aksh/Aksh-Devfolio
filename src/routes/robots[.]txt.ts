import { createFileRoute } from "@tanstack/react-router";

import { config } from "@/server/env.server";

const AGENTS = ["Googlebot", "Bingbot", "Twitterbot", "facebookexternalhit", "*"];

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const origin = config.siteUrl() ?? new URL(request.url).origin;
        const groups = AGENTS.map((agent) => `User-agent: ${agent}\nAllow: /\nDisallow: /admin\nDisallow: /api/`).join("\n\n");
        return new Response(`${groups}\n\nSitemap: ${origin}/sitemap.xml\n`, {
          headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
        });
      },
    },
  },
});
