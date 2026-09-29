-- =============================================================================
-- AKSH portfolio — editable site content ("Personalize" in the admin area)
--
-- Additive on top of 20260927000000_init.sql and 20260928000000_writings_and_hierarchy.sql.
-- Does not touch existing posts / projects / writings. Idempotent: safe to run more than once.
--
-- New tables : site_profile (about + contact copy, single row), identity_items, journey_entries,
--              services, achievements, exploring_items, toolbox_groups, faqs
-- Extended   : media_assets.kind now allows 'video'; the `media` bucket accepts mp4 / webm / mov
--              and files up to 50 MB (achievements can carry an image or a short video)
-- Seeds      : services ("what I can build"), toolbox groups, the four identity lines and the
--              about / contact copy — inserted only into EMPTY tables, so re-running never
--              overwrites anything you edited. Journey, achievements, exploring, FAQ and projects
--              start empty: add your own from /admin/personalize.
--
-- Access model (same as the rest of the schema): visitors can only READ published rows through the
-- anon key; every write goes through the admin area with the service-role key, which bypasses RLS.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- site_profile — one row: about copy + contact details
-- -----------------------------------------------------------------------------
create table if not exists public.site_profile (
  id            smallint primary key default 1 check (id = 1),
  about_lead    text not null default '' check (char_length(about_lead) <= 800),
  about_body    text not null default '' check (char_length(about_body) <= 2000),
  signature     text not null default '' check (char_length(signature) <= 40),
  hanko         text not null default '' check (char_length(hanko) <= 2),
  contact_email text not null default '' check (char_length(contact_email) <= 254),
  contact_lead  text not null default '' check (char_length(contact_lead) <= 400),
  updated_at    timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Ordered, publishable lists. Every list shares the same bookkeeping columns.
-- -----------------------------------------------------------------------------
create table if not exists public.identity_items (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(title) between 1 and 30),
  note          text not null default '' check (char_length(note) <= 60),
  display_order integer not null default 0,
  published     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.journey_entries (
  id            uuid primary key default gen_random_uuid(),
  year          text not null default '' check (char_length(year) <= 12),
  place         text not null default '' check (char_length(place) <= 40),
  stage         text not null default '' check (char_length(stage) <= 24),
  title         text not null check (char_length(title) between 1 and 80),
  description   text not null default '' check (char_length(description) <= 600),
  tags          text[] not null default '{}' check (cardinality(tags) <= 8),
  display_order integer not null default 0,
  published     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.services (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(title) between 1 and 60),
  jp            text not null default '' check (char_length(jp) <= 4),
  tagline       text not null default '' check (char_length(tagline) <= 160),
  capabilities  text[] not null default '{}' check (cardinality(capabilities) <= 8),
  kind          text not null default 'dev' check (char_length(kind) <= 24),
  display_order integer not null default 0,
  published     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.achievements (
  id            uuid primary key default gen_random_uuid(),
  value         text not null default '' check (char_length(value) <= 12),
  title         text not null check (char_length(title) between 1 and 80),
  jp            text not null default '' check (char_length(jp) <= 4),
  year          text not null default '' check (char_length(year) <= 20),
  organization  text not null default '' check (char_length(organization) <= 80),
  detail        text not null default '' check (char_length(detail) <= 400),
  media_url     text check (media_url is null or media_url ~* '^https?://|^/'),
  media_kind    text check (media_kind is null or media_kind in ('image', 'video')),
  display_order integer not null default 0,
  published     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check ((media_url is null) = (media_kind is null))
);

create table if not exists public.exploring_items (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(title) between 1 and 80),
  description   text not null default '' check (char_length(description) <= 500),
  display_order integer not null default 0,
  published     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.toolbox_groups (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(title) between 1 and 40),
  jp            text not null default '' check (char_length(jp) <= 2),
  tools         text[] not null default '{}' check (cardinality(tools) <= 24),
  display_order integer not null default 0,
  published     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.faqs (
  id            uuid primary key default gen_random_uuid(),
  question      text not null check (char_length(question) between 1 and 200),
  answer        text not null default '' check (char_length(answer) <= 1500),
  display_order integer not null default 0,
  published     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists identity_items_order_idx  on public.identity_items  (display_order, created_at);
create index if not exists journey_entries_order_idx on public.journey_entries (display_order, created_at);
create index if not exists services_order_idx        on public.services        (display_order, created_at);
create index if not exists achievements_order_idx    on public.achievements    (display_order, created_at);
create index if not exists exploring_items_order_idx on public.exploring_items (display_order, created_at);
create index if not exists toolbox_groups_order_idx  on public.toolbox_groups  (display_order, created_at);
create index if not exists faqs_order_idx            on public.faqs            (display_order, created_at);

-- updated_at bookkeeping (touch_updated_at() is created by the init migration)
drop trigger if exists site_profile_touch_updated_at on public.site_profile;
create trigger site_profile_touch_updated_at before update on public.site_profile for each row execute function public.touch_updated_at();
drop trigger if exists identity_items_touch_updated_at on public.identity_items;
create trigger identity_items_touch_updated_at before update on public.identity_items for each row execute function public.touch_updated_at();
drop trigger if exists journey_entries_touch_updated_at on public.journey_entries;
create trigger journey_entries_touch_updated_at before update on public.journey_entries for each row execute function public.touch_updated_at();
drop trigger if exists services_touch_updated_at on public.services;
create trigger services_touch_updated_at before update on public.services for each row execute function public.touch_updated_at();
drop trigger if exists achievements_touch_updated_at on public.achievements;
create trigger achievements_touch_updated_at before update on public.achievements for each row execute function public.touch_updated_at();
drop trigger if exists exploring_items_touch_updated_at on public.exploring_items;
create trigger exploring_items_touch_updated_at before update on public.exploring_items for each row execute function public.touch_updated_at();
drop trigger if exists toolbox_groups_touch_updated_at on public.toolbox_groups;
create trigger toolbox_groups_touch_updated_at before update on public.toolbox_groups for each row execute function public.touch_updated_at();
drop trigger if exists faqs_touch_updated_at on public.faqs;
create trigger faqs_touch_updated_at before update on public.faqs for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security: the public can read published rows, nothing else.
-- -----------------------------------------------------------------------------
alter table public.site_profile    enable row level security;
alter table public.identity_items  enable row level security;
alter table public.journey_entries enable row level security;
alter table public.services        enable row level security;
alter table public.achievements    enable row level security;
alter table public.exploring_items enable row level security;
alter table public.toolbox_groups  enable row level security;
alter table public.faqs            enable row level security;

revoke all on public.site_profile, public.identity_items, public.journey_entries, public.services,
              public.achievements, public.exploring_items, public.toolbox_groups, public.faqs
  from anon, authenticated;
grant select on public.site_profile, public.identity_items, public.journey_entries, public.services,
                public.achievements, public.exploring_items, public.toolbox_groups, public.faqs
  to anon, authenticated;
grant all on public.site_profile, public.identity_items, public.journey_entries, public.services,
             public.achievements, public.exploring_items, public.toolbox_groups, public.faqs
  to service_role;

drop policy if exists "Public can read the profile" on public.site_profile;
create policy "Public can read the profile" on public.site_profile for select to anon, authenticated using (true);

drop policy if exists "Public can read published identity items" on public.identity_items;
create policy "Public can read published identity items" on public.identity_items for select to anon, authenticated using (published);
drop policy if exists "Public can read published journey entries" on public.journey_entries;
create policy "Public can read published journey entries" on public.journey_entries for select to anon, authenticated using (published);
drop policy if exists "Public can read published services" on public.services;
create policy "Public can read published services" on public.services for select to anon, authenticated using (published);
drop policy if exists "Public can read published achievements" on public.achievements;
create policy "Public can read published achievements" on public.achievements for select to anon, authenticated using (published);
drop policy if exists "Public can read published exploring items" on public.exploring_items;
create policy "Public can read published exploring items" on public.exploring_items for select to anon, authenticated using (published);
drop policy if exists "Public can read published toolbox groups" on public.toolbox_groups;
create policy "Public can read published toolbox groups" on public.toolbox_groups for select to anon, authenticated using (published);
drop policy if exists "Public can read published faqs" on public.faqs;
create policy "Public can read published faqs" on public.faqs for select to anon, authenticated using (published);

-- -----------------------------------------------------------------------------
-- Media library: allow video, and raise the per-file limit to 50 MB
-- -----------------------------------------------------------------------------
alter table public.media_assets drop constraint if exists media_assets_kind_check;
alter table public.media_assets
  add constraint media_assets_kind_check check (kind in ('image', 'pdf', 'document', 'archive', 'video', 'other'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media', 'media', true, 52428800,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml',
    'video/mp4', 'video/webm', 'video/quicktime',
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
-- Seeds — only into empty tables, so re-running never overwrites your edits
-- -----------------------------------------------------------------------------
insert into public.site_profile (id, about_lead, about_body, signature, hanko, contact_email, contact_lead)
values (
  1,
  'I am AKSH, a maverick creative developer based in India with a strong interest in cybersecurity, systems, and creative technology. My work lives at the intersection of editorial design, interactive storytelling, and security-conscious engineering.',
  'I believe the best digital experiences feel intentional — every transition, every type choice, every micro-interaction should serve the story, and every system should be built to resist what it was not designed for. I build websites that feel like publications, products that feel like art, and experiments that question what the web can be.',
  'Aksh',
  '暁',
  'perhaps.maverick@gmail.com',
  'Tell me what you’re making. If it challenges the ordinary, I’m already interested.'
)
on conflict (id) do nothing;

insert into public.identity_items (title, note, display_order)
select v.title, v.note, v.ord
from (values
  ('DEVELOPER', 'Building. Solving.',      10),
  ('CREATOR',   'Imagining. Expressing.',  20),
  ('LEARNER',   'Always Curious.',         30),
  ('DREAMER',   'Building Tomorrow.',      40)
) as v(title, note, ord)
where not exists (select 1 from public.identity_items);

insert into public.services (title, jp, tagline, capabilities, kind, display_order)
select v.title, v.jp, v.tagline, v.capabilities, v.kind, v.ord
from (values
  ('UI / UX',                 '体験', 'Interfaces and flows that feel intentional.',
     array['DESIGN SYSTEMS','PROTOTYPING','INTERFACE DESIGN','USER FLOWS'], 'ux', 10),
  ('FULL STACK DEVELOPMENT',  '開発', 'End-to-end web apps, from database to interface.',
     array['MERN STACK','REST APIS','AUTH & SESSIONS','DEPLOYMENT'], 'dev', 20),
  ('BUG BOUNTY',              '報奨', 'Hunting real-world vulnerabilities, responsibly.',
     array['RECON','WEB APP TESTING','OWASP TOP 10','RESPONSIBLE DISCLOSURE'], 'bug', 30),
  ('VAPT',                    '診断', 'Structured vulnerability assessment and penetration testing.',
     array['SCOPING','SCANNING','EXPLOITATION','REPORTING'], 'scan', 40),
  ('DFIR',                    '鑑識', 'Digital forensics and incident response, evidence first.',
     array['DISK & MEMORY FORENSICS','TIMELINE ANALYSIS','LOG ANALYSIS','IR PLAYBOOKS'], 'forensic', 50),
  ('PENTESTING',              '侵入', 'Adversary-style testing of apps, networks and hosts.',
     array['NMAP','METASPLOIT','BLOODHOUND','KALI LINUX'], 'shell', 60),
  ('BLUE TEAMING',            '防衛', 'Detection, monitoring and defence that holds up.',
     array['SIEM','SPLUNK','WAZUH','DETECTION ENGINEERING'], 'shield', 70),
  ('FREELANCING',             '自由', 'Independent work with clear scope and honest timelines.',
     array['SCOPED PROJECTS','SECURITY REVIEWS','WEB BUILDS','ONGOING SUPPORT'], 'freelance', 80),
  ('HARDWARE / ROBOTICS',     '機械', 'Physical builds where code meets circuits.',
     array['MICROCONTROLLERS','SENSORS','ROBOTICS PROJECTS','PROTOTYPING'], 'chip', 90),
  ('REVERSE ENGINEERING',     '解析', 'Taking software apart to understand how it works.',
     array['STATIC ANALYSIS','DYNAMIC ANALYSIS','DEBUGGING','C / C++'], 'hex', 100),
  ('ENDPOINT SECURITY',       '端末', 'Protecting and monitoring the machines people actually use.',
     array['EDR','HARDENING','TELEMETRY','THREAT DETECTION'], 'endpoint', 110),
  ('RESEARCH',                '研究', 'Curiosity with method: notes, write-ups and experiments.',
     array['SECURITY RESEARCH','WRITE-UPS','EXPERIMENTS','THREAT MODELING'], 'research', 120),
  ('SOFTWARE DEVELOPMENT',    '構築', 'Reliable software in the language the problem needs.',
     array['PYTHON','JAVASCRIPT','C / C++','KOTLIN / SWIFT'], 'dev', 130)
) as v(title, jp, tagline, capabilities, kind, ord)
where not exists (select 1 from public.services);

insert into public.toolbox_groups (title, jp, tools, display_order)
select v.title, v.jp, v.tools, v.ord
from (values
  ('FULL STACK',        '表', array['MERN','JavaScript','SQL'], 10),
  ('LANGUAGES',         '言', array['Python','Bash Scripting','C / C++','Kotlin','Swift'], 20),
  ('OFFENSIVE SECURITY','攻', array['Kali Linux','Nmap','Metasploit','BloodHound','OWASP'], 30),
  ('BLUE TEAM',         '守', array['Splunk','SIEM','Wazuh','EDR'], 40),
  ('EXPERIMENTAL',      '試', array['Experimental Builds','Creative Coding','Generative Systems'], 50)
) as v(title, jp, tools, ord)
where not exists (select 1 from public.toolbox_groups);
