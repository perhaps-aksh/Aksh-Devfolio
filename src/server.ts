import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

/**
 * Start the app scripts after first paint instead of at HTML parse time.
 *
 * The browser normally fetches the (large) JS bundle in parallel with the render-blocking CSS, which
 * delays first paint on slow connections. Here the entry script and its modulepreload hints are
 * removed from the HTML and re-added by a tiny inline loader once the browser reports its
 * first-contentful-paint (with a timeout fallback for hidden tabs). The page is fully rendered HTML
 * by then, and the intro animation does not depend on hydration having happened yet.
 * Anything unexpected in the markup leaves the response untouched.
 */
async function deferModuleScripts(response: Response): Promise<Response> {
  const type = response.headers.get("content-type") ?? "";
  if (response.status !== 200 || !type.includes("text/html")) return response;
  if (response.headers.get("content-encoding")) return response;

  const html = await response.text();
  const rebuild = (body: string) => {
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    return new Response(body, { status: response.status, statusText: response.statusText, headers });
  };

  const entryTag = /<script type="module" async="" src="([^"]+)"><\/script>(?=<\/body>)/;
  const entry = entryTag.exec(html);
  if (!entry || !entry[1]) return rebuild(html);

  const preloads: string[] = [];
  let out = html.replace(/<link rel="modulepreload" href="([^"]+)"\/>/g, (_match, href: string) => {
    preloads.push(href);
    return "";
  });
  out = out.replace(entryTag, "");

  const loader = `<script>(function(){
var p=${JSON.stringify(preloads)},e=${JSON.stringify(entry[1])},d=0;
function go(){if(d)return;d=1;
for(var i=0;i<p.length;i++){var l=document.createElement("link");l.rel="modulepreload";l.href=p[i];document.head.appendChild(l)}
var s=document.createElement("script");s.type="module";s.async=true;s.src=e;document.body.appendChild(s)}
try{new PerformanceObserver(function(list){for(var x of list.getEntries()){if(x.name==="first-contentful-paint"){go();break}}}).observe({type:"paint",buffered:true})}catch(_){go()}
setTimeout(go,3000)})()</script>`;
  out = out.replace("</body>", () => loader + "</body>");

  return rebuild(out);
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await deferModuleScripts(await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
