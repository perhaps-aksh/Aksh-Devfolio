import { deleteCookie, getCookie, getRequest, setCookie } from "@tanstack/react-start/server";

import { config, isAdminConfigured } from "./env.server";
import { rateLimit, resetRateLimit } from "./rate-limit.server";

/**
 * Admin authentication — entirely server side.
 *
 *  - The admin ID / password live in the deployment environment (ADMIN_ID, ADMIN_PASSWORD or
 *    ADMIN_PASSWORD_HASH). They are compared here, in constant time, and never leave the server.
 *  - A successful login sets a signed, HttpOnly, SameSite=Strict cookie. The cookie carries only an
 *    expiry; it is HMAC-signed with a key derived from ADMIN_SESSION_SECRET *and* the credentials, so
 *    changing the password in the environment invalidates every existing session.
 *  - Every admin server function calls `requireAdmin()` before touching data.
 */
const COOKIE = "aksh_admin";
const SESSION_SECONDS = 60 * 60 * 12;
const encoder = new TextEncoder();

const b64url = (bytes: ArrayBuffer | Uint8Array): string => {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64url = (value: string): Uint8Array => {
  const padded =
    value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
};

/** Constant-time string comparison (digests are fixed length, so timing does not depend on the content). */
async function safeEqual(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const x = new Uint8Array(da);
  const y = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** `pbkdf2-sha256$<iterations>$<salt b64url>$<hash b64url>` — same format `scripts/hash-password.mjs` writes. */
async function verifyPbkdf2(password: string, stored: string): Promise<boolean> {
  const [scheme, iterations, salt, hash] = stored.split("$");
  const rounds = Number(iterations);
  if (
    scheme !== "pbkdf2-sha256" ||
    !salt ||
    !hash ||
    !Number.isInteger(rounds) ||
    rounds < 1000 ||
    rounds > 100_000
  ) {
    return false;
  }
  const base = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: fromB64url(salt) as BufferSource, iterations: rounds },
    base,
    256,
  );
  return safeEqual(b64url(bits), hash);
}

export async function checkCredentials(id: string, password: string): Promise<boolean> {
  const expectedId = config.adminId();
  const expectedPassword = config.adminPassword();
  const expectedHash = config.adminPasswordHash();
  if (!expectedId || (!expectedPassword && !expectedHash)) return false;
  // Both checks always run so a wrong ID and a wrong password take the same time.
  const [idOk, passwordOk] = await Promise.all([
    safeEqual(id, expectedId),
    expectedHash
      ? verifyPbkdf2(password, expectedHash)
      : safeEqual(password, expectedPassword ?? ""),
  ]);
  return idOk && passwordOk;
}

// --- session token -----------------------------------------------------------------------------------

let keyCache: { id: string; key: Promise<CryptoKey> } | undefined;

function signingKey(): Promise<CryptoKey> {
  const secret = config.sessionSecret();
  const material = `${config.adminId() ?? ""}\n${config.adminPasswordHash() ?? config.adminPassword() ?? ""}`;
  const id = `${secret ?? ""}\n${material}`;
  if (keyCache?.id === id) return keyCache.key;

  const key = (async () => {
    let raw: ArrayBuffer;
    if (secret && secret.length >= 32) {
      const hmacKey = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      raw = await crypto.subtle.sign(
        "HMAC",
        hmacKey,
        encoder.encode(`aksh-admin-session|${material}`),
      );
    } else {
      // No dedicated secret configured: derive one slowly from the credentials (still set ADMIN_SESSION_SECRET).
      const base = await crypto.subtle.importKey("raw", encoder.encode(material), "PBKDF2", false, [
        "deriveBits",
      ]);
      raw = await crypto.subtle.deriveBits(
        {
          name: "PBKDF2",
          hash: "SHA-256",
          salt: encoder.encode("aksh-admin-session"),
          iterations: 100_000,
        },
        base,
        256,
      );
    }
    return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, [
      "sign",
      "verify",
    ]);
  })();
  keyCache = { id, key };
  return key;
}

async function createToken(): Promise<string> {
  const payload = b64url(
    encoder.encode(JSON.stringify({ v: 1, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS })),
  );
  const signature = await crypto.subtle.sign("HMAC", await signingKey(), encoder.encode(payload));
  return `${payload}.${b64url(signature)}`;
}

async function verifyToken(token: string): Promise<boolean> {
  const [payload, signature] = token.split(".");
  if (!payload || !signature || token.length > 400) return false;
  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await signingKey(),
      fromB64url(signature) as BufferSource,
      encoder.encode(payload),
    );
    if (!valid) return false;
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as {
      v?: number;
      exp?: number;
    };
    return data.v === 1 && typeof data.exp === "number" && data.exp > Date.now() / 1000;
  } catch {
    return false;
  }
}

// --- request helpers ---------------------------------------------------------------------------------

export function clientIp(): string {
  const headers = getRequest().headers;
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

const isHttps = () => {
  const request = getRequest();
  return (
    new URL(request.url).protocol === "https:" ||
    request.headers.get("x-forwarded-proto") === "https"
  );
};

export async function isAdminRequest(): Promise<boolean> {
  if (!isAdminConfigured()) return false;
  const token = getCookie(COOKIE);
  return token ? verifyToken(token) : false;
}

export class HttpError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

/** Throws a 401 unless the request carries a valid admin session. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdminRequest())) throw new HttpError(401, "Unauthorized");
}

const MAX_ATTEMPTS = 6;
const WINDOW_MS = 15 * 60 * 1000;

export type LoginResult = { ok: true } | { ok: false; message: string };

export async function login(id: string, password: string): Promise<LoginResult> {
  if (!isAdminConfigured()) {
    return {
      ok: false,
      message: "Admin login is not configured. Set ADMIN_ID and ADMIN_PASSWORD on the server.",
    };
  }
  const key = `login:${clientIp()}`;
  const limit = rateLimit(key, MAX_ATTEMPTS, WINDOW_MS);
  if (!limit.ok) {
    return {
      ok: false,
      message: `Too many attempts. Try again in ${Math.ceil(limit.retryAfter / 60)} minute(s).`,
    };
  }
  if (!(await checkCredentials(id, password))) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { ok: false, message: "Invalid ID or password." };
  }
  resetRateLimit(key);
  setCookie(COOKIE, await createToken(), {
    httpOnly: true,
    secure: isHttps(),
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
  return { ok: true };
}

export function logout(): void {
  deleteCookie(COOKIE, { path: "/" });
}
