import type { SiteContent } from "@/lib/site-content";

/** A project as the public site shows it. `image` is null until one is uploaded in the admin area. */
export type Project = {
  id: string;
  title: string;
  year: string;
  category: string;
  description: string;
  image: string | null;
  technologies: readonly string[];
  githubUrl?: string;
  liveUrl?: string;
  featured?: boolean;
};

export type PostSummary = {
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
};

export type PostFull = PostSummary & {
  /** Sanitised HTML rendered from the stored document on the server. */
  html: string;
  status: "draft" | "published";
  updated_at: string;
};

export type PostPage = {
  post: PostFull;
  related: PostSummary[];
  siteUrl: string;
  preview: boolean;
};

export type PostList = {
  items: PostSummary[];
  total: number;
  page: number;
  pageSize: number;
  categories: string[];
};

/** The few fields the home page's Writings section needs. */
export type HomeWriting = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  excerpt: string;
  type: string;
  published_at: string | null;
};

export type HomeContent = {
  projects: Project[];
  posts: PostSummary[];
  writings: HomeWriting[];
  site: SiteContent;
};
