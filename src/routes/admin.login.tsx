import * as React from "react";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { KeyRound, Loader2 } from "lucide-react";

import { Banner } from "@/components/admin/ui";
import { loginFn } from "@/lib/admin.functions";
import { getAdminSessionFn } from "@/lib/content.functions";
import "@/styles-admin.css";

export const Route = createFileRoute("/admin/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const target = search["redirect"];
    // Only same-site admin paths are accepted as a post-login target (no open redirects).
    return typeof target === "string" && /^\/admin(\/|$)/.test(target) && !target.startsWith("//")
      ? { redirect: target }
      : {};
  },
  beforeLoad: async () => {
    const session = await getAdminSessionFn();
    if (session.authenticated) throw redirect({ to: "/admin/dashboard" });
    return { adminConfigured: session.adminConfigured };
  },
  head: () => ({
    meta: [{ title: "Admin login — AKSH" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { adminConfigured } = Route.useRouteContext();
  const search = Route.useSearch();
  const router = useRouter();
  const [id, setId] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await loginFn({ data: { id: id.trim(), password } });
      if (result.ok) {
        setPassword("");
        await router.invalidate();
        router.history.push(search.redirect ?? "/admin/dashboard");
        return;
      }
      setError(result.message);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    }
    setBusy(false);
  };

  return (
    <div className="adm adm-login">
      <div className="adm-login-card">
        <p className="adm-kicker">
          AKSH.OS / ADMIN<b className="jp">管理</b>
        </p>
        <h1>SIGN IN</h1>
        <p>Private area. Enter the admin ID and password set in the deployment environment.</p>

        {!adminConfigured ? (
          <Banner tone="warn">
            Admin login isn't configured on this server. Set <code>ADMIN_ID</code> and{" "}
            <code>ADMIN_PASSWORD</code> and redeploy.
          </Banner>
        ) : null}

        <form onSubmit={onSubmit} noValidate>
          <div className="adm-field">
            <label className="adm-label" htmlFor="admin-id">
              Admin ID
            </label>
            <input
              id="admin-id"
              className="adm-input"
              type="text"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={id}
              onChange={(e) => setId(e.target.value)}
            />
          </div>
          <div className="adm-field">
            <label className="adm-label" htmlFor="admin-password">
              Password
            </label>
            <input
              id="admin-password"
              className="adm-input"
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "login-error" : undefined}
            />
          </div>
          {error ? (
            <p id="login-error" className="adm-error" role="alert" style={{ marginBottom: 12 }}>
              {error}
            </p>
          ) : null}
          <button type="submit" className="adm-btn" disabled={busy || !id || !password}>
            {busy ? <Loader2 size={15} className="adm-spin" /> : <KeyRound size={15} />}
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
