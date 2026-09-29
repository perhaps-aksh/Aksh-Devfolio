-- =============================================================================
-- AKSH portfolio — Writings + content hierarchy + media library
--
-- Additive on top of 20260927000000_init.sql. Does not touch existing posts/projects
-- rows; only adds nullable columns to `posts` and new tables. Safe to run on a
-- database that already has content in it. Idempotent: safe to run more than once.
--
-- New tables : collections, chapters, sections, series, writings, media_assets
-- Extended   : posts gains optional collection_id / chapter_id / section_id / series_id /
--              series_order, so existing blog posts can opt into the same organization
--              system writings use, without being forced to.
-- New bucket : `media` — arbitrary file types (PDF, docs, zip, images, …) for downloadable
--              attachments and thumbnails, separate from the image-only blog/project buckets.
--
-- Design note: collections / chapters / sections / series are independent, optional
-- taxonomies, not a rigid ownership tree — a chapter always belongs to one collection
-- (chapter_id -> collection_id is not null), but sections and series are flat and can be
-- attached to content directly, with or without a collection/chapter. This matches "a
-- piece of content can exist in multiple structures, or none" from the spec.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- collections — top-level groupings for long-form, sequential writing ("My Journey")
-- -----------------------------------------------------------------------------
create table if not exists public.collections (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique
                check (char_length(slug) between 1 and 100 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title         text not null check (char_length(title) between 1 and 160),
  description   text not null default '' check (char_length(description) <= 600),
  cover_image   text check (cover_image is null or cover_image ~* '^https?://|^/'),
  display_order integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists collections_order_idx on public.collections (display_order, created_at);

-- -----------------------------------------------------------------------------
-- chapters — a major part of one collection's story; always belongs to exactly one collection
-- -----------------------------------------------------------------------------
create table if not exists public.chapters (
  id            uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections (id) on delete cascade,
  slug          text not null
                check (char_length(slug) between 1 and 100 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title         text not null check (char_length(title) between 1 and 160),
  subtitle      text not null default '' check (char_length(subtitle) <= 300),
  display_order integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (collection_id, slug)
);
create index if not exists chapters_collection_idx on public.chapters (collection_id, display_order);

-- -----------------------------------------------------------------------------
-- sections — flat, reusable topics ("Life", "Coding & Development", "Cybersecurity")
-- -----------------------------------------------------------------------------
create table if not exists public.sections (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique
                check (char_length(slug) between 1 and 100 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title         text not null check (char_length(title) between 1 and 160),
  description   text not null default '' check (char_length(description) <= 400),
  display_order integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists sections_order_idx on public.sections (display_order, created_at);

-- -----------------------------------------------------------------------------
-- series — an ordered run of otherwise-independent pieces ("What If This Is Where I Begin?")
-- -----------------------------------------------------------------------------
create table if not exists public.series (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique
                check (char_length(slug) between 1 and 100 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title         text not null check (char_length(title) between 1 and 160),
  description   text not null default '' check (char_length(description) <= 600),
  cover_image   text check (cover_image is null or cover_image ~* '^https?://|^/'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Extend posts with the same optional organization writings get. All nullable: every
-- existing post keeps working exactly as a standalone article.
-- -----------------------------------------------------------------------------
alter table public.posts add column if not exists collection_id uuid references public.collections (id) on delete set null;
alter table public.posts add column if not exists chapter_id    uuid references public.chapters (id) on delete set null;
alter table public.posts add column if not exists section_id    uuid references public.sections (id) on delete set null;
alter table public.posts add column if not exists series_id     uuid references public.series (id) on delete set null;
alter table public.posts add column if not exists series_order  integer;

create index if not exists posts_collection_idx on public.posts (collection_id) where collection_id is not null;
create index if not exists posts_chapter_idx    on public.posts (chapter_id) where chapter_id is not null;
create index if not exists posts_section_idx    on public.posts (section_id) where section_id is not null;
create index if not exists posts_series_idx     on public.posts (series_id) where series_id is not null;

-- A chapter's collection_id must match the post's own collection_id when both are set, so a post
-- can never reference "chapter 3 of My Journey" while itself belonging to a different collection.
create or replace function public.posts_chapter_matches_collection()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.chapter_id is not null then
    if new.collection_id is null then
      new.collection_id := (select collection_id from chapters where id = new.chapter_id);
    elsif not exists (select 1 from chapters where id = new.chapter_id and collection_id = new.collection_id) then
      raise exception 'chapter_id does not belong to the given collection_id';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists posts_chapter_consistency on public.posts;
create trigger posts_chapter_consistency
  before insert or update of chapter_id, collection_id on public.posts
  for each row execute function public.posts_chapter_matches_collection();

-- -----------------------------------------------------------------------------
-- writings — poems, thoughts, questions, stories, essays, reflections, letters, journals, quotes…
-- `type` is deliberately free text (with a sane default), not an enum, so new types don't need a
-- migration — the admin UI offers a handful of quick picks but any short label is accepted.
-- -----------------------------------------------------------------------------
create table if not exists public.writings (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(title) between 1 and 200),
  slug          text not null unique
                check (char_length(slug) between 1 and 120 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  subtitle      text not null default '' check (char_length(subtitle) <= 300),
  excerpt       text not null default '' check (char_length(excerpt) <= 400),
  -- Same sanitised TipTap/ProseMirror JSON document format as posts.content.
  content       jsonb not null default '{"type":"doc","content":[]}'::jsonb
                check (jsonb_typeof(content) = 'object' and pg_column_size(content) <= 1048576),
  type          text not null default 'thought' check (char_length(type) between 1 and 40),
  cover_image   text check (cover_image is null or cover_image ~* '^https?://|^/'),
  cover_alt     text not null default '' check (char_length(cover_alt) <= 200),
  status        text not null default 'draft' check (status in ('draft', 'published')),
  featured      boolean not null default false,
  display_order integer not null default 0,
  tags          text[] not null default '{}' check (cardinality(tags) <= 12),
  author_name   text not null default 'AKSH' check (char_length(author_name) between 1 and 80),
  reading_time  integer not null default 1 check (reading_time between 0 and 240),
  collection_id uuid references public.collections (id) on delete set null,
  chapter_id    uuid references public.chapters (id) on delete set null,
  section_id    uuid references public.sections (id) on delete set null,
  series_id     uuid references public.series (id) on delete set null,
  series_order  integer,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists writings_published_idx on public.writings (published_at desc) where status = 'published';
create index if not exists writings_type_idx      on public.writings (type);
create index if not exists writings_tags_idx      on public.writings using gin (tags);
create index if not exists writings_collection_idx on public.writings (collection_id) where collection_id is not null;
create index if not exists writings_chapter_idx    on public.writings (chapter_id) where chapter_id is not null;
create index if not exists writings_section_idx    on public.writings (section_id) where section_id is not null;
create index if not exists writings_series_idx     on public.writings (series_id) where series_id is not null;

create or replace function public.writings_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  if new.chapter_id is not null then
    if new.collection_id is null then
      new.collection_id := (select collection_id from chapters where id = new.chapter_id);
    elsif not exists (select 1 from chapters where id = new.chapter_id and collection_id = new.collection_id) then
      raise exception 'chapter_id does not belong to the given collection_id';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists writings_before_write on public.writings;
create trigger writings_before_write
  before insert or update on public.writings
  for each row execute function public.writings_before_write();

drop trigger if exists collections_touch_updated_at on public.collections;
create trigger collections_touch_updated_at before update on public.collections for each row execute function public.touch_updated_at();
drop trigger if exists chapters_touch_updated_at on public.chapters;
create trigger chapters_touch_updated_at before update on public.chapters for each row execute function public.touch_updated_at();
drop trigger if exists sections_touch_updated_at on public.sections;
create trigger sections_touch_updated_at before update on public.sections for each row execute function public.touch_updated_at();
drop trigger if exists series_touch_updated_at on public.series;
create trigger series_touch_updated_at before update on public.series for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- media_assets — a private catalogue of uploaded files (any type: PDF, docs, zip, images…).
-- The files themselves live in the public `media` bucket once uploaded; this table is the
-- admin's browsable library (filename, size, who/when) and is not exposed to the public,
-- so an index of every uploaded file — including ones not yet linked anywhere — is never
-- readable by a visitor. A file is only ever reachable once its public URL is placed into a
-- post/writing/project by the admin.
-- -----------------------------------------------------------------------------
create table if not exists public.media_assets (
  id           uuid primary key default gen_random_uuid(),
  bucket       text not null default 'media' check (bucket in ('media', 'blog-images', 'project-images')),
  path         text not null,
  url          text not null check (url ~* '^https?://'),
  filename     text not null check (char_length(filename) between 1 and 200),
  mime_type    text not null check (char_length(mime_type) between 1 and 100),
  kind         text not null default 'other' check (kind in ('image', 'pdf', 'document', 'archive', 'other')),
  size_bytes   bigint not null check (size_bytes >= 0),
  alt_text     text not null default '' check (char_length(alt_text) <= 300),
  created_at   timestamptz not null default now(),
  unique (bucket, path)
);
create index if not exists media_assets_created_idx on public.media_assets (created_at desc);
create index if not exists media_assets_kind_idx    on public.media_assets (kind);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.collections   enable row level security;
alter table public.chapters      enable row level security;
alter table public.sections      enable row level security;
alter table public.series        enable row level security;
alter table public.writings      enable row level security;
alter table public.media_assets  enable row level security;

revoke all on public.collections, public.chapters, public.sections, public.series, public.writings, public.media_assets
  from anon, authenticated;

-- Taxonomy tables (collections/chapters/sections/series) have no draft concept of their own —
-- they're just organisational metadata needed to render navigation and breadcrumbs — so every row
-- is public to read. Writes still require the service-role key.
grant select on public.collections, public.chapters, public.sections, public.series to anon, authenticated;
grant select on public.writings to anon, authenticated;
grant all on public.collections, public.chapters, public.sections, public.series, public.writings, public.media_assets to service_role;

drop policy if exists "Public can read collections" on public.collections;
create policy "Public can read collections" on public.collections for select to anon, authenticated using (true);
drop policy if exists "Public can read chapters" on public.chapters;
create policy "Public can read chapters" on public.chapters for select to anon, authenticated using (true);
drop policy if exists "Public can read sections" on public.sections;
create policy "Public can read sections" on public.sections for select to anon, authenticated using (true);
drop policy if exists "Public can read series" on public.series;
create policy "Public can read series" on public.series for select to anon, authenticated using (true);

drop policy if exists "Public can read published writings" on public.writings;
create policy "Public can read published writings"
  on public.writings for select
  to anon, authenticated
  using (status = 'published' and published_at is not null and published_at <= now());

-- media_assets has no anon policy at all: not even select. Draft/unpublished assets, and the very
-- fact a file was uploaded, stay private; only its public storage URL (once placed into content) is
-- ever reachable, via the storage bucket below rather than this table.

-- -----------------------------------------------------------------------------
-- Storage: the `media` bucket, for arbitrary file types (not just images)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media', 'media', true, 26214400,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv',
    'application/zip'
  ]
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- Dashboard: fold writings + content-structure counts into the existing aggregate
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
      'posts_published',    (select count(*) from posts where status = 'published' and published_at <= now()),
      'posts_scheduled',    (select count(*) from posts where status = 'published' and published_at > now()),
      'posts_draft',        (select count(*) from posts where status = 'draft'),
      'writings_published', (select count(*) from writings where status = 'published' and published_at <= now()),
      'writings_draft',     (select count(*) from writings where status = 'draft'),
      'projects',           (select count(*) from projects),
      'collections',        (select count(*) from collections),
      'contacts_total',     (select count(*) from contact_submissions),
      'contacts_unread',    (select count(*) from contact_submissions where status = 'unread')
    ),
    'totals', (
      select jsonb_build_object(
        'views',      count(*),
        'visitors',   count(distinct visitor_id),
        'blog_views', count(*) filter (where path like '/blog/%'),
        'writing_views', count(*) filter (where path like '/writings/%')
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
