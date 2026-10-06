# Deploying to Vercel

The project builds for Cloudflare Workers by default (`npm run build`). It also builds
cleanly for Vercel using the same Nitro toolchain — no code changes, no extra packages —
just a different build command. This has been tested locally with
`NITRO_PRESET=vercel npm run build`, which produces a working Vercel Build Output (API v3)
under `.vercel/output`, deployable as-is.

## 1. Import the project

In the [Vercel dashboard](https://vercel.com/new), import this repository (or run
`vercel` from the project root with the [Vercel CLI](https://vercel.com/docs/cli)).

## 2. Set the build command

Vercel's automatic framework detection doesn't know this project's TanStack
Start + Nitro setup, so set these explicitly under **Project Settings → Build & Development
Settings**:

| Setting | Value |
|---|---|
| Framework Preset | **Other** |
| Build Command | `NITRO_PRESET=vercel npm run build` |
| Output Directory | `.vercel/output` |
| Install Command | `npm install` (default) |

If you're deploying with the CLI instead of the dashboard, the same build command works —
Vercel's own build environment also sets `VERCEL=1`, which Nitro can use to select the
Vercel preset on its own; setting `NITRO_PRESET=vercel` explicitly is the safer, tested
option and costs nothing extra.

## 3. Environment variables

Add the same variables described in [`BACKEND.md`](BACKEND.md) under **Project Settings →
Environment Variables** (Production and Preview):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_ID`
- `ADMIN_PASSWORD` (or `ADMIN_PASSWORD_HASH` — see `npm run admin:hash`)
- `ADMIN_SESSION_SECRET`
- `SITE_URL` — set this to your Vercel domain (e.g. `https://your-project.vercel.app`, or
  your custom domain once attached), so canonical links, Open Graph tags and the sitemap
  point at the right place.

`FORMSUBMIT_BASE` is optional and only needed for testing against a fake endpoint — leave
it unset in production.

## 4. Deploy

Push to the connected branch (or run `vercel --prod`). Vercel runs the build command above
and deploys the resulting serverless function (Node.js runtime) plus static assets.

## 5. Turn on Web Analytics

`@vercel/analytics` is already installed and wired into the root layout (`<Analytics/>` from
`@vercel/analytics/react`), but it only collects data once **Web Analytics** is turned on for
the project in the Vercel dashboard (Project → Analytics tab) — that's a separate, manual,
one-time step the code can't do for you. Until then (or anywhere not actually served by
Vercel, e.g. local dev) the component safely no-ops.

## Notes

- The output is the same Nitro-built server as the Cloudflare deploy, just targeting
  Vercel's Build Output API instead of the Workers runtime — the app code doesn't know or
  care which platform it's running on.
- `vite.config.ts` doesn't hardcode a preset; the Cloudflare default only applies when no
  other preset is requested, so setting `NITRO_PRESET` (as above) is all that's needed to
  target a different platform. Nothing needs to change back to deploy to Cloudflare again —
  just build without that environment variable.
- If you later move off Vercel, delete `.vercel` locally (already git-ignored) and rebuild
  with the default `npm run build`.
