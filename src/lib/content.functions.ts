import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { clientIp, isAdminRequest } from "@/server/admin-auth.server";
import { submitContact } from "@/server/contact.server";
import { getHomeContent, getPostPage, listPosts } from "@/server/content.server";
import {
  isAdminConfigured,
  isServiceKeyConfigured,
  isSupabaseConfigured,
} from "@/server/env.server";
import {
  getChapterPage,
  getCollectionPage,
  getWritingPage,
  listWritings,
} from "@/server/writings.server";

/** Public server functions: published content, the contact form and the admin session probe. */

export const getHomeContentFn = createServerFn({ method: "GET" }).handler(() => getHomeContent());

const listSchema = z.object({
  q: z.string().max(80).optional(),
  category: z.string().max(40).optional(),
  tag: z.string().max(30).optional(),
  page: z.number().int().min(1).max(500).default(1),
  pageSize: z.number().int().min(1).max(24).default(9),
});

export const listPostsFn = createServerFn({ method: "GET" })
  .validator((data: unknown) => listSchema.parse(data))
  .handler(({ data }) => listPosts(data));

const postSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  preview: z.boolean().optional(),
});

export const getPostFn = createServerFn({ method: "GET" })
  .validator((data: unknown) => postSchema.parse(data))
  .handler(({ data }) => getPostPage(data.slug, Boolean(data.preview)));

const contactSchema = z.object({
  name: z.string().max(400),
  email: z.string().max(400),
  message: z.string().max(10_000),
  website: z.string().max(200).optional(),
});

export const submitContactFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => contactSchema.parse(data))
  .handler(({ data }) =>
    submitContact(data, {
      ip: clientIp(),
      userAgent: getRequest().headers.get("user-agent") ?? "",
    }),
  );

const writingListSchema = z.object({
  q: z.string().max(80).optional(),
  type: z.string().max(40).optional(),
  section: z.string().max(100).optional(),
  series: z.string().max(100).optional(),
  page: z.number().int().min(1).max(500).default(1),
  pageSize: z.number().int().min(1).max(24).default(9),
});

export const listWritingsFn = createServerFn({ method: "GET" })
  .validator((data: unknown) => writingListSchema.parse(data))
  .handler(({ data }) => listWritings(data));

const writingSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  preview: z.boolean().optional(),
});

export const getWritingFn = createServerFn({ method: "GET" })
  .validator((data: unknown) => writingSchema.parse(data))
  .handler(({ data }) => getWritingPage(data.slug, Boolean(data.preview)));

const slugSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
});

export const getCollectionFn = createServerFn({ method: "GET" })
  .validator((data: unknown) => slugSchema.parse(data))
  .handler(({ data }) => getCollectionPage(data.slug));

const chapterSchema = z.object({
  collection: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  chapter: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
});

export const getChapterFn = createServerFn({ method: "GET" })
  .validator((data: unknown) => chapterSchema.parse(data))
  .handler(({ data }) => getChapterPage(data.collection, data.chapter));

/** Non-sensitive: tells the admin guard whether the visitor has a valid session and what is configured. */
export const getAdminSessionFn = createServerFn({ method: "GET" }).handler(async () => ({
  authenticated: await isAdminRequest(),
  adminConfigured: isAdminConfigured(),
  supabaseConfigured: isSupabaseConfigured(),
  serviceConfigured: isServiceKeyConfigured(),
}));
