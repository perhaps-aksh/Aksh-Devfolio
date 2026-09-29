-- =============================================================================
-- AKSH portfolio — initial schema
--
-- Tables : posts, projects, contact_submissions, page_views
-- Security: Row Level Security on every table. The public (anon) role can only
--           read published content and insert contact messages / page views.
--           Everything else (drafts, submissions, analytics, all writes) is done
--           by the server with the service-role key, which bypasses RLS.
-- Storage : public buckets `blog-images` and `project-images`.
-- Idempotent: safe to run more than once.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- posts
-- -----------------------------------------------------------------------------
create table if not exists public.posts (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(title) between 1 and 200),
  slug          text not null unique
                check (char_length(slug) between 1 and 120 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  excerpt       text not null default '' check (char_length(excerpt) <= 400),
  -- TipTap / ProseMirror document. The application validates + sanitises it before saving
  -- and renders it to HTML with an allow-list renderer; raw HTML is never stored.
  content       jsonb not null default '{"type":"doc","content":[]}'::jsonb
                check (jsonb_typeof(content) = 'object' and pg_column_size(content) <= 1048576),
  cover_image   text check (cover_image is null or cover_image ~* '^https?://|^/'),
  cover_alt     text not null default '' check (char_length(cover_alt) <= 200),
  status        text not null default 'draft' check (status in ('draft', 'published')),
  category      text not null default 'GENERAL' check (char_length(category) between 1 and 40),
  tags          text[] not null default '{}' check (cardinality(tags) <= 12),
  author_name   text not null default 'AKSH' check (char_length(author_name) between 1 and 80),
  reading_time  integer not null default 1 check (reading_time between 0 and 240),
  -- Publication date. A `published` post whose date is in the future is "scheduled":
  -- the public policy below only exposes it once the date has passed (no cron needed).
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists posts_published_idx on public.posts (published_at desc) where status = 'published';
create index if not exists posts_category_idx  on public.posts (category);
create index if not exists posts_tags_idx      on public.posts using gin (tags);

create or replace function public.posts_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists posts_before_write on public.posts;
create trigger posts_before_write
  before insert or update on public.posts
  for each row execute function public.posts_before_write();

-- -----------------------------------------------------------------------------
-- projects
-- -----------------------------------------------------------------------------
create table if not exists public.projects (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique
                 check (char_length(slug) between 1 and 80 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title          text not null check (char_length(title) between 1 and 120),
  year           text not null default to_char(now(), 'YYYY') check (char_length(year) <= 12),
  category       text not null default '' check (char_length(category) <= 60),
  description    text not null default '' check (char_length(description) <= 600),
  -- Public URL (Supabase Storage). When null the site falls back to the image bundled with the app.
  image_url      text check (image_url is null or image_url ~* '^https?://|^/'),
  technologies   text[] not null default '{}' check (cardinality(technologies) <= 16),
  github_url     text check (github_url is null or github_url ~* '^https?://'),
  live_url       text check (live_url is null or live_url ~* '^https?://'),
  featured       boolean not null default false,
  published      boolean not null default true,
  display_order  integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists projects_order_idx on public.projects (display_order, created_at);

drop trigger if exists projects_touch_updated_at on public.projects;
create trigger projects_touch_updated_at
  before update on public.projects
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- contact_submissions
-- -----------------------------------------------------------------------------
create table if not exists public.contact_submissions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 120),
  email       text not null check (char_length(email) between 3 and 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  message     text not null check (char_length(message) between 1 and 5000),
  status      text not null default 'unread' check (status in ('unread', 'read')),
  user_agent  text check (user_agent is null or char_length(user_agent) <= 300),
  created_at  timestamptz not null default now()
);

create index if not exists contact_submissions_created_idx on public.contact_submissions (created_at desc);
create index if not exists contact_submissions_status_idx  on public.contact_submissions (status);

-- -----------------------------------------------------------------------------
-- page_views  (privacy-friendly: no IP, no cookies; `visitor_id` is a salted hash that rotates daily)
-- -----------------------------------------------------------------------------
create table if not exists public.page_views (
  id          bigint generated always as identity primary key,
  path        text not null check (char_length(path) between 1 and 300),
  referrer    text check (referrer is null or char_length(referrer) <= 120),
  device      text check (device is null or char_length(device) <= 20),
  browser     text check (browser is null or char_length(browser) <= 30),
  os          text check (os is null or char_length(os) <= 30),
  country     text check (country is null or char_length(country) <= 3),
  visitor_id  text check (visitor_id is null or char_length(visitor_id) <= 40),
  created_at  timestamptz not null default now()
);

create index if not exists page_views_created_idx on public.page_views (created_at desc);
create index if not exists page_views_path_idx    on public.page_views (path, created_at desc);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.posts               enable row level security;
alter table public.projects            enable row level security;
alter table public.contact_submissions enable row level security;
alter table public.page_views          enable row level security;

-- Start from zero privileges for the public roles, then grant only what is intended.
revoke all on public.posts, public.projects, public.contact_submissions, public.page_views
  from anon, authenticated;

grant select on public.posts, public.projects to anon, authenticated;
grant insert on public.contact_submissions, public.page_views to anon, authenticated;
grant all on public.posts, public.projects, public.contact_submissions, public.page_views to service_role;

drop policy if exists "Public can read published posts" on public.posts;
create policy "Public can read published posts"
  on public.posts for select
  to anon, authenticated
  using (status = 'published' and published_at is not null and published_at <= now());

drop policy if exists "Public can read published projects" on public.projects;
create policy "Public can read published projects"
  on public.projects for select
  to anon, authenticated
  using (published);

drop policy if exists "Public can submit a contact message" on public.contact_submissions;
create policy "Public can submit a contact message"
  on public.contact_submissions for insert
  to anon, authenticated
  with check (status = 'unread');

drop policy if exists "Public can record a page view" on public.page_views;
create policy "Public can record a page view"
  on public.page_views for insert
  to anon, authenticated
  with check (true);

-- No other policies exist: drafts, submissions, analytics and every update/delete are
-- unreachable with the anon key. The server uses the service-role key for the admin area.

-- -----------------------------------------------------------------------------
-- Dashboard aggregate (one round trip for the admin overview + analytics pages)
-- -----------------------------------------------------------------------------
create or replace function public.admin_dashboard(p_days integer default 30)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  d     integer     := greatest(1, least(coalesce(p_days, 30), 365));
  since timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC' - make_interval(days => d - 1);
begin
  return jsonb_build_object(
    'range_days', d,
    'counts', jsonb_build_object(
      'posts_published', (select count(*) from posts where status = 'published' and published_at <= now()),
      'posts_scheduled', (select count(*) from posts where status = 'published' and published_at > now()),
      'posts_draft',     (select count(*) from posts where status = 'draft'),
      'projects',        (select count(*) from projects),
      'contacts_total',  (select count(*) from contact_submissions),
      'contacts_unread', (select count(*) from contact_submissions where status = 'unread')
    ),
    'totals', (
      select jsonb_build_object(
        'views',      count(*),
        'visitors',   count(distinct visitor_id),
        'blog_views', count(*) filter (where path like '/blog/%')
      )
      from page_views where created_at >= since
    ),
    'all_time_views', (select count(*) from page_views),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', x.day, 'views', x.views, 'visitors', x.visitors) order by x.day), '[]'::jsonb)
      from (
        select (created_at at time zone 'UTC')::date as day, count(*) as views, count(distinct visitor_id) as visitors
        from page_views where created_at >= since
        group by 1
      ) x
    ),
    'top_pages', (
      select coalesce(jsonb_agg(jsonb_build_object('path', x.path, 'views', x.views) order by x.views desc, x.path), '[]'::jsonb)
      from (
        select path, count(*) as views from page_views where created_at >= since
        group by path order by count(*) desc, path limit 8
      ) x
    ),
    'top_posts', (
      select coalesce(jsonb_agg(jsonb_build_object('slug', x.slug, 'title', x.title, 'views', x.views) order by x.views desc, x.slug), '[]'::jsonb)
      from (
        select substring(v.path from 7) as slug, coalesce(p.title, substring(v.path from 7)) as title, count(*) as views
        from page_views v
        left join posts p on p.slug = substring(v.path from 7)
        where v.created_at >= since and v.path like '/blog/%'
        group by 1, 2 order by count(*) desc, 1 limit 8
      ) x
    ),
    'referrers', (
      select coalesce(jsonb_agg(jsonb_build_object('name', x.name, 'views', x.views) order by x.views desc, x.name), '[]'::jsonb)
      from (
        select coalesce(nullif(referrer, ''), 'Direct') as name, count(*) as views
        from page_views where created_at >= since
        group by 1 order by count(*) desc, 1 limit 8
      ) x
    ),
    'devices', (
      select coalesce(jsonb_agg(jsonb_build_object('name', x.name, 'views', x.views) order by x.views desc, x.name), '[]'::jsonb)
      from (
        select coalesce(nullif(device, ''), 'unknown') as name, count(*) as views
        from page_views where created_at >= since group by 1
      ) x
    ),
    'browsers', (
      select coalesce(jsonb_agg(jsonb_build_object('name', x.name, 'views', x.views) order by x.views desc, x.name), '[]'::jsonb)
      from (
        select coalesce(nullif(browser, ''), 'unknown') as name, count(*) as views
        from page_views where created_at >= since group by 1 order by count(*) desc, 1 limit 6
      ) x
    ),
    'countries', (
      select coalesce(jsonb_agg(jsonb_build_object('name', x.name, 'views', x.views) order by x.views desc, x.name), '[]'::jsonb)
      from (
        select coalesce(nullif(country, ''), '—') as name, count(*) as views
        from page_views where created_at >= since group by 1 order by count(*) desc, 1 limit 8
      ) x
    )
  );
end;
$$;

revoke all on function public.admin_dashboard(integer) from public, anon, authenticated;
grant execute on function public.admin_dashboard(integer) to service_role;

-- Optional housekeeping: drop page views older than N days (run manually or from a scheduled job).
create or replace function public.purge_old_page_views(p_keep_days integer default 400)
returns bigint
language sql
set search_path = public
as $$
  with gone as (
    delete from page_views where created_at < now() - make_interval(days => greatest(30, p_keep_days))
    returning 1
  )
  select count(*) from gone;
$$;

revoke all on function public.purge_old_page_views(integer) from public, anon, authenticated;
grant execute on function public.purge_old_page_views(integer) to service_role;

-- -----------------------------------------------------------------------------
-- Storage buckets (public read via CDN URL; writes only through the server with the service-role key)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('blog-images',    'blog-images',    true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']),
  ('project-images', 'project-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- No storage.objects policies are created on purpose: with RLS enabled on storage.objects and no
-- policy, anon/authenticated users cannot list, upload, replace or delete objects. Public buckets
-- still serve files through /storage/v1/object/public/<bucket>/<path>.
