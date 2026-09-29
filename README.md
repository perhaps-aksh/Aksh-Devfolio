# AKSH — Portfolio & CMS

A cinematic, editorial portfolio site for AKSH — creative developer and security-minded
builder — with a full content-management system behind it. Every section a visitor sees
(hero copy, journey, services, projects, achievements, toolbox, FAQ, blog, writings) is
editable from a private admin area, backed by Supabase.

Built with [TanStack Start](https://tanstack.com/start), React 19, Vite and Tailwind CSS v4.

## What's here

**Public site**

- A single-page, chapter-driven home page (hero → about → journey → services → projects →
  achievements → toolbox → exploring → blog → writings → FAQ → contact), with a full-screen
  navigation overlay, scroll-linked chapter indicator, and a cinematic intro sequence.
- **Blog** (`/blog`) — long-form articles with categories, tags, search and related posts.
- **Writings** (`/writings`) — a quieter counterpart to the blog for poems, thoughts,
  questions, stories, letters and journal entries. Poems preserve their exact line breaks
  and stanza spacing. Writings can optionally belong to a **collection → chapter**
  (`/writings/collections/:slug[/:chapter]`), a flat **section**, or an ordered **series** —
  any combination, or none; nothing is forced into a rigid structure.
- A contact form that both stores the message (visible in the admin inbox) and relays it by
  email via [FormSubmit](https://formsubmit.co), so messages reach an inbox with no backend
  email service to run.
- Privacy-friendly page-view analytics: no cookies, no stored IPs, bot filtering.

**Admin area** (`/admin`, behind a signed session)

- **Dashboard** — traffic, top pages/posts, recent activity, content counts.
- **Personalize** — edit the About copy, contact details, and every dynamic list on the home
  page (journey, services, achievements, toolbox, exploring, FAQ) with add/edit/delete and
  manual reordering — no drag-and-drop library, just up/down controls.
- **Blog posts** and **Writings** — a rich-text editor (TipTap/ProseMirror) with image
  upload, tags, scheduling and slug-conflict detection.
- **Content structure** — collections, chapters, sections and series in one place.
- **Projects** — the "selected work" archive, with technology tags and links.
- **Media library** — upload images, short videos, PDFs, Office documents, text/CSV and zip
  archives (up to 50 MB), catalogued and reusable across posts, writings and achievements.
  Files are identified by their actual bytes, not the filename or browser-supplied type.
- **Messages**, **Analytics**, **Settings**.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | TanStack Start (React 19, file-based routing, SSR) |
| Styling | Tailwind CSS v4, hand-written CSS for the bespoke motion/editorial design |
| Build | Vite 8, Nitro (Cloudflare Workers by default; Vercel supported — see below) |
| Data | Supabase (Postgres + Row Level Security, Storage) via the PostgREST/Storage clients directly (no full `supabase-js`, to keep the server bundle small) |
| Editor | TipTap / ProseMirror, sanitised to a fixed set of nodes/marks on every save and read |
| Auth | A single admin identity: signed, HttpOnly, `SameSite=Strict` session cookie; PBKDF2 password hashing |

## Getting started

```sh
npm install
npm run dev
```

The public site works immediately with no backend configured — it just shows empty
sections until content exists. To get the admin area and real content working, follow
[`docs/BACKEND.md`](docs/BACKEND.md): create a Supabase project, run the two SQL migrations
in `supabase/migrations/`, and set the environment variables in `.env` (copy
`.env.example` to start).

### Scripts

| Command | Does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build (Cloudflare Workers by default) |
| `npm run preview` | Runs the built Cloudflare Worker locally via `wrangler dev` |
| `npm run lint` / `npm run format` | ESLint / Prettier |
| `npm run admin:hash` | Generates an `ADMIN_PASSWORD_HASH` so the plain password is never stored |

## Deploying

- **Cloudflare Workers** (default): `npm run build`, then deploy `.output` with
  `wrangler deploy` (or connect the repo in the Cloudflare dashboard for git-based deploys).
- **Vercel**: see [`docs/DEPLOY_VERCEL.md`](docs/DEPLOY_VERCEL.md).

## Project layout

```
src/
  routes/          File-based routes — public pages and /admin/* (TanStack Router)
  components/      Public-site components, admin/ and writings/ subfolders
  server/          Server-only modules: Supabase access, auth, content queries, uploads
  lib/             Shared types, validation, small client-side utilities
  styles*.css      Global styles plus per-section stylesheets (blog, writings, admin, …)
supabase/
  migrations/      SQL, run in order in the Supabase SQL editor (idempotent, additive)
docs/
  BACKEND.md       Supabase setup, environment variables, admin password
  DEPLOY_VERCEL.md Deploying to Vercel instead of Cloudflare
```

## Design notes

The site leans into a "creative developer × security researcher" identity: monospace
system chrome, Japanese-character watermarks, a manga-inspired hero, and copy that reads
like a dossier. Performance and accessibility were treated as first-class: the JS entry
script defers until after first paint, images are served as right-sized WebP, motion
respects `prefers-reduced-motion`, and admin/editor code never reaches the public bundle.
