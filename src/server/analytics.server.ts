import { config } from "./env.server";
import { publicDb } from "./supabase.server";
import { rateLimit } from "./rate-limit.server";

/**
 * Privacy-friendly page-view tracking. No cookies, no IP addresses stored:
 * `visitor_id` is a salted hash of (day, IP, user agent) that changes every day, so it can count
 * unique visitors per day but cannot follow a person across days.
 */
const BOT =
  /bot|crawl|spider|slurp|preview|lighthouse|headless|pingdom|uptime|monitor|curl|wget|python-requests|httpclient|axios|node-fetch|go-http|facebookexternalhit|embedly|quora|whatsapp|telegram/i;

export function parseUserAgent(ua: string): {
  device: string;
  browser: string;
  os: string;
  bot: boolean;
} {
  const bot = !ua || BOT.test(ua);
  const device = /ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(ua)
    ? "tablet"
    : /mobi|iphone|ipod|android.*mobile/i.test(ua)
      ? "mobile"
      : "desktop";
  const browser = /edg(e|a|ios)?\//i.test(ua)
    ? "Edge"
    : /opr\/|opera/i.test(ua)
      ? "Opera"
      : /firefox|fxios/i.test(ua)
        ? "Firefox"
        : /chrome|crios/i.test(ua)
          ? "Chrome"
          : /safari/i.test(ua)
            ? "Safari"
            : "Other";
  const os = /windows/i.test(ua)
    ? "Windows"
    : /iphone|ipad|ipod/i.test(ua)
      ? "iOS"
      : /android/i.test(ua)
        ? "Android"
        : /mac os x|macintosh/i.test(ua)
          ? "macOS"
          : /linux|cros/i.test(ua)
            ? "Linux"
            : "Other";
  return { device, browser, os, bot };
}

export function normalizePath(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let path = input.split(/[?#]/)[0] ?? "";
  if (!path.startsWith("/") || path.length > 200 || !/^\/[A-Za-z0-9\-._~/%]*$/.test(path))
    return null;
  if (path.length > 1) path = path.replace(/\/+$/, "");
  if (path === "/admin" || path.startsWith("/admin/") || path.startsWith("/api/")) return null;
  return path || "/";
}

export function referrerHost(input: unknown, ownHost: string): string | null {
  if (typeof input !== "string" || !input) return null;
  try {
    const host = new URL(input).hostname.replace(/^www\./, "").toLowerCase();
    return host && host !== ownHost.replace(/^www\./, "").toLowerCase() ? host.slice(0, 100) : null;
  } catch {
    return null;
  }
}

async function visitorHash(ip: string, ua: string): Promise<string> {
  const day = new Date().toISOString().slice(0, 10);
  const salt =
    process.env["ANALYTICS_SALT"] || config.sessionSecret() || config.supabaseUrl() || "aksh";
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${day}|${salt}|${ip}|${ua}`),
  );
  return [...new Uint8Array(bytes)]
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type TrackInput = { path: unknown; referrer: unknown };

export async function recordPageView(
  input: TrackInput,
  ctx: { ip: string; userAgent: string; country: string | null; host: string },
): Promise<"recorded" | "ignored"> {
  const db = publicDb();
  const path = normalizePath(input.path);
  const ua = parseUserAgent(ctx.userAgent);
  if (!db || !path || ua.bot) return "ignored";

  const visitor = await visitorHash(ctx.ip, ctx.userAgent);
  if (!rateLimit(`view:${visitor}`, 120, 60 * 60_000).ok) return "ignored";

  const country =
    ctx.country && /^[A-Za-z]{2}$/.test(ctx.country) && !/^(xx|t1)$/i.test(ctx.country)
      ? ctx.country.toUpperCase()
      : null;
  const { error } = await db.from("page_views").insert({
    path,
    referrer: referrerHost(input.referrer, ctx.host),
    device: ua.device,
    browser: ua.browser,
    os: ua.os,
    country,
    visitor_id: visitor,
  });
  if (error) {
    console.error("[analytics] insert failed:", error.message);
    return "ignored";
  }
  return "recorded";
}
