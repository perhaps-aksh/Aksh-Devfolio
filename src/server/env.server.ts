/**
 * Server-only configuration. Values come from the deployment environment
 * (Cloudflare "Variables and Secrets", `.dev.vars` for `wrangler dev`, `.env` for `vite dev`).
 * Nothing here is ever sent to the browser.
 */
export function env(name: string): string | undefined {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export const config = {
  supabaseUrl: () => env("SUPABASE_URL")?.replace(/\/+$/, ""),
  /** Public "anon" / publishable key: read published content, insert contact messages and page views (RLS-restricted). */
  supabaseAnonKey: () => env("SUPABASE_ANON_KEY") ?? env("SUPABASE_PUBLISHABLE_KEY"),
  /** Service-role / secret key: bypasses RLS. Only used after the admin session has been verified. */
  supabaseServiceKey: () => env("SUPABASE_SERVICE_ROLE_KEY") ?? env("SUPABASE_SECRET_KEY"),
  adminId: () => env("ADMIN_ID"),
  adminPassword: () => env("ADMIN_PASSWORD"),
  /** Optional: `pbkdf2-sha256$<iterations>$<salt>$<hash>` from `npm run admin:hash`. Takes precedence over ADMIN_PASSWORD. */
  adminPasswordHash: () => env("ADMIN_PASSWORD_HASH"),
  sessionSecret: () => env("ADMIN_SESSION_SECRET"),
  siteUrl: () => env("SITE_URL")?.replace(/\/+$/, ""),
  /** Base URL of the FormSubmit-compatible relay the contact form emails through. Override only for testing. */
  formsubmitBase: () => env("FORMSUBMIT_BASE")?.replace(/\/+$/, "") ?? "https://formsubmit.co",
};

export const isSupabaseConfigured = () => Boolean(config.supabaseUrl() && config.supabaseAnonKey());
export const isServiceKeyConfigured = () =>
  Boolean(config.supabaseUrl() && config.supabaseServiceKey());
export const isAdminConfigured = () =>
  Boolean(config.adminId() && (config.adminPassword() || config.adminPasswordHash()));
