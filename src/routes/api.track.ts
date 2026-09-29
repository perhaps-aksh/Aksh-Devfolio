import { createFileRoute } from "@tanstack/react-router";

import { recordPageView } from "@/server/analytics.server";

/** Receives the anonymous page-view beacon (see src/lib/track.ts). */
export const Route = createFileRoute("/api/track")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const fetchSite = request.headers.get("sec-fetch-site");
        if (fetchSite && fetchSite !== "same-origin") return new Response(null, { status: 403 });

        let payload: { p?: unknown; r?: unknown } = {};
        try {
          const text = await request.text();
          if (text.length > 2048) return new Response(null, { status: 413 });
          payload = JSON.parse(text) as { p?: unknown; r?: unknown };
        } catch {
          return new Response(null, { status: 400 });
        }

        const headers = request.headers;
        try {
          await recordPageView(
            { path: payload.p, referrer: payload.r },
            {
              ip:
                headers.get("cf-connecting-ip") ??
                headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
                "unknown",
              userAgent: headers.get("user-agent") ?? "",
              country: headers.get("cf-ipcountry"),
              host: new URL(request.url).hostname,
            },
          );
        } catch (error) {
          console.error("[track]", error);
        }
        return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
      },
    },
  },
});
