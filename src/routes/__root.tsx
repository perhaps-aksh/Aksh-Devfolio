import { Analytics } from "@vercel/analytics/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { trackPageView } from "../lib/track";

function NotFoundComponent() {
  return (
    <main className="nf-shell">
      <div className="atmosphere" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <span className="nf-kanji jp" aria-hidden="true">
        迷
      </span>
      <div className="nf-body">
        <span className="mono nf-kicker">AKSH.OS / ERROR</span>
        <h1 className="nf-code">
          404
          <span className="nf-code-ghost" aria-hidden="true">
            404
          </span>
        </h1>
        <p className="mono nf-status">
          <i aria-hidden="true" /> SIGNAL LOST
        </p>
        <p className="nf-copy">
          This page doesn't exist, moved, or never did. Everything else is still standing.
        </p>
        <div className="nf-actions">
          <Link to="/" className="nf-btn is-primary">
            BACK HOME
          </Link>
          <Link to="/blog" className="nf-btn">
            READ THE BLOG
          </Link>
          <Link to="/writings" className="nf-btn">
            BROWSE WRITINGS
          </Link>
        </div>
      </div>
    </main>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Chitraksh Kumar (AKSH) — Creative Developer & Cybersecurity Researcher" },
      {
        name: "description",
        content:
          "Chitraksh Kumar, known online as AKSH — creative developer and cybersecurity researcher.",
      },
      { name: "author", content: "Chitraksh Kumar" },
      { name: "google-site-verification", content: "x2c4VALvLcrXPI-_3DXC-68eEsoRl8Tmuuu0UzLdGbA" },
      {
        property: "og:title",
        content: "Chitraksh Kumar (AKSH) — Creative Developer & Cybersecurity Researcher",
      },
      { property: "og:description", content: "What if, is where I begin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  // Anonymous, cookie-free page-view beacon (sent when the browser is idle; skipped for admin pages and Do-Not-Track).
  useEffect(() => {
    let first = true;
    const send = (path: string) => {
      trackPageView(path, first);
      first = false;
    };
    send(window.location.pathname);
    return router.subscribe("onResolved", ({ toLocation, pathChanged }) => {
      if (pathChanged) send(toLocation.pathname);
    });
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      {/* No-ops unless actually deployed on Vercel. */}
      <Analytics />
    </QueryClientProvider>
  );
}
