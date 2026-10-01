import type { PMNode } from "@/lib/rich-text";

export type PostStatus = "draft" | "published";

export type AdminPostRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  cover_image: string | null;
  cover_alt: string;
  category: string;
  tags: string[];
  author_name: string;
  published_at: string | null;
  reading_time: number;
  collection_id: string | null;
  chapter_id: string | null;
  section_id: string | null;
  series_id: string | null;
  series_order: number | null;
  status: PostStatus;
  created_at: string;
  updated_at: string;
};
export type AdminPostDetail = AdminPostRow & { content: PMNode };

export type AdminProject = {
  id: string;
  slug: string;
  title: string;
  year: string;
  category: string;
  description: string;
  image_url: string | null;
  technologies: string[];
  github_url: string | null;
  live_url: string | null;
  featured: boolean;
  published: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export type ContactStatus = "unread" | "read";
export type AdminContact = {
  id: string;
  name: string;
  email: string;
  message: string;
  status: ContactStatus;
  user_agent: string | null;
  created_at: string;
};

export type Counted = { name: string; views: number };
export type DashboardStats = {
  range_days: number;
  counts: {
    posts_published: number;
    posts_scheduled: number;
    posts_draft: number;
    writings_published: number;
    writings_draft: number;
    projects: number;
    collections: number;
    contacts_total: number;
    contacts_unread: number;
  };
  totals: { views: number; visitors: number; blog_views: number; writing_views: number };
  all_time_views: number;
  daily: { day: string; views: number; visitors: number }[];
  top_pages: { path: string; views: number }[];
  top_posts: { slug: string; title: string; views: number }[];
  referrers: Counted[];
  devices: Counted[];
  browsers: Counted[];
  countries: Counted[];
};

export type RecentVisit = {
  id: number;
  path: string;
  referrer: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  country: string | null;
  created_at: string;
};

export type DashboardData = {
  stats: DashboardStats;
  recentVisits: RecentVisit[];
  recentContacts: AdminContact[];
  recentPosts: AdminPostRow[];
  recentWritings: AdminWritingRow[];
};

export type Paged<T> = { items: T[]; total: number; page: number; pageSize: number };

// --- Content structure (collections / chapters / sections / series) ------------------------------

export type AdminCollection = {
  id: string;
  slug: string;
  title: string;
  description: string;
  cover_image: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
};
export type AdminChapter = {
  id: string;
  collection_id: string;
  slug: string;
  title: string;
  subtitle: string;
  display_order: number;
  created_at: string;
  updated_at: string;
};
export type AdminSection = {
  id: string;
  slug: string;
  title: string;
  description: string;
  display_order: number;
  created_at: string;
  updated_at: string;
};
export type AdminSeries = {
  id: string;
  slug: string;
  title: string;
  description: string;
  cover_image: string | null;
  created_at: string;
  updated_at: string;
};
export type ContentStructure = {
  collections: AdminCollection[];
  chapters: AdminChapter[];
  sections: AdminSection[];
  series: AdminSeries[];
};

// --- Writings ---------------------------------------------------------------------------------------

export type AdminWritingRow = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  excerpt: string;
  type: string;
  cover_image: string | null;
  cover_alt: string;
  status: PostStatus;
  featured: boolean;
  display_order: number;
  tags: string[];
  author_name: string;
  reading_time: number;
  collection_id: string | null;
  chapter_id: string | null;
  section_id: string | null;
  series_id: string | null;
  series_order: number | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};
export type AdminWritingDetail = AdminWritingRow & { content: PMNode };

// --- Media library ------------------------------------------------------------------------------

export type MediaKind = "image" | "pdf" | "video" | "document" | "archive" | "other";
export type AdminMediaAsset = {
  id: string;
  bucket: string;
  path: string;
  url: string;
  filename: string;
  mime_type: string;
  kind: MediaKind;
  size_bytes: number;
  alt_text: string;
  created_at: string;
};

export type SettingsInfo = {
  supabaseUrl: boolean;
  anonKey: boolean;
  serviceKey: boolean;
  adminId: boolean;
  adminPassword: boolean;
  passwordHash: boolean;
  sessionSecret: boolean;
  siteUrl: string;
  supabaseHost: string | null;
  connection: "ok" | "error" | "unconfigured";
  connectionMessage: string;
};
