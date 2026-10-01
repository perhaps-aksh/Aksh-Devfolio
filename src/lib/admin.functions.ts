import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { adminOnly } from "@/lib/admin-middleware";
import { login, logout } from "@/server/admin-auth.server";
import {
  deleteContacts,
  deleteImageByUrl,
  deletePost,
  deleteProject,
  getAdminPost,
  getAnalytics,
  getDashboard,
  getSettingsInfo,
  listAdminPosts,
  listAdminProjects,
  listContacts,
  markContacts,
  reorderProjects,
  savePost,
  saveProject,
  setPostStatus,
  uploadImage,
} from "@/server/admin-data.server";
import { SECTION_KEYS } from "@/lib/site-content";
import { siteOrigin } from "@/server/content.server";
import {
  deleteChapter,
  deleteCollection,
  deleteSection,
  deleteSeries,
  getContentStructure,
  reorderChapters,
  reorderCollections,
  reorderSections,
  saveChapter,
  saveCollection,
  saveSection,
  saveSeries,
} from "@/server/content-structure.server";
import {
  deleteSectionRow,
  getAdminProfile,
  listSectionRows,
  reorderSectionRows,
  saveAdminProfile,
  saveSectionRow,
  setSectionRowPublished,
} from "@/server/site-content.server";
import {
  createMediaUpload,
  deleteMediaAsset,
  finalizeMediaUpload,
  deleteWriting,
  getAdminWriting,
  listAdminWritings,
  listMediaAssets,
  saveWriting,
  setWritingStatus,
} from "@/server/writings-admin.server";

/** Admin server functions. Everything except `loginFn` runs behind the `adminOnly` middleware. */

// --- session ------------------------------------------------------------------------------------------

export const loginFn = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ id: z.string().min(1).max(200), password: z.string().min(1).max(500) }).parse(data),
  )
  .handler(({ data }) => login(data.id, data.password));

export const logoutFn = createServerFn({ method: "POST" }).handler(() => {
  logout();
  return { ok: true as const };
});

// --- dashboard / analytics ----------------------------------------------------------------------------

const daysSchema = z.object({ days: z.number().int().min(1).max(365).default(30) });

export const getDashboardFn = createServerFn({ method: "GET" })
  .middleware([adminOnly])
  .validator((data: unknown) => daysSchema.parse(data ?? {}))
  .handler(({ data }) => getDashboard(data.days));

export const getAnalyticsFn = createServerFn({ method: "GET" })
  .middleware([adminOnly])
  .validator((data: unknown) => daysSchema.parse(data ?? {}))
  .handler(({ data }) => getAnalytics(data.days));

// --- posts --------------------------------------------------------------------------------------------

const postListSchema = z.object({
  q: z.string().max(80).optional(),
  status: z.enum(["draft", "published"]).optional(),
  page: z.number().int().min(1).max(1000).default(1),
});

export const listAdminPostsFn = createServerFn({ method: "GET" })
  .middleware([adminOnly])
  .validator((data: unknown) => postListSchema.parse(data ?? {}))
  .handler(({ data }) => listAdminPosts(data));

export const getAdminPostFn = createServerFn({ method: "GET" })
  .middleware([adminOnly])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(({ data }) => getAdminPost(data.id));

const savePostSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().max(200),
  slug: z.string().max(160),
  excerpt: z.string().max(1000),
  content: z.unknown(),
  cover_image: z.string().max(2000).nullable(),
  cover_alt: z.string().max(300),
  category: z.string().max(80),
  tags: z.array(z.string().max(60)).max(40),
  status: z.enum(["draft", "published"]),
  collection_id: z.string().uuid().nullable(),
  chapter_id: z.string().uuid().nullable(),
  section_id: z.string().uuid().nullable(),
  series_id: z.string().uuid().nullable(),
  series_order: z.number().int().min(1).max(100000).nullable(),
  published_at: z.string().max(40).nullable(),
});

export const savePostFn = createServerFn({ method: "POST" })
  .middleware([adminOnly])
  .validator((data: unknown) => savePostSchema.parse(data))
  .handler(({ data }) => savePost(data));

export const setPostStatusFn = createServerFn({ method: "POST" })
  .middleware([adminOnly])
  .validator((data: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["draft", "published"]) }).parse(data),
  )
  .handler(({ data }) => setPostStatus(data.id, data.status));

export const deletePostFn = createServerFn({ method: "POST" })
  .middleware([adminOnly])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    await deletePost(data.id);
    return { ok: true as const };
  });

// --- projects -----------------------------------------------------------------------------------------

export const listAdminProjectsFn = createServerFn({ method: "GET" })
  .middleware([adminOnly])
  .handler(() => listAdminProjects());

const saveProjectSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().max(120),
  title: z.string().max(200),
  year: z.string().max(20),
  category: z.string().max(100),
  description: z.string().max(1000),
  image_url: z.string().max(2000).nullable(),
  technologies: z.array(z.string().max(60)).max(40),
  github_url: z.string().max(500).nullable(),
  live_url: z.string().max(500).nullable(),
  featured: z.boolean(),
  published: z.boolean(),
});

export const saveProjectFn = createServerFn({ method: "POST" })
  .middleware([adminOnly])
  .validator((data: unknown) => saveProjectSchema.parse(data))
  .handler(({ data }) => saveProject(data));

export const reorderProjectsFn = createServerFn({ method: "POST" })
  .middleware([adminOnly])
  .validator((data: unknown) => z.object({ ids: z.array(z.string().uuid()).max(100) }).parse(data))
  .handler(async ({ data }) => {
    await reorderProjects(data.ids);
    return { ok: true as const };
  });

export const deleteProjectFn = createServerFn({ method: "POST" })
  .middleware([adminOnly])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    await deleteProject(data.id);
    return { ok: true as const };
  });

// --- contact submissions ------------------------------------------------------------------------------

const contactListSchema = z.object({
  status: z.enum(["unread", "read"]).optional(),
  q: z.string().max(80).optional(),
  page: z.number().int().min(1).max(1000).default(1),
});

export const listContactsFn = createServerFn({ method: "GET" })
  .middleware([adminOnly])
  .validator((data: unknown) => contactListSchema.parse(data ?? {}))
  .handler(({ data }) => listContacts(data));

export const markContactsFn = createServerFn({ method: "POST" })
  .middleware([adminOnly])
  .validator((data: unknown) =>
    z
      .object({
        ids: z.array(z.string().uuid()).min(1).max(100),
        status: z.enum(["unread", "read"]),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await markContacts(data.ids, data.status);
    return { ok: true as const };
  });

export const deleteContactsFn = createServerFn({ method: "POST" })
  .middleware([adminOnly])
  .validator((data: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }).parse(data),
  )
  .handler(async ({ data }) => {
    await deleteContacts(data.ids);
    return { ok: true as const };
  });

// --- images -------------------------------------------------------------------------------------------

export const uploadImageFn = createServerFn({ method: "POST" })
  .middleware([adminOnly])
  .validator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Expected form data.");
    return data;
  })
  .handler(({ data }) => uploadImage(String(data.get("bucket") ?? ""), data.get("file")));

export const deleteImageFn = createServerFn({ method: "POST" })
  .middleware([adminOnly])
  .validator((data: unknown) => z.object({ url: z.string().max(2000) }).parse(data))
  .handler(async ({ data }) => {
    await deleteImageByUrl(data.url);
    return { ok: true as const };
  });

// --- settings -----------------------------------------------------------------------------------------

export const getSettingsFn = createServerFn({ method: "GET" })
  .middleware([adminOnly])
  .handler(() => getSettingsInfo(siteOrigin()));

// --- content structure: collections / chapters / sections / series -------------------------------------

export const getContentStructureFn = createServerFn({ method: "GET" })
  .middleware([adminOnly])
  .handler(() => getContentStructure());

const saveCollectionSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().max(120),
  title: z.string().max(160),
  description: z.string().max(600),
  cover_image: z.string().max(2000).nullable(),
});
export const saveCollectionFn = createServerFn({ method: "POST" })
  .middleware([adminOnly])
  .validator((data: unknown) => saveCollectionSchema.parse(data))
  .handler(({ data }) => saveCollection(data));

export const reorderCollectionsFn = createServerFn({ method: "POST" })
  .middleware([adminOnly])
  .validator((data: unknown) => z.object({ ids: z.array(z.string().uuid()).max(200) }).parse(data))
  .handler(async ({ data }) => {
    await reorderCollections(data.ids);
    return { ok: true as const };
  });

export const deleteCollectionFn = createServerFn({ method: "POST" })
  .middleware([adminOnly])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    await deleteCollection(data.id);
    return { ok: true as const };
  });

const saveChapterSchema = z.object({
  id: z.string().uuid().optional(),
  collection_id: z.string().uuid(),
  slug: z.string().max(120),
  title: z.string().max(160),
  subtitle: z.string().max(300),
});
export const saveChapterFn = createServerFn({ method: "POST" })
  .middleware([adminOnly])
  .validator((data: unknown) => saveChapterSchema.parse(data))
  .handler(({ data }) => saveChapter(data));

export const reorderChaptersFn = createServerFn({ method: "POST" })
  .middleware([adminOnly])
  .validator((data: unknown) => z.object({ ids: z.array(z.string().uuid()).max(200) }).parse(data))
  .handler(async ({ data }) => {
    await reorderChapters(data.ids);
    return { ok: true as const };
  });

export const deleteChapterFn = createServerFn({ method: "POST" })
  .middleware([adminOnly])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    await deleteChapter(data.id);
    return { ok: true as const };
  });

const saveSectionSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().max(120),
  title: z.string().max(160),
  description: z.string().max(400),
});
export const saveSectionFn = createServerFn({ method: "POST" })
  .middleware([adminOnly])
  .validator((data: unknown) => saveSectionSchema.parse(data))
  .handler(({ data }) => saveSection(data));

export const reorderSectionsFn = createServerFn({ method: "POST" })
  .middleware([adminOnly])
  .validator((data: unknown) => z.object({ ids: z.array(z.string().uuid()).max(200) }).parse(data))
  .handler(async ({ data }) => {
    await reorderSections(data.ids);
    return { ok: true as const };
  });

export const deleteSectionFn = createServerFn({ method: "POST" })
  .middleware([adminOnly])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    await deleteSection(data.id);
    return { ok: true as const };
  });

const saveSeriesSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().max(120),
  title: z.string().max(160),
  description: z.string().max(600),
  cover_image: z.string().max(2000).nullable(),
});
export const saveSeriesFn = createServerFn({ method: "POST" })
  .middleware([adminOnly])
  .validator((data: unknown) => saveSeriesSchema.parse(data))
  .handler(({ data }) => saveSeries(data));

export const deleteSeriesFn = createServerFn({ method: "POST" })
  .middleware([adminOnly])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    await deleteSeries(data.id);
    return { ok: true as const };
  });

// --- writings -------------------------------------------------------------------------------------------

const writingListSchema = z.object({
  q: z.string().max(80).optional(),
  status: z.enum(["draft", "published"]).optional(),
  type: z.string().max(40).optional(),
  page: z.number().int().min(1).max(1000).default(1),
});
export const listAdminWritingsFn = createServerFn({ method: "GET" })
  .middleware([adminOnly])
  .validator((data: unknown) => writingListSchema.parse(data ?? {}))
  .handler(({ data }) => listAdminWritings(data));

export const getAdminWritingFn = createServerFn({ method: "GET" })
  .middleware([adminOnly])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(({ data }) => getAdminWriting(data.id));

const saveWritingSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().max(200),
  slug: z.string().max(160),
  subtitle: z.string().max(300),
  excerpt: z.string().max(1000),
  content: z.unknown(),
  type: z.string().max(40),
  cover_image: z.string().max(2000).nullable(),
  cover_alt: z.string().max(300),
  status: z.enum(["draft", "published"]),
  featured: z.boolean(),
  tags: z.array(z.string().max(60)).max(40),
  collection_id: z.string().uuid().nullable(),
  chapter_id: z.string().uuid().nullable(),
  section_id: z.string().uuid().nullable(),
  series_id: z.string().uuid().nullable(),
  series_order: z.number().int().min(1).max(100000).nullable(),
  published_at: z.string().max(40).nullable(),
});
export const saveWritingFn = createServerFn({ method: "POST" })
  .middleware([adminOnly])
  .validator((data: unknown) => saveWritingSchema.parse(data))
  .handler(({ data }) => saveWriting(data));

export const setWritingStatusFn = createServerFn({ method: "POST" })
  .middleware([adminOnly])
  .validator((data: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["draft", "published"]) }).parse(data),
  )
  .handler(({ data }) => setWritingStatus(data.id, data.status));

export const deleteWritingFn = createServerFn({ method: "POST" })
  .middleware([adminOnly])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    await deleteWriting(data.id);
    return { ok: true as const };
  });

// --- media library ----------------------------------------------------------------------------------

const mediaListSchema = z.object({
  q: z.string().max(80).optional(),
  kind: z.enum(["image", "pdf", "document", "archive", "other"]).optional(),
  page: z.number().int().min(1).max(1000).default(1),
});
export const listMediaAssetsFn = createServerFn({ method: "GET" })
  .middleware([adminOnly])
  .validator((data: unknown) => mediaListSchema.parse(data ?? {}))
  .handler(({ data }) => listMediaAssets(data));

export const createMediaUploadFn = createServerFn({ method: "POST" })
  .middleware([adminOnly])
  .validator((data: unknown) =>
    z
      .object({ filename: z.string().min(1).max(300), size: z.number().int().positive() })
      .parse(data),
  )
  .handler(({ data }) => createMediaUpload(data));

export const finalizeMediaUploadFn = createServerFn({ method: "POST" })
  .middleware([adminOnly])
  .validator((data: unknown) =>
    z
      .object({
        path: z.string().min(1).max(200),
        filename: z.string().max(300),
        altText: z.string().max(300),
      })
      .parse(data),
  )
  .handler(({ data }) => finalizeMediaUpload(data));

export const deleteMediaAssetFn = createServerFn({ method: "POST" })
  .middleware([adminOnly])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    await deleteMediaAsset(data.id);
    return { ok: true as const };
  });

// --- personalize: the editable home-page sections -------------------------------------------------------

const sectionKey = z.enum(SECTION_KEYS);

export const listSectionFn = createServerFn({ method: "GET" })
  .middleware([adminOnly])
  .validator((data: unknown) => z.object({ key: sectionKey }).parse(data))
  .handler(({ data }) => listSectionRows(data.key));

export const saveSectionRowFn = createServerFn({ method: "POST" })
  .middleware([adminOnly])
  .validator((data: unknown) =>
    z
      .object({
        key: sectionKey,
        id: z.string().uuid().optional(),
        values: z.record(z.string(), z.unknown()),
        published: z.boolean(),
      })
      .parse(data),
  )
  .handler(({ data }) =>
    saveSectionRow(data.key, {
      id: data.id,
      values: data.values,
      published: data.published,
    }),
  );

export const setSectionRowPublishedFn = createServerFn({ method: "POST" })
  .middleware([adminOnly])
  .validator((data: unknown) =>
    z.object({ key: sectionKey, id: z.string().uuid(), published: z.boolean() }).parse(data),
  )
  .handler(({ data }) => setSectionRowPublished(data.key, data.id, data.published));

export const deleteSectionRowFn = createServerFn({ method: "POST" })
  .middleware([adminOnly])
  .validator((data: unknown) => z.object({ key: sectionKey, id: z.string().uuid() }).parse(data))
  .handler(({ data }) => deleteSectionRow(data.key, data.id));

export const reorderSectionFn = createServerFn({ method: "POST" })
  .middleware([adminOnly])
  .validator((data: unknown) =>
    z.object({ key: sectionKey, ids: z.array(z.string().uuid()).max(200) }).parse(data),
  )
  .handler(({ data }) => reorderSectionRows(data.key, data.ids));

export const getProfileFn = createServerFn({ method: "GET" })
  .middleware([adminOnly])
  .handler(() => getAdminProfile());

export const saveProfileFn = createServerFn({ method: "POST" })
  .middleware([adminOnly])
  .validator((data: unknown) => z.object({ values: z.record(z.string(), z.unknown()) }).parse(data))
  .handler(({ data }) => saveAdminProfile(data.values));
