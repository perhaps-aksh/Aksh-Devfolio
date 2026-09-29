import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";

import { AdminShell } from "@/components/admin/AdminShell";
import { isUnauthorized } from "@/components/admin/format";
import { LoadingBlock } from "@/components/admin/ui";
import { getAdminSessionFn } from "@/lib/content.functions";
import "@/styles-admin.css";

/**
 * Layout + guard for every /admin/* page except the login screen.
 * The guard and data loading run on the server (unauthenticated requests get a real redirect); the UI itself renders in the browser only. The real protection is server side:
 * this guard asks the server whether the session cookie is valid, and every admin server function
 * re-checks it before touching data.
 */
export const Route = createFileRoute("/_admin")({
  ssr: "data-only",
  beforeLoad: async ({ location }) => {
    const session = await getAdminSessionFn();
    if (!session.authenticated)
      throw redirect({ to: "/admin/login", search: { redirect: location.href } });
    // Without the service key nothing in the admin can work; send people to the setup checklist.
    if (!session.serviceConfigured && !location.pathname.startsWith("/admin/settings"))
      throw redirect({ to: "/admin/settings" });
    return { backendReady: session.serviceConfigured };
  },
  head: () => ({
    meta: [{ title: "Admin — AKSH" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  pendingComponent: () => (
    <div className="adm">
      <LoadingBlock />
    </div>
  ),
  errorComponent: ({ error, reset }) => (
    <div className="adm adm-login">
      <div className="adm-login-card" role="alert">
        <h1>{isUnauthorized(error) ? "SESSION ENDED" : "SOMETHING BROKE"}</h1>
        <p>
          {isUnauthorized(error)
            ? "Your admin session expired. Sign in again to continue."
            : error instanceof Error
              ? error.message
              : "An unexpected error occurred."}
        </p>
        {isUnauthorized(error) ? (
          <Link to="/admin/login" className="adm-btn">
            Sign in
          </Link>
        ) : (
          <button type="button" className="adm-btn" onClick={reset}>
            Try again
          </button>
        )}
      </div>
    </div>
  ),
  component: () => (
    <AdminShell>
      <Outlet />
    </AdminShell>
  ),
});
