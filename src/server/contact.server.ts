import { CONTACT_LIMITS, validateContact, type ContactInput } from "@/lib/contact";
import { DEFAULT_CONTACT_EMAIL } from "@/lib/site-defaults";

import { config } from "./env.server";
import { rateLimit } from "./rate-limit.server";
import { publicDb } from "./supabase.server";

export type ContactResult =
  { ok: true } | { ok: false; message: string; fieldErrors?: Record<string, string> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The address messages are relayed to and shown on the site: the admin-edited contact email, or the built-in default. */
async function resolveContactEmail(): Promise<string> {
  const db = publicDb();
  if (!db) return DEFAULT_CONTACT_EMAIL;
  try {
    const res = await db.from("site_profile").select("contact_email").eq("id", 1).maybeSingle();
    const email = (res.data as { contact_email?: string } | null)?.contact_email?.trim();
    return email && EMAIL_RE.test(email) ? email : DEFAULT_CONTACT_EMAIL;
  } catch {
    return DEFAULT_CONTACT_EMAIL;
  }
}

/** Logs the message in Supabase (RLS: insert only) so it shows up in the admin inbox. */
async function storeInSupabase(input: ContactInput, ctx: { userAgent: string }): Promise<boolean> {
  const db = publicDb();
  if (!db) return false;
  const { error } = await db.from("contact_submissions").insert({
    name: input.name.trim().slice(0, CONTACT_LIMITS.name),
    email: input.email.trim().slice(0, CONTACT_LIMITS.email),
    message: input.message.trim().slice(0, CONTACT_LIMITS.message),
    user_agent: ctx.userAgent.slice(0, 300) || null,
  });
  if (error) console.error("[contact] Supabase insert failed:", error.message);
  return !error;
}

/**
 * Relays the message straight to the owner's inbox via FormSubmit (https://formsubmit.co/ajax/<email>)
 * — no account or API key on either side, just the destination email. The AJAX endpoint returns JSON
 * instead of redirecting, so the page never navigates away. FormSubmit sends a one-time confirmation
 * email the first time a given address is used; later messages deliver straight away.
 */
async function relayByEmail(email: string, input: ContactInput): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${config.formsubmitBase()}/ajax/${encodeURIComponent(email)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        name: input.name.trim().slice(0, CONTACT_LIMITS.name),
        email: input.email.trim().slice(0, CONTACT_LIMITS.email),
        message: input.message.trim().slice(0, CONTACT_LIMITS.message),
        _subject: "New message from your portfolio",
        _template: "table",
        _captcha: "false",
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error("[contact] FormSubmit relay failed:", res.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[contact] FormSubmit relay unreachable:", error);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Handles a public contact form submission. Both delivery paths are best-effort and independent — the
 * message is stored in Supabase (for the admin inbox) and relayed by email in parallel; either one
 * succeeding counts as delivered, so a hiccup in one never loses a message the other got through.
 */
export async function submitContact(
  input: ContactInput & { website?: string | undefined },
  ctx: { ip: string; userAgent: string },
): Promise<ContactResult> {
  // Honeypot: real visitors never fill the hidden field. Pretend success so bots learn nothing.
  if (input.website && input.website.trim()) return { ok: true };

  const errors = validateContact(input);
  if (Object.keys(errors).length) {
    return {
      ok: false,
      message: "Please check the highlighted fields.",
      fieldErrors: errors as Record<string, string>,
    };
  }

  const limit = rateLimit(`contact:${ctx.ip}`, 5, 10 * 60_000);
  if (!limit.ok) {
    return {
      ok: false,
      message: "You have sent several messages in a row. Please try again in a few minutes.",
    };
  }

  const contactEmail = await resolveContactEmail();
  const [stored, emailed] = await Promise.all([
    storeInSupabase(input, ctx),
    relayByEmail(contactEmail, input),
  ]);

  if (!stored && !emailed) {
    return {
      ok: false,
      message: `Something went wrong while sending. Please try again, or email ${contactEmail} directly.`,
    };
  }
  return { ok: true };
}
