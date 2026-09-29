import * as React from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { CircleAlert, CircleCheck, CircleDashed, LogOut } from "lucide-react";

import { errorMessage } from "@/components/admin/format";
import { useToast } from "@/components/admin/toast";
import { Banner, PageHeader, Panel } from "@/components/admin/ui";
import { getSettingsFn, logoutFn } from "@/lib/admin.functions";

export const Route = createFileRoute("/_admin/admin/settings")({
  loader: () => getSettingsFn(),
  head: () => ({ meta: [{ title: "Settings — AKSH Admin" }] }),
  component: Settings,
});

type Row = { name: string; ok: boolean; optional?: boolean; text: string };

function Settings() {
  const info = Route.useLoaderData();
  const router = useRouter();
  const toast = useToast();
  const [signingOut, setSigningOut] = React.useState(false);

  const rows: Row[] = [
    {
      name: "SUPABASE_URL",
      ok: info.supabaseUrl,
      text: "The project URL, e.g. https://xxxx.supabase.co",
    },
    {
      name: "SUPABASE_ANON_KEY",
      ok: info.anonKey,
      text: "Public key used for published content, the contact form and page views. Protected by Row Level Security.",
    },
    {
      name: "SUPABASE_SERVICE_ROLE_KEY",
      ok: info.serviceKey,
      text: "Secret key used only on the server for this admin area. Never expose it in the browser.",
    },
    { name: "ADMIN_ID", ok: info.adminId, text: "The admin login ID." },
    {
      name: "ADMIN_PASSWORD",
      ok: info.adminPassword || info.passwordHash,
      text: info.passwordHash
        ? "Using ADMIN_PASSWORD_HASH (PBKDF2) — the plain password is not stored."
        : "The admin password. Prefer ADMIN_PASSWORD_HASH so the plain password is never stored (npm run admin:hash).",
    },
    {
      name: "ADMIN_SESSION_SECRET",
      ok: info.sessionSecret,
      optional: true,
      text: "Recommended: a random string of 32+ characters used to sign login sessions. Without it a key is derived from the credentials.",
    },
  ];

  const signOut = async () => {
    setSigningOut(true);
    try {
      await logoutFn();
    } finally {
      await router.navigate({ to: "/admin/login" });
    }
  };

  return (
    <>
      <PageHeader kicker="SYSTEM" jp="設定" title="Settings" />

      {info.connection === "ok" ? (
        <Banner tone="ok">{info.connectionMessage}</Banner>
      ) : info.connection === "error" ? (
        <Banner tone="warn">{info.connectionMessage}</Banner>
      ) : (
        <Banner tone="warn">
          The backend isn't connected yet. Add the environment variables below, run the SQL
          migration in <code>supabase/migrations</code>, and redeploy. Full steps are in{" "}
          <code>docs/BACKEND.md</code>.
        </Banner>
      )}

      <Panel title="Environment" jp="環境" flush>
        <ul className="adm-check-list">
          {rows.map((row) => (
            <li key={row.name}>
              {row.ok ? (
                <CircleCheck size={18} className="ok" aria-label="Set" />
              ) : row.optional ? (
                <CircleDashed size={18} className="opt" aria-label="Optional, not set" />
              ) : (
                <CircleAlert size={18} className="no" aria-label="Missing" />
              )}
              <div>
                <code>{row.name}</code>
                <p>{row.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Connection">
        <p className="adm-hint" style={{ marginBottom: 10 }}>
          Supabase host
        </p>
        <p className="adm-mono" style={{ color: "var(--foreground)", marginBottom: 16 }}>
          {info.supabaseHost ?? "not configured"}
        </p>
        <p className="adm-hint" style={{ marginBottom: 10 }}>
          Site URL (used for canonical links and the sitemap)
        </p>
        <p className="adm-mono" style={{ color: "var(--foreground)" }}>
          {info.siteUrl}
        </p>
        <p className="adm-hint" style={{ marginTop: 14 }}>
          Set <code>SITE_URL</code> to pin this to your public domain.
        </p>
      </Panel>

      <div style={{ marginTop: 20 }}>
        <Panel title="Session">
          <p className="adm-hint" style={{ marginBottom: 14 }}>
            Sessions last 12 hours. Changing <code>ADMIN_PASSWORD</code> (or the ID) in the
            environment signs everyone out.
          </p>
          <button
            type="button"
            className="adm-btn is-danger"
            disabled={signingOut}
            onClick={() => void signOut()}
          >
            <LogOut size={14} /> Sign out
          </button>
        </Panel>
      </div>
    </>
  );
}
