import { PostgrestClient } from "@supabase/postgrest-js";
import { StorageClient } from "@supabase/storage-js";

import { config, isServiceKeyConfigured, isSupabaseConfigured } from "./env.server";

/**
 * Supabase access, server side only.
 *  - `publicDb()` uses the anon key, so Row Level Security applies (published content only).
 *  - `adminDb()` / `adminStorage()` use the service-role key and must only be called after the admin
 *    session has been verified (see admin-auth.server.ts).
 *
 * Only the PostgREST and Storage clients are used (not the full supabase-js), which keeps the Worker small.
 */
const REQUEST_TIMEOUT_MS = 6000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = PostgrestClient<any, any, any>;

function authHeaders(key: string): Record<string, string> {
  // Legacy keys are JWTs and are sent as a bearer token too; the newer `sb_*` keys go in `apikey` only.
  return key.startsWith("eyJ") ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key };
}

const clients = new Map<string, Db>();

function client(url: string, key: string): Db {
  const id = `${url}|${key}`;
  let existing = clients.get(id);
  if (!existing) {
    existing = new PostgrestClient(`${url}/rest/v1`, {
      headers: authHeaders(key),
      timeout: REQUEST_TIMEOUT_MS,
      retry: false,
    }) as Db;
    clients.set(id, existing);
  }
  return existing;
}

export function publicDb(): Db | null {
  const url = config.supabaseUrl();
  const key = config.supabaseAnonKey();
  return url && key && isSupabaseConfigured() ? client(url, key) : null;
}

export function adminDb(): Db {
  const url = config.supabaseUrl();
  const key = config.supabaseServiceKey();
  if (!url || !key || !isServiceKeyConfigured()) {
    throw new Error("Supabase is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return client(url, key);
}

export function adminStorage(): StorageClient {
  const url = config.supabaseUrl();
  const key = config.supabaseServiceKey();
  if (!url || !key)
    throw new Error("Supabase is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  return new StorageClient(`${url}/storage/v1`, authHeaders(key));
}

export function storagePublicUrl(bucket: string, path: string): string {
  const url = config.supabaseUrl() ?? "";
  return `${url}/storage/v1/object/public/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/** Extracts `<bucket>/<path>` from one of our public storage URLs (used to delete replaced images). */
export function parseStorageUrl(
  publicUrl: string | null | undefined,
): { bucket: string; path: string } | null {
  const base = config.supabaseUrl();
  if (!publicUrl || !base) return null;
  const prefix = `${base}/storage/v1/object/public/`;
  if (!publicUrl.startsWith(prefix)) return null;
  const rest = publicUrl.slice(prefix.length).split("?")[0] ?? "";
  const slash = rest.indexOf("/");
  if (slash < 1) return null;
  try {
    return { bucket: rest.slice(0, slash), path: decodeURIComponent(rest.slice(slash + 1)) };
  } catch {
    return null;
  }
}
