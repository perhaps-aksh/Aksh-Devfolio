import * as React from "react";
import { Link, useBlocker, useRouter } from "@tanstack/react-router";
import { ExternalLink, Loader2, Save, Send, Trash2, X } from "lucide-react";

import type { AdminWritingDetail, ContentStructure, PostStatus } from "@/lib/admin-types";
import { deleteWritingFn, saveWritingFn } from "@/lib/admin.functions";
import { normalizeTags, slugify } from "@/lib/blog-utils";
import { uploadImage } from "@/lib/image-upload";
import { EMPTY_DOC, type PMNode } from "@/lib/rich-text";
import { WRITING_TYPES } from "@/lib/writings-types";

import { ConfirmDialog } from "./ConfirmDialog";
import { ImageField } from "./ImageField";
import { errorMessage, formatDateTime, fromLocalInput, toLocalInput } from "./format";
import { useToast } from "./toast";
import { Banner, PageHeader } from "./ui";

// TipTap and everything it needs is fetched only when an editor is actually opened.
const RichTextEditor = React.lazy(() => import("./RichTextEditor"));

type Props = { writing: AdminWritingDetail | null; structure: ContentStructure };

const NONE = "";

export function WritingEditor({ writing, structure }: Props) {
  const router = useRouter();
  const toast = useToast();

  const [id, setId] = React.useState(writing?.id);
  const [title, setTitle] = React.useState(writing?.title ?? "");
  const [slug, setSlug] = React.useState(writing?.slug ?? "");
  const [slugTouched, setSlugTouched] = React.useState(Boolean(writing));
  const [subtitle, setSubtitle] = React.useState(writing?.subtitle ?? "");
  const [excerpt, setExcerpt] = React.useState(writing?.excerpt ?? "");
  const [type, setType] = React.useState(writing?.type ?? "thought");
  const [tags, setTags] = React.useState<string[]>(writing?.tags ?? []);
  const [tagInput, setTagInput] = React.useState("");
  const [cover, setCover] = React.useState<string | null>(writing?.cover_image ?? null);
  const [coverAlt, setCoverAlt] = React.useState(writing?.cover_alt ?? "");
  const [status, setStatus] = React.useState<PostStatus>(writing?.status ?? "draft");
  const [featured, setFeatured] = React.useState(writing?.featured ?? false);
  const [publishAt, setPublishAt] = React.useState(toLocalInput(writing?.published_at));
  const [content, setContent] = React.useState<PMNode>(
    (writing?.content as PMNode | undefined) ?? EMPTY_DOC,
  );

  const [collectionId, setCollectionId] = React.useState(writing?.collection_id ?? NONE);
  const [chapterId, setChapterId] = React.useState(writing?.chapter_id ?? NONE);
  const [sectionId, setSectionId] = React.useState(writing?.section_id ?? NONE);
  const [seriesId, setSeriesId] = React.useState(writing?.series_id ?? NONE);
  const [seriesOrder, setSeriesOrder] = React.useState(
    writing?.series_order ? String(writing.series_order) : "",
  );

  const [dirty, setDirty] = React.useState(false);
  const dirtyRef = React.useRef(false);
  const markDirty = React.useCallback((value: boolean) => {
    dirtyRef.current = value;
    setDirty(value);
  }, []);
  const [saving, setSaving] = React.useState<"draft" | "publish" | null>(null);
  const [error, setError] = React.useState("");
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const touch =
    <T,>(setter: React.Dispatch<React.SetStateAction<T>>) =>
    (value: React.SetStateAction<T>) => {
      setter(value);
      markDirty(true);
    };

  const blocker = useBlocker({
    shouldBlockFn: () => dirtyRef.current,
    enableBeforeUnload: () => dirtyRef.current,
    withResolver: true,
  });

  const chaptersInCollection = structure.chapters.filter((c) => c.collection_id === collectionId);
  const scheduled =
    status === "published" &&
    publishAt !== "" &&
    (fromLocalInput(publishAt) ?? "") > new Date().toISOString();

  const save = React.useCallback(
    async (target: PostStatus) => {
      if (saving) return;
      setError("");
      if (!title.trim()) {
        setError("A title is required.");
        return;
      }
      setSaving(target === "draft" ? "draft" : "publish");
      try {
        const saved = await saveWritingFn({
          data: {
            ...(id ? { id } : {}),
            title,
            slug: slug || slugify(title),
            subtitle,
            excerpt,
            content,
            type,
            cover_image: cover,
            cover_alt: coverAlt,
            status: target,
            featured,
            tags,
            collection_id: collectionId || null,
            chapter_id: chapterId || null,
            section_id: sectionId || null,
            series_id: seriesId || null,
            series_order: seriesId && seriesOrder ? Number(seriesOrder) : null,
            published_at: fromLocalInput(publishAt),
          },
        });
        markDirty(false);
        setStatus(saved.status);
        setSlug(saved.slug);
        setPublishAt(toLocalInput(saved.published_at));
        toast(
          "ok",
          target === "published"
            ? status === "published"
              ? "Changes published."
              : "Writing published."
            : "Draft saved.",
        );
        if (!id) {
          setId(saved.id);
          await router.navigate({
            to: "/admin/writings/$id/edit",
            params: { id: saved.id },
            replace: true,
          });
        } else {
          await router.invalidate();
        }
      } catch (err) {
        const message = errorMessage(err);
        setError(message);
        toast("error", message);
      } finally {
        setSaving(null);
      }
    },
    [
      saving,
      title,
      id,
      slug,
      subtitle,
      excerpt,
      content,
      type,
      cover,
      coverAlt,
      featured,
      tags,
      collectionId,
      chapterId,
      sectionId,
      seriesId,
      seriesOrder,
      publishAt,
      status,
      router,
      toast,
    ],
  );

  const saveRef = React.useRef(save);
  saveRef.current = save;
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveRef.current(status);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status]);

  const addTags = (raw: string) => {
    const next = normalizeTags([...tags, ...raw.split(",")]);
    touch(setTags)(next);
    setTagInput("");
  };

  const remove = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await deleteWritingFn({ data: { id } });
      markDirty(false);
      toast("ok", "Writing deleted.");
      await router.navigate({ to: "/admin/writings" });
    } catch (err) {
      toast("error", errorMessage(err));
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const busy = saving !== null;

  return (
    <>
      <PageHeader
        kicker={writing ? "EDIT WRITING" : "NEW WRITING"}
        jp="随想"
        title={writing ? "Edit writing" : "New writing"}
      >
        <div className="adm-savebar">
          {dirty ? <span className="adm-dirty">● Unsaved changes</span> : null}
          <Link to="/admin/writings" className="adm-btn is-ghost">
            Back
          </Link>
          <button
            type="button"
            className="adm-btn is-ghost"
            disabled={busy}
            onClick={() => void save("draft")}
          >
            {saving === "draft" ? <Loader2 size={14} className="adm-spin" /> : <Save size={14} />}
            {status === "published" ? "Unpublish" : "Save draft"}
          </button>
          <button
            type="button"
            className="adm-btn"
            disabled={busy}
            onClick={() => void save("published")}
          >
            {saving === "publish" ? <Loader2 size={14} className="adm-spin" /> : <Send size={14} />}
            {status === "published"
              ? scheduled
                ? "Update schedule"
                : "Update"
              : scheduled
                ? "Schedule"
                : "Publish"}
          </button>
        </div>
      </PageHeader>

      {error ? <Banner tone="warn">{error}</Banner> : null}
      {type === "poem" ? (
        <Banner tone="info">
          Poem mode: line breaks and blank lines are preserved exactly as typed on the public page —
          no need to fight the formatting.
        </Banner>
      ) : null}

      <div className="adm-editor-grid">
        <div>
          <div className="adm-field">
            <label className="adm-label" htmlFor="w-title">
              Title
            </label>
            <input
              id="w-title"
              className="adm-input is-title"
              placeholder="What if this is where I begin?"
              maxLength={200}
              value={title}
              onChange={(e) => {
                touch(setTitle)(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
            />
          </div>

          <div className="adm-field">
            <label className="adm-label" htmlFor="w-slug">
              Slug — /writings/{slug || "…"}
            </label>
            <input
              id="w-slug"
              className="adm-input"
              spellCheck={false}
              autoCapitalize="none"
              maxLength={120}
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                touch(setSlug)(slugify(e.target.value, 120, { trailing: true }));
              }}
              onBlur={() => setSlug((current) => slugify(current, 120))}
            />
          </div>

          <div className="adm-field">
            <label className="adm-label" htmlFor="w-subtitle">
              Subtitle (optional)
            </label>
            <input
              id="w-subtitle"
              className="adm-input"
              maxLength={300}
              placeholder="A short line under the title"
              value={subtitle}
              onChange={(e) => touch(setSubtitle)(e.target.value)}
            />
          </div>

          <div className="adm-field">
            <label className="adm-label" htmlFor="w-excerpt">
              Excerpt ({excerpt.length}/400)
            </label>
            <textarea
              id="w-excerpt"
              className="adm-textarea"
              rows={3}
              maxLength={400}
              placeholder="A short summary shown in listings. Leave blank to use the start of the piece."
              value={excerpt}
              onChange={(e) => touch(setExcerpt)(e.target.value)}
            />
          </div>

          <div className="adm-field">
            <span className="adm-label">Writing</span>
            <React.Suspense
              fallback={
                <div className="rte">
                  <div className="rte-loading">LOADING EDITOR…</div>
                </div>
              }
            >
              <RichTextEditor
                value={content}
                onChange={(doc) => {
                  setContent(doc);
                  markDirty(true);
                }}
                onUploadImage={(file) => uploadImage(file, "blog-images")}
                onError={(message) => toast("error", message)}
              />
            </React.Suspense>
          </div>
        </div>

        <aside className="adm-side-col">
          <section className="adm-panel">
            <div className="adm-panel-head">
              <h2 className="adm-panel-title">Publishing</h2>
              <span
                className={`adm-badge ${status === "published" ? (scheduled ? "is-sched" : "is-live") : ""}`}
              >
                {status === "published" ? (scheduled ? "scheduled" : "published") : "draft"}
              </span>
            </div>
            <div className="adm-panel-body">
              <div className="adm-field">
                <label className="adm-label" htmlFor="w-date">
                  Publish date
                </label>
                <input
                  id="w-date"
                  className="adm-input"
                  type="datetime-local"
                  value={publishAt}
                  onChange={(e) => touch(setPublishAt)(e.target.value)}
                />
                <p className="adm-hint">
                  Leave empty to publish immediately. A future date schedules it.
                </p>
              </div>
              <label className="adm-check" style={{ marginBottom: 0 }}>
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(e) => touch(setFeatured)(e.target.checked)}
                />{" "}
                Featured
              </label>
              {writing ? (
                <>
                  <p className="adm-hint" style={{ margin: "12px 0" }}>
                    Last saved {formatDateTime(writing.updated_at)}
                  </p>
                  <a
                    className="adm-btn is-ghost is-sm"
                    href={`/writings/${writing.slug}?preview=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink size={13} /> {status === "published" ? "View live" : "Preview"}
                  </a>
                </>
              ) : (
                <p className="adm-hint" style={{ marginTop: 12 }}>
                  Save once to get a preview link.
                </p>
              )}
            </div>
          </section>

          <section className="adm-panel">
            <div className="adm-panel-head">
              <h2 className="adm-panel-title">Type</h2>
            </div>
            <div className="adm-panel-body">
              <div className="adm-chips" style={{ marginTop: 0, marginBottom: 10 }}>
                {WRITING_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`adm-tab ${type === t ? "is-on" : ""}`}
                    style={{ padding: "6px 10px" }}
                    onClick={() => touch(setType)(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <input
                className="adm-input"
                maxLength={40}
                placeholder="Or type a custom type"
                value={type}
                onChange={(e) => touch(setType)(e.target.value)}
              />
            </div>
          </section>

          <section className="adm-panel">
            <div className="adm-panel-head">
              <h2 className="adm-panel-title">Organize</h2>
            </div>
            <div className="adm-panel-body">
              <div className="adm-field">
                <label className="adm-label" htmlFor="w-collection">
                  Collection
                </label>
                <select
                  id="w-collection"
                  className="adm-select"
                  value={collectionId}
                  onChange={(e) => {
                    touch(setCollectionId)(e.target.value);
                    setChapterId(NONE);
                  }}
                >
                  <option value={NONE}>None</option>
                  {structure.collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="adm-field">
                <label className="adm-label" htmlFor="w-chapter">
                  Chapter
                </label>
                <select
                  id="w-chapter"
                  className="adm-select"
                  value={chapterId}
                  disabled={!collectionId}
                  onChange={(e) => touch(setChapterId)(e.target.value)}
                >
                  <option value={NONE}>None</option>
                  {chaptersInCollection.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
                {!collectionId ? <p className="adm-hint">Choose a collection first.</p> : null}
              </div>
              <div className="adm-field">
                <label className="adm-label" htmlFor="w-section">
                  Section
                </label>
                <select
                  id="w-section"
                  className="adm-select"
                  value={sectionId}
                  onChange={(e) => touch(setSectionId)(e.target.value)}
                >
                  <option value={NONE}>None</option>
                  {structure.sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="adm-row" style={{ marginBottom: 0 }}>
                <div className="adm-field">
                  <label className="adm-label" htmlFor="w-series">
                    Series
                  </label>
                  <select
                    id="w-series"
                    className="adm-select"
                    value={seriesId}
                    onChange={(e) => touch(setSeriesId)(e.target.value)}
                  >
                    <option value={NONE}>None</option>
                    {structure.series.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="adm-field">
                  <label className="adm-label" htmlFor="w-series-order">
                    Part #
                  </label>
                  <input
                    id="w-series-order"
                    className="adm-input"
                    type="number"
                    min={1}
                    max={100000}
                    disabled={!seriesId}
                    value={seriesOrder}
                    onChange={(e) => touch(setSeriesOrder)(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="adm-panel">
            <div className="adm-panel-head">
              <h2 className="adm-panel-title">Tags</h2>
            </div>
            <div className="adm-panel-body">
              <input
                className="adm-input"
                placeholder="Type a tag, press Enter"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    if (tagInput.trim()) addTags(tagInput);
                  } else if (e.key === "Backspace" && !tagInput && tags.length)
                    touch(setTags)(tags.slice(0, -1));
                }}
                onBlur={() => tagInput.trim() && addTags(tagInput)}
              />
              {tags.length ? (
                <div className="adm-chips">
                  {tags.map((tag) => (
                    <span key={tag} className="adm-chip">
                      #{tag}
                      <button
                        type="button"
                        aria-label={`Remove tag ${tag}`}
                        onClick={() => touch(setTags)(tags.filter((t) => t !== tag))}
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </section>

          <section className="adm-panel">
            <div className="adm-panel-head">
              <h2 className="adm-panel-title">Cover image</h2>
            </div>
            <div className="adm-panel-body">
              <ImageField
                bucket="blog-images"
                label="Image"
                value={cover}
                onChange={(url) => {
                  setCover(url);
                  markDirty(true);
                }}
                hint="Optional. Resized and converted to WebP automatically."
              />
              <div className="adm-field" style={{ marginBottom: 0 }}>
                <label className="adm-label" htmlFor="w-cover-alt">
                  Alt text
                </label>
                <input
                  id="w-cover-alt"
                  className="adm-input"
                  maxLength={200}
                  placeholder="Describe the image for screen readers"
                  value={coverAlt}
                  onChange={(e) => touch(setCoverAlt)(e.target.value)}
                />
              </div>
            </div>
          </section>

          {writing ? (
            <button
              type="button"
              className="adm-btn is-danger"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={14} /> Delete writing
            </button>
          ) : null}
        </aside>
      </div>

      <ConfirmDialog
        open={blocker.status === "blocked"}
        title="Leave without saving?"
        body="You have unsaved changes. If you leave now they will be lost."
        confirmLabel="Discard changes"
        danger
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this writing?"
        body={`"${title || "Untitled"}" will be permanently removed and its public page will stop working. This can't be undone.`}
        confirmLabel="Delete writing"
        danger
        busy={deleting}
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
