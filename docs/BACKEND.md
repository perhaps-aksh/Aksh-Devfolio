# Backend setup: Supabase + the admin CMS

This project's blog, projects, contact form and analytics are backed by Supabase. Without it configured,
the public site still works, showing the built-in placeholder posts/projects (`src/lib/posts.ts`,
`src/lib/projects.ts`), and the admin area (`/admin`) shows a setup checklist instead of data.

## 1. Create a Supabase project

Create a project at [supabase.com](https://supabase.com) (the free tier is enough). From
**Settings → API** you'll need:

- **Project URL** → `SUPABASE_URL`
- **`anon` `public` key** → `SUPABASE_ANON_KEY`
- **`service_role` `secret` key** → `SUPABASE_SERVICE_ROLE_KEY` (keep this one truly secret)

## 2. Run the migrations

Open the Supabase dashboard's **SQL Editor** and run these two files **in order** (each one is a single
paste-and-run):

1. [`supabase/migrations/20260927000000_init.sql`](../supabase/migrations/20260927000000_init.sql) creates:
   - Tables: `posts`, `projects`, `contact_submissions`, `page_views`
   - Row Level Security policies (public can only read *published* posts/projects and insert contact
     messages / page views — everything else needs the service-role key)
   - The `admin_dashboard(days)` function the dashboard and analytics pages call
   - Storage buckets `blog-images` and `project-images` (public read, no public write)
2. [`supabase/migrations/20260928000000_writings_and_hierarchy.sql`](../supabase/migrations/20260928000000_writings_and_hierarchy.sql)
   adds (without touching existing posts or projects):
   - `writings`, plus the optional organisation tables `collections`, `chapters`, `sections`, `series`
     and nullable `collection_id` / `chapter_id` / `section_id` / `series_id` / `series_order` columns on
     `posts`
   - `media_assets` (a private catalogue of uploaded files) and a public-read `media` storage bucket
     (25 MB per file; images, PDFs, Office documents, text/CSV and ZIPs)
   - RLS for all of the above (public reads published writings and the organisation tables only) and an
     updated `admin_dashboard(days)`

Both migrations are idempotent — safe to re-run if you ever need to.

If you use the [Supabase CLI](https://supabase.com/docs/guides/cli) instead, `supabase db push` picks up
both files from `supabase/migrations/` in order.

## 3. Set environment variables

Copy [`.env.example`](../.env.example) to `.env` (for `npm run dev`) or `.dev.vars` (for
`npx wrangler dev` / `npm run preview`), and fill in:

```env
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_ID=...
ADMIN_PASSWORD=...          # or ADMIN_PASSWORD_HASH — see below
ADMIN_SESSION_SECRET=...
```

For production (Cloudflare), set the same variables under **Workers & Pages → your project →
Settings → Variables and Secrets**. Mark `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD` /
`ADMIN_PASSWORD_HASH` and `ADMIN_SESSION_SECRET` as **secret**, not plain text.

### Admin password vs. password hash

`ADMIN_PASSWORD` is the simplest option. For a bit more safety (the plain password is never written to
disk anywhere, including your local `.env`), generate a hash instead:

```
npm run admin:hash
```

Set the output as `ADMIN_PASSWORD_HASH` and remove `ADMIN_PASSWORD`. The hash takes precedence when both
are set.

## 4. Deploy and import starter content

After deploying with the environment variables set, sign in at `/admin/login`. The dashboard/blog/
projects pages will show a banner offering to **import starter content** — this copies the built-in
placeholder posts and projects into the database once, so you can edit them from the CMS instead of the
source code. It only runs when the corresponding table is empty.

## How it fits together

- `src/server/env.server.ts` — reads all the environment variables above.
- `src/server/supabase.server.ts` — two Supabase clients: `publicDb()` (anon key, RLS-restricted) and
  `adminDb()` / `adminStorage()` (service-role key, used only after `requireAdmin()` passes).
- `src/server/admin-auth.server.ts` — login, session cookie (signed, HttpOnly, SameSite=Strict, 12h),
  logout, rate-limited login attempts.
- `src/server/content.server.ts` — public reads (published posts/projects), with a short in-memory cache
  and a fallback to the built-in placeholder content if Supabase isn't reachable.
- `src/server/admin-data.server.ts` — all admin CRUD (posts, projects, contact submissions, image
  uploads, dashboard stats). Every function calls `requireAdmin()` itself.
- `src/lib/content.functions.ts` / `src/lib/admin.functions.ts` — the typed server-function boundary the
  UI calls (`createServerFn`). Everything in `admin.functions.ts` except `loginFn` runs behind the
  `adminOnly` middleware.
- `src/lib/rich-text.ts` — sanitises and renders the blog's rich-text (TipTap/ProseMirror) documents. Only
  an allow-listed set of nodes/marks/URLs ever reaches the page; this runs both on save and on render.

## Testing without Supabase

You don't need a real Supabase project to try the admin UI locally — anything server-side that talks to
Supabase goes through `@supabase/postgrest-js` and `@supabase/storage-js` over plain HTTP, so a minimal
mock server works too. That's how this feature was built and tested; ask if you'd like that test harness.
