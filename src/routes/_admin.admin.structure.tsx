import * as React from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { ImageField } from "@/components/admin/ImageField";
import { errorMessage } from "@/components/admin/format";
import { useToast } from "@/components/admin/toast";
import { EmptyState, PageHeader, Panel } from "@/components/admin/ui";
import type { AdminChapter, AdminCollection, AdminSection, AdminSeries } from "@/lib/admin-types";
import {
  deleteChapterFn,
  deleteCollectionFn,
  deleteSectionFn,
  deleteSeriesFn,
  getContentStructureFn,
  reorderChaptersFn,
  reorderCollectionsFn,
  reorderSectionsFn,
  saveChapterFn,
  saveCollectionFn,
  saveSectionFn,
  saveSeriesFn,
} from "@/lib/admin.functions";
import { slugify } from "@/lib/blog-utils";

export const Route = createFileRoute("/_admin/admin/structure")({
  loader: () => getContentStructureFn(),
  head: () => ({ meta: [{ title: "Content structure — AKSH Admin" }] }),
  component: StructurePage,
});

type Tab = "collections" | "sections" | "series";
const TABS: { id: Tab; label: string; jp: string }[] = [
  { id: "collections", label: "Collections & Chapters", jp: "全集" },
  { id: "sections", label: "Sections", jp: "部門" },
  { id: "series", label: "Series", jp: "連載" },
];

function StructurePage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>("collections");

  return (
    <>
      <PageHeader kicker="ORGANIZATION" jp="構成" title="Content structure" />
      <div
        className="adm-tabs"
        role="tablist"
        aria-label="Content structure sections"
        style={{ marginBottom: 18 }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`adm-tab ${tab === t.id ? "is-on" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "collections" ? (
        <CollectionsPanel
          collections={data.collections}
          chapters={data.chapters}
          onChange={() => router.invalidate()}
        />
      ) : null}
      {tab === "sections" ? (
        <SectionsPanel sections={data.sections} onChange={() => router.invalidate()} />
      ) : null}
      {tab === "series" ? (
        <SeriesPanel series={data.series} onChange={() => router.invalidate()} />
      ) : null}
    </>
  );
}

// ============================================================================================
// Collections + chapters
// ============================================================================================

type CollectionDraft = {
  id?: string;
  slug: string;
  title: string;
  description: string;
  cover_image: string | null;
};
const blankCollection = (): CollectionDraft => ({
  slug: "",
  title: "",
  description: "",
  cover_image: null,
});

type ChapterDraft = {
  id?: string;
  collection_id: string;
  slug: string;
  title: string;
  subtitle: string;
};
const blankChapter = (collectionId: string): ChapterDraft => ({
  collection_id: collectionId,
  slug: "",
  title: "",
  subtitle: "",
});

function CollectionsPanel({
  collections,
  chapters,
  onChange,
}: {
  collections: AdminCollection[];
  chapters: AdminChapter[];
  onChange: () => void;
}) {
  const toast = useToast();
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [collectionDraft, setCollectionDraft] = React.useState<CollectionDraft | null>(null);
  const [collectionTouched, setCollectionTouched] = React.useState(false);
  const [chapterDraft, setChapterDraft] = React.useState<ChapterDraft | null>(null);
  const [chapterTouched, setChapterTouched] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [toDelete, setToDelete] = React.useState<{
    kind: "collection" | "chapter";
    id: string;
    label: string;
  } | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const toggle = (id: string) =>
    setExpanded((set) => {
      const n = new Set(set);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const chaptersOf = (collectionId: string) =>
    chapters.filter((c) => c.collection_id === collectionId);

  const saveCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectionDraft || saving) return;
    if (!collectionDraft.title.trim()) {
      setError("A title is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await saveCollectionFn({
        data: {
          ...(collectionDraft.id ? { id: collectionDraft.id } : {}),
          slug: collectionDraft.slug || slugify(collectionDraft.title, 100),
          title: collectionDraft.title,
          description: collectionDraft.description,
          cover_image: collectionDraft.cover_image,
        },
      });
      toast("ok", collectionDraft.id ? "Collection updated." : "Collection added.");
      setCollectionDraft(null);
      onChange();
    } catch (err) {
      const msg = errorMessage(err);
      setError(msg);
      toast("error", msg);
    } finally {
      setSaving(false);
    }
  };

  const saveChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chapterDraft || saving) return;
    if (!chapterDraft.title.trim()) {
      setError("A title is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await saveChapterFn({
        data: {
          ...(chapterDraft.id ? { id: chapterDraft.id } : {}),
          collection_id: chapterDraft.collection_id,
          slug: chapterDraft.slug || slugify(chapterDraft.title, 100),
          title: chapterDraft.title,
          subtitle: chapterDraft.subtitle,
        },
      });
      toast("ok", chapterDraft.id ? "Chapter updated." : "Chapter added.");
      setChapterDraft(null);
      setExpanded((set) => new Set(set).add(chapterDraft.collection_id));
      onChange();
    } catch (err) {
      const msg = errorMessage(err);
      setError(msg);
      toast("error", msg);
    } finally {
      setSaving(false);
    }
  };

  const moveCollection = async (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= collections.length) return;
    const next = [...collections];
    [next[index], next[target]] = [next[target]!, next[index]!];
    try {
      await reorderCollectionsFn({ data: { ids: next.map((c) => c.id) } });
      onChange();
    } catch (err) {
      toast("error", errorMessage(err));
    }
  };
  const moveChapter = async (collectionId: string, index: number, delta: -1 | 1) => {
    const list = chaptersOf(collectionId);
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target]!, next[index]!];
    try {
      await reorderChaptersFn({ data: { ids: next.map((c) => c.id) } });
      onChange();
    } catch (err) {
      toast("error", errorMessage(err));
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      if (toDelete.kind === "collection") await deleteCollectionFn({ data: { id: toDelete.id } });
      else await deleteChapterFn({ data: { id: toDelete.id } });
      toast("ok", `${toDelete.kind === "collection" ? "Collection" : "Chapter"} deleted.`);
      setToDelete(null);
      onChange();
    } catch (err) {
      toast("error", errorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <PageHeaderRow
        title={`${collections.length} ${collections.length === 1 ? "collection" : "collections"}`}
        action={
          <button
            type="button"
            className="adm-btn"
            onClick={() => {
              setCollectionDraft(blankCollection());
              setCollectionTouched(false);
              setError("");
            }}
          >
            <Plus size={14} /> Add collection
          </button>
        }
      />

      {collectionDraft ? (
        <StructureForm
          title={collectionDraft.id ? "Edit collection" : "New collection"}
          error={error}
          saving={saving}
          onCancel={() => setCollectionDraft(null)}
          onSubmit={saveCollection}
        >
          <div className="adm-row">
            <div className="adm-field">
              <label className="adm-label" htmlFor="col-title">
                Title
              </label>
              <input
                id="col-title"
                className="adm-input"
                autoFocus
                value={collectionDraft.title}
                maxLength={160}
                onChange={(e) =>
                  setCollectionDraft((d) =>
                    d
                      ? {
                          ...d,
                          title: e.target.value,
                          ...(collectionTouched ? {} : { slug: slugify(e.target.value, 100) }),
                        }
                      : d,
                  )
                }
              />
            </div>
            <div className="adm-field">
              <label className="adm-label" htmlFor="col-slug">
                Slug — /writings/collections/{collectionDraft.slug || "…"}
              </label>
              <input
                id="col-slug"
                className="adm-input"
                value={collectionDraft.slug}
                maxLength={100}
                spellCheck={false}
                onChange={(e) => {
                  setCollectionTouched(true);
                  setCollectionDraft((d) =>
                    d ? { ...d, slug: slugify(e.target.value, 100, { trailing: true }) } : d,
                  );
                }}
                onBlur={() =>
                  setCollectionDraft((d) => (d ? { ...d, slug: slugify(d.slug, 100) } : d))
                }
              />
            </div>
          </div>
          <div className="adm-field">
            <label className="adm-label" htmlFor="col-desc">
              Description
            </label>
            <textarea
              id="col-desc"
              className="adm-textarea"
              rows={2}
              maxLength={600}
              value={collectionDraft.description}
              onChange={(e) =>
                setCollectionDraft((d) => (d ? { ...d, description: e.target.value } : d))
              }
            />
          </div>
          <ImageField
            bucket="project-images"
            label="Cover image (optional)"
            value={collectionDraft.cover_image}
            onChange={(url) => setCollectionDraft((d) => (d ? { ...d, cover_image: url } : d))}
          />
        </StructureForm>
      ) : null}

      <Panel title="Collections" jp="全集" flush>
        {collections.length === 0 ? (
          <EmptyState title="No collections yet">
            Group longer, sequential writing — like a personal story told in chapters — into a
            collection.
          </EmptyState>
        ) : (
          collections.map((col, index) => {
            const isOpen = expanded.has(col.id);
            const list = chaptersOf(col.id);
            return (
              <div key={col.id} className="adm-struct-row">
                <div className="adm-struct-main">
                  <button
                    type="button"
                    className="adm-struct-toggle"
                    onClick={() => toggle(col.id)}
                    aria-expanded={isOpen}
                    aria-label={isOpen ? `Collapse ${col.title}` : `Expand ${col.title}`}
                  >
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  <div className="grow">
                    <span className="adm-cell-title">{col.title}</span>
                    <span className="adm-cell-sub">
                      /writings/collections/{col.slug} · {list.length}{" "}
                      {list.length === 1 ? "chapter" : "chapters"}
                    </span>
                  </div>
                  <div className="adm-row-actions">
                    <button
                      type="button"
                      className="adm-btn is-ghost is-icon"
                      onClick={() => moveCollection(index, -1)}
                      disabled={index === 0}
                      aria-label={`Move ${col.title} up`}
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      className="adm-btn is-ghost is-icon"
                      onClick={() => moveCollection(index, 1)}
                      disabled={index === collections.length - 1}
                      aria-label={`Move ${col.title} down`}
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      className="adm-btn is-ghost is-sm"
                      onClick={() => {
                        setCollectionDraft({
                          id: col.id,
                          slug: col.slug,
                          title: col.title,
                          description: col.description,
                          cover_image: col.cover_image,
                        });
                        setCollectionTouched(true);
                        setError("");
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="adm-btn is-danger is-icon"
                      onClick={() =>
                        setToDelete({ kind: "collection", id: col.id, label: col.title })
                      }
                      aria-label={`Delete ${col.title}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {isOpen ? (
                  <div className="adm-struct-nested">
                    {list.length === 0 ? (
                      <p className="adm-hint" style={{ padding: "10px 0" }}>
                        No chapters yet.
                      </p>
                    ) : null}
                    {list.map((ch, ci) => (
                      <div key={ch.id} className="adm-struct-chapter">
                        <span className="adm-mono">{String(ci + 1).padStart(2, "0")}</span>
                        <div className="grow">
                          <span className="adm-cell-title">{ch.title}</span>
                          {ch.subtitle ? <span className="adm-cell-sub">{ch.subtitle}</span> : null}
                        </div>
                        <div className="adm-row-actions">
                          <button
                            type="button"
                            className="adm-btn is-ghost is-icon"
                            onClick={() => moveChapter(col.id, ci, -1)}
                            disabled={ci === 0}
                            aria-label="Move chapter up"
                          >
                            <ArrowUp size={13} />
                          </button>
                          <button
                            type="button"
                            className="adm-btn is-ghost is-icon"
                            onClick={() => moveChapter(col.id, ci, 1)}
                            disabled={ci === list.length - 1}
                            aria-label="Move chapter down"
                          >
                            <ArrowDown size={13} />
                          </button>
                          <button
                            type="button"
                            className="adm-btn is-ghost is-sm"
                            onClick={() => {
                              setChapterDraft({
                                id: ch.id,
                                collection_id: col.id,
                                slug: ch.slug,
                                title: ch.title,
                                subtitle: ch.subtitle,
                              });
                              setChapterTouched(true);
                              setError("");
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="adm-btn is-danger is-icon"
                            onClick={() =>
                              setToDelete({ kind: "chapter", id: ch.id, label: ch.title })
                            }
                            aria-label={`Delete ${ch.title}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="adm-btn is-ghost is-sm"
                      style={{ marginTop: 8 }}
                      onClick={() => {
                        setChapterDraft(blankChapter(col.id));
                        setChapterTouched(false);
                        setError("");
                      }}
                    >
                      <Plus size={12} /> Add chapter
                    </button>

                    {chapterDraft && chapterDraft.collection_id === col.id ? (
                      <StructureForm
                        title={chapterDraft.id ? "Edit chapter" : "New chapter"}
                        error={error}
                        saving={saving}
                        onCancel={() => setChapterDraft(null)}
                        onSubmit={saveChapter}
                        nested
                      >
                        <div className="adm-row">
                          <div className="adm-field">
                            <label className="adm-label" htmlFor="ch-title">
                              Title
                            </label>
                            <input
                              id="ch-title"
                              className="adm-input"
                              autoFocus
                              value={chapterDraft.title}
                              maxLength={160}
                              onChange={(e) =>
                                setChapterDraft((d) =>
                                  d
                                    ? {
                                        ...d,
                                        title: e.target.value,
                                        ...(chapterTouched
                                          ? {}
                                          : { slug: slugify(e.target.value, 100) }),
                                      }
                                    : d,
                                )
                              }
                            />
                          </div>
                          <div className="adm-field">
                            <label className="adm-label" htmlFor="ch-slug">
                              Slug
                            </label>
                            <input
                              id="ch-slug"
                              className="adm-input"
                              value={chapterDraft.slug}
                              maxLength={100}
                              spellCheck={false}
                              onChange={(e) => {
                                setChapterTouched(true);
                                setChapterDraft((d) =>
                                  d
                                    ? {
                                        ...d,
                                        slug: slugify(e.target.value, 100, { trailing: true }),
                                      }
                                    : d,
                                );
                              }}
                              onBlur={() =>
                                setChapterDraft((d) =>
                                  d ? { ...d, slug: slugify(d.slug, 100) } : d,
                                )
                              }
                            />
                          </div>
                        </div>
                        <div className="adm-field" style={{ marginBottom: 0 }}>
                          <label className="adm-label" htmlFor="ch-subtitle">
                            Subtitle (optional)
                          </label>
                          <input
                            id="ch-subtitle"
                            className="adm-input"
                            value={chapterDraft.subtitle}
                            maxLength={300}
                            onChange={(e) =>
                              setChapterDraft((d) => (d ? { ...d, subtitle: e.target.value } : d))
                            }
                          />
                        </div>
                      </StructureForm>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </Panel>

      <ConfirmDialog
        open={toDelete !== null}
        title={`Delete this ${toDelete?.kind ?? "item"}?`}
        body={
          toDelete?.kind === "collection"
            ? `"${toDelete.label}" and all of its chapters will be removed. Writings and posts inside it are kept, just detached from this collection.`
            : `"${toDelete?.label}" will be removed. Writings and posts in it are kept, just detached from this chapter.`
        }
        confirmLabel="Delete"
        danger
        busy={deleting}
        onConfirm={() => void remove()}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}

// ============================================================================================
// Sections
// ============================================================================================

type SectionDraft = { id?: string; slug: string; title: string; description: string };
const blankSection = (): SectionDraft => ({ slug: "", title: "", description: "" });

function SectionsPanel({ sections, onChange }: { sections: AdminSection[]; onChange: () => void }) {
  const toast = useToast();
  const [draft, setDraft] = React.useState<SectionDraft | null>(null);
  const [touched, setTouched] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [toDelete, setToDelete] = React.useState<AdminSection | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft || saving) return;
    if (!draft.title.trim()) {
      setError("A title is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await saveSectionFn({
        data: {
          ...(draft.id ? { id: draft.id } : {}),
          slug: draft.slug || slugify(draft.title, 100),
          title: draft.title,
          description: draft.description,
        },
      });
      toast("ok", draft.id ? "Section updated." : "Section added.");
      setDraft(null);
      onChange();
    } catch (err) {
      const msg = errorMessage(err);
      setError(msg);
      toast("error", msg);
    } finally {
      setSaving(false);
    }
  };

  const move = async (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[index], next[target]] = [next[target]!, next[index]!];
    try {
      await reorderSectionsFn({ data: { ids: next.map((s) => s.id) } });
      onChange();
    } catch (err) {
      toast("error", errorMessage(err));
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteSectionFn({ data: { id: toDelete.id } });
      toast("ok", "Section deleted.");
      setToDelete(null);
      onChange();
    } catch (err) {
      toast("error", errorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <PageHeaderRow
        title={`${sections.length} ${sections.length === 1 ? "section" : "sections"}`}
        action={
          <button
            type="button"
            className="adm-btn"
            onClick={() => {
              setDraft(blankSection());
              setTouched(false);
              setError("");
            }}
          >
            <Plus size={14} /> Add section
          </button>
        }
      />
      {draft ? (
        <StructureForm
          title={draft.id ? "Edit section" : "New section"}
          error={error}
          saving={saving}
          onCancel={() => setDraft(null)}
          onSubmit={save}
        >
          <div className="adm-row">
            <div className="adm-field">
              <label className="adm-label" htmlFor="sec-title">
                Title
              </label>
              <input
                id="sec-title"
                className="adm-input"
                autoFocus
                value={draft.title}
                maxLength={160}
                onChange={(e) =>
                  setDraft((d) =>
                    d
                      ? {
                          ...d,
                          title: e.target.value,
                          ...(touched ? {} : { slug: slugify(e.target.value, 100) }),
                        }
                      : d,
                  )
                }
              />
            </div>
            <div className="adm-field">
              <label className="adm-label" htmlFor="sec-slug">
                Slug
              </label>
              <input
                id="sec-slug"
                className="adm-input"
                value={draft.slug}
                maxLength={100}
                spellCheck={false}
                onChange={(e) => {
                  setTouched(true);
                  setDraft((d) =>
                    d ? { ...d, slug: slugify(e.target.value, 100, { trailing: true }) } : d,
                  );
                }}
                onBlur={() => setDraft((d) => (d ? { ...d, slug: slugify(d.slug, 100) } : d))}
              />
            </div>
          </div>
          <div className="adm-field" style={{ marginBottom: 0 }}>
            <label className="adm-label" htmlFor="sec-desc">
              Description (optional)
            </label>
            <textarea
              id="sec-desc"
              className="adm-textarea"
              rows={2}
              maxLength={400}
              value={draft.description}
              onChange={(e) => setDraft((d) => (d ? { ...d, description: e.target.value } : d))}
            />
          </div>
        </StructureForm>
      ) : null}
      <Panel title="Sections" jp="部門" flush>
        {sections.length === 0 ? (
          <EmptyState title="No sections yet">
            A flat topic a piece of writing or a post can belong to — "Life", "Coding &
            Development", "Cybersecurity" — independent of any collection.
          </EmptyState>
        ) : (
          sections.map((s, i) => (
            <div key={s.id} className="adm-struct-row">
              <div className="adm-struct-main">
                <div className="grow">
                  <span className="adm-cell-title">{s.title}</span>
                  <span className="adm-cell-sub">{s.description || `/${s.slug}`}</span>
                </div>
                <div className="adm-row-actions">
                  <button
                    type="button"
                    className="adm-btn is-ghost is-icon"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label="Move up"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    className="adm-btn is-ghost is-icon"
                    onClick={() => move(i, 1)}
                    disabled={i === sections.length - 1}
                    aria-label="Move down"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    className="adm-btn is-ghost is-sm"
                    onClick={() => {
                      setDraft({
                        id: s.id,
                        slug: s.slug,
                        title: s.title,
                        description: s.description,
                      });
                      setTouched(true);
                      setError("");
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="adm-btn is-danger is-icon"
                    onClick={() => setToDelete(s)}
                    aria-label={`Delete ${s.title}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </Panel>
      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this section?"
        body={`"${toDelete?.title}" will be removed. Content in it is kept, just detached from this section.`}
        confirmLabel="Delete"
        danger
        busy={deleting}
        onConfirm={() => void remove()}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}

// ============================================================================================
// Series
// ============================================================================================

type SeriesDraft = {
  id?: string;
  slug: string;
  title: string;
  description: string;
  cover_image: string | null;
};
const blankSeries = (): SeriesDraft => ({
  slug: "",
  title: "",
  description: "",
  cover_image: null,
});

function SeriesPanel({ series, onChange }: { series: AdminSeries[]; onChange: () => void }) {
  const toast = useToast();
  const [draft, setDraft] = React.useState<SeriesDraft | null>(null);
  const [touched, setTouched] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [toDelete, setToDelete] = React.useState<AdminSeries | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft || saving) return;
    if (!draft.title.trim()) {
      setError("A title is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await saveSeriesFn({
        data: {
          ...(draft.id ? { id: draft.id } : {}),
          slug: draft.slug || slugify(draft.title, 100),
          title: draft.title,
          description: draft.description,
          cover_image: draft.cover_image,
        },
      });
      toast("ok", draft.id ? "Series updated." : "Series added.");
      setDraft(null);
      onChange();
    } catch (err) {
      const msg = errorMessage(err);
      setError(msg);
      toast("error", msg);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteSeriesFn({ data: { id: toDelete.id } });
      toast("ok", "Series deleted.");
      setToDelete(null);
      onChange();
    } catch (err) {
      toast("error", errorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <PageHeaderRow
        title={`${series.length} ${series.length === 1 ? "series" : "series"}`}
        action={
          <button
            type="button"
            className="adm-btn"
            onClick={() => {
              setDraft(blankSeries());
              setTouched(false);
              setError("");
            }}
          >
            <Plus size={14} /> Add series
          </button>
        }
      />
      {draft ? (
        <StructureForm
          title={draft.id ? "Edit series" : "New series"}
          error={error}
          saving={saving}
          onCancel={() => setDraft(null)}
          onSubmit={save}
        >
          <div className="adm-row">
            <div className="adm-field">
              <label className="adm-label" htmlFor="ser-title">
                Title
              </label>
              <input
                id="ser-title"
                className="adm-input"
                autoFocus
                value={draft.title}
                maxLength={160}
                onChange={(e) =>
                  setDraft((d) =>
                    d
                      ? {
                          ...d,
                          title: e.target.value,
                          ...(touched ? {} : { slug: slugify(e.target.value, 100) }),
                        }
                      : d,
                  )
                }
              />
            </div>
            <div className="adm-field">
              <label className="adm-label" htmlFor="ser-slug">
                Slug
              </label>
              <input
                id="ser-slug"
                className="adm-input"
                value={draft.slug}
                maxLength={100}
                spellCheck={false}
                onChange={(e) => {
                  setTouched(true);
                  setDraft((d) =>
                    d ? { ...d, slug: slugify(e.target.value, 100, { trailing: true }) } : d,
                  );
                }}
                onBlur={() => setDraft((d) => (d ? { ...d, slug: slugify(d.slug, 100) } : d))}
              />
            </div>
          </div>
          <div className="adm-field">
            <label className="adm-label" htmlFor="ser-desc">
              Description (optional)
            </label>
            <textarea
              id="ser-desc"
              className="adm-textarea"
              rows={2}
              maxLength={600}
              value={draft.description}
              onChange={(e) => setDraft((d) => (d ? { ...d, description: e.target.value } : d))}
            />
          </div>
          <ImageField
            bucket="project-images"
            label="Cover image (optional)"
            value={draft.cover_image}
            onChange={(url) => setDraft((d) => (d ? { ...d, cover_image: url } : d))}
          />
        </StructureForm>
      ) : null}
      <Panel title="Series" jp="連載" flush>
        {series.length === 0 ? (
          <EmptyState title="No series yet">
            An ordered run of otherwise-independent pieces — "Part 1", "Part 2" — that a writing or
            post can opt into.
          </EmptyState>
        ) : (
          series.map((s) => (
            <div key={s.id} className="adm-struct-row">
              <div className="adm-struct-main">
                <div className="grow">
                  <span className="adm-cell-title">{s.title}</span>
                  <span className="adm-cell-sub">{s.description || `/${s.slug}`}</span>
                </div>
                <div className="adm-row-actions">
                  <button
                    type="button"
                    className="adm-btn is-ghost is-sm"
                    onClick={() => {
                      setDraft({
                        id: s.id,
                        slug: s.slug,
                        title: s.title,
                        description: s.description,
                        cover_image: s.cover_image,
                      });
                      setTouched(true);
                      setError("");
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="adm-btn is-danger is-icon"
                    onClick={() => setToDelete(s)}
                    aria-label={`Delete ${s.title}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </Panel>
      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this series?"
        body={`"${toDelete?.title}" will be removed. Content in it is kept, just detached from this series.`}
        confirmLabel="Delete"
        danger
        busy={deleting}
        onConfirm={() => void remove()}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}

// ============================================================================================
// Shared bits
// ============================================================================================

function PageHeaderRow({ title, action }: { title: string; action: React.ReactNode }) {
  return (
    <div className="adm-head" style={{ marginBottom: 14 }}>
      <p className="adm-mono" style={{ fontSize: 12 }}>
        {title}
      </p>
      <div className="adm-actions">{action}</div>
    </div>
  );
}

function StructureForm({
  title,
  error,
  saving,
  nested,
  onCancel,
  onSubmit,
  children,
}: {
  title: string;
  error: string;
  saving: boolean;
  nested?: boolean;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <section className={`adm-panel ${nested ? "is-nested" : ""}`} style={{ marginBottom: 18 }}>
      <div className="adm-panel-head">
        <h2 className="adm-panel-title">{title}</h2>
        <button
          type="button"
          className="adm-btn is-ghost is-icon"
          aria-label="Close form"
          onClick={onCancel}
        >
          <X size={15} />
        </button>
      </div>
      <form className="adm-panel-body" onSubmit={onSubmit} noValidate>
        {error ? (
          <p className="adm-error" style={{ marginBottom: 14 }}>
            {error}
          </p>
        ) : null}
        {children}
        <div className="adm-actions" style={{ marginTop: 8 }}>
          <button type="submit" className="adm-btn" disabled={saving}>
            {saving ? <Loader2 size={14} className="adm-spin" /> : null} Save
          </button>
          <button type="button" className="adm-btn is-ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
