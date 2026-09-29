import * as React from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  EyeOff,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { ImageField } from "@/components/admin/ImageField";
import { PersonalizeTabs } from "@/components/admin/PersonalizeTabs";
import { errorMessage } from "@/components/admin/format";
import { useToast } from "@/components/admin/toast";
import { Banner, EmptyState, PageHeader, Panel } from "@/components/admin/ui";
import type { AdminProject } from "@/lib/admin-types";
import {
  deleteProjectFn,
  listAdminProjectsFn,
  reorderProjectsFn,
  saveProjectFn,
} from "@/lib/admin.functions";
import { slugify } from "@/lib/blog-utils";

export const Route = createFileRoute("/_admin/admin/projects")({
  loader: () => listAdminProjectsFn(),
  head: () => ({ meta: [{ title: "Projects — AKSH Admin" }] }),
  component: Projects,
});

const thumbOf = (p: Pick<AdminProject, "image_url">) => p.image_url || null;

type Draft = {
  id?: string;
  title: string;
  slug: string;
  year: string;
  category: string;
  description: string;
  technologies: string[];
  github_url: string;
  live_url: string;
  image_url: string | null;
  featured: boolean;
  published: boolean;
};

const blank = (): Draft => ({
  title: "",
  slug: "",
  year: String(new Date().getFullYear()),
  category: "",
  description: "",
  technologies: [],
  github_url: "",
  live_url: "",
  image_url: null,
  featured: false,
  published: true,
});

const fromProject = (p: AdminProject): Draft => ({
  id: p.id,
  title: p.title,
  slug: p.slug,
  year: p.year,
  category: p.category,
  description: p.description,
  technologies: p.technologies,
  github_url: p.github_url ?? "",
  live_url: p.live_url ?? "",
  image_url: p.image_url,
  featured: p.featured,
  published: p.published,
});

function Projects() {
  const loaded = Route.useLoaderData();
  const router = useRouter();
  const toast = useToast();

  const [items, setItems] = React.useState(loaded);
  React.useEffect(() => setItems(loaded), [loaded]);

  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [techInput, setTechInput] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState("");
  const [toDelete, setToDelete] = React.useState<AdminProject | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const formRef = React.useRef<HTMLElement>(null);

  const open = (next: Draft, touched: boolean) => {
    setDraft(next);
    setSlugTouched(touched);
    setTechInput("");
    setFormError("");
    window.setTimeout(
      () => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      30,
    );
  };

  const patch = (partial: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...partial } : d));

  const addTech = (raw: string) => {
    if (!draft) return;
    const next = [...draft.technologies];
    for (const part of raw.split(",")) {
      const value = part.trim();
      if (value && !next.some((t) => t.toLowerCase() === value.toLowerCase()) && next.length < 16)
        next.push(value);
    }
    patch({ technologies: next });
    setTechInput("");
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft || saving) return;
    if (!draft.title.trim()) {
      setFormError("A title is required.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await saveProjectFn({
        data: {
          ...(draft.id ? { id: draft.id } : {}),
          slug: draft.slug || slugify(draft.title, 80),
          title: draft.title,
          year: draft.year,
          category: draft.category,
          description: draft.description,
          image_url: draft.image_url,
          technologies: draft.technologies,
          github_url: draft.github_url.trim() || null,
          live_url: draft.live_url.trim() || null,
          featured: draft.featured,
          published: draft.published,
        },
      });
      toast("ok", draft.id ? "Project updated." : "Project added.");
      setDraft(null);
      await router.invalidate();
    } catch (error) {
      const message = errorMessage(error);
      setFormError(message);
      toast("error", message);
    } finally {
      setSaving(false);
    }
  };

  const move = async (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setItems(next);
    try {
      await reorderProjectsFn({ data: { ids: next.map((p) => p.id) } });
      await router.invalidate();
    } catch (error) {
      setItems(items);
      toast("error", errorMessage(error));
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteProjectFn({ data: { id: toDelete.id } });
      toast("ok", "Project deleted.");
      setToDelete(null);
      await router.invalidate();
    } catch (error) {
      toast("error", errorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <PageHeader kicker="SITE / PERSONALIZE" jp="作品" title="Projects">
        <button type="button" className="adm-btn" onClick={() => open(blank(), false)}>
          <Plus size={14} /> Add project
        </button>
      </PageHeader>

      <PersonalizeTabs current="projects" />

      {draft ? (
        <section
          className="adm-panel"
          ref={formRef}
          style={{ marginBottom: 20 }}
          aria-label={draft.id ? "Edit project" : "New project"}
        >
          <div className="adm-panel-head">
            <h2 className="adm-panel-title">{draft.id ? "Edit project" : "New project"}</h2>
            <button
              type="button"
              className="adm-btn is-ghost is-icon"
              aria-label="Close form"
              onClick={() => setDraft(null)}
            >
              <X size={15} />
            </button>
          </div>
          <form className="adm-panel-body" onSubmit={save} noValidate>
            {formError ? <Banner tone="warn">{formError}</Banner> : null}
            <div
              className="adm-editor-grid"
              style={{ gridTemplateColumns: "minmax(0, 1fr) 300px" }}
            >
              <div>
                <div className="adm-row">
                  <div className="adm-field">
                    <label className="adm-label" htmlFor="pr-title">
                      Title
                    </label>
                    <input
                      id="pr-title"
                      className="adm-input"
                      value={draft.title}
                      maxLength={120}
                      onChange={(e) =>
                        patch({
                          title: e.target.value,
                          ...(slugTouched ? {} : { slug: slugify(e.target.value, 80) }),
                        })
                      }
                      autoFocus
                    />
                  </div>
                  <div className="adm-field">
                    <label className="adm-label" htmlFor="pr-slug">
                      Slug
                    </label>
                    <input
                      id="pr-slug"
                      className="adm-input"
                      value={draft.slug}
                      maxLength={80}
                      spellCheck={false}
                      autoCapitalize="none"
                      onChange={(e) => {
                        setSlugTouched(true);
                        patch({ slug: slugify(e.target.value, 80, { trailing: true }) });
                      }}
                      onBlur={() => patch({ slug: slugify(draft.slug, 80) })}
                    />
                  </div>
                </div>
                <div className="adm-row">
                  <div className="adm-field">
                    <label className="adm-label" htmlFor="pr-category">
                      Category
                    </label>
                    <input
                      id="pr-category"
                      className="adm-input"
                      value={draft.category}
                      maxLength={60}
                      placeholder="e.g. Web Experience"
                      onChange={(e) => patch({ category: e.target.value })}
                    />
                  </div>
                  <div className="adm-field">
                    <label className="adm-label" htmlFor="pr-year">
                      Year
                    </label>
                    <input
                      id="pr-year"
                      className="adm-input"
                      value={draft.year}
                      maxLength={12}
                      onChange={(e) => patch({ year: e.target.value })}
                    />
                  </div>
                </div>
                <div className="adm-field">
                  <label className="adm-label" htmlFor="pr-desc">
                    Description ({draft.description.length}/600)
                  </label>
                  <textarea
                    id="pr-desc"
                    className="adm-textarea"
                    rows={3}
                    maxLength={600}
                    value={draft.description}
                    onChange={(e) => patch({ description: e.target.value })}
                  />
                </div>
                <div className="adm-field">
                  <label className="adm-label" htmlFor="pr-tech">
                    Technologies
                  </label>
                  <input
                    id="pr-tech"
                    className="adm-input"
                    value={techInput}
                    placeholder="Type a technology, press Enter"
                    onChange={(e) => setTechInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        if (techInput.trim()) addTech(techInput);
                      }
                    }}
                    onBlur={() => techInput.trim() && addTech(techInput)}
                  />
                  {draft.technologies.length ? (
                    <div className="adm-chips">
                      {draft.technologies.map((t) => (
                        <span key={t} className="adm-chip">
                          {t}
                          <button
                            type="button"
                            aria-label={`Remove ${t}`}
                            onClick={() =>
                              patch({ technologies: draft.technologies.filter((x) => x !== t) })
                            }
                          >
                            <X size={11} />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="adm-row">
                  <div className="adm-field">
                    <label className="adm-label" htmlFor="pr-gh">
                      GitHub URL
                    </label>
                    <input
                      id="pr-gh"
                      className="adm-input"
                      type="url"
                      inputMode="url"
                      placeholder="https://github.com/…"
                      value={draft.github_url}
                      onChange={(e) => patch({ github_url: e.target.value })}
                    />
                  </div>
                  <div className="adm-field">
                    <label className="adm-label" htmlFor="pr-live">
                      Live demo URL
                    </label>
                    <input
                      id="pr-live"
                      className="adm-input"
                      type="url"
                      inputMode="url"
                      placeholder="https://…"
                      value={draft.live_url}
                      onChange={(e) => patch({ live_url: e.target.value })}
                    />
                  </div>
                </div>
                <p className="adm-hint" style={{ marginBottom: 14 }}>
                  Leave a link empty to hide it on the project card.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 22 }}>
                  <label className="adm-check">
                    <input
                      type="checkbox"
                      checked={draft.featured}
                      onChange={(e) => patch({ featured: e.target.checked })}
                    />{" "}
                    Featured
                  </label>
                  <label className="adm-check">
                    <input
                      type="checkbox"
                      checked={draft.published}
                      onChange={(e) => patch({ published: e.target.checked })}
                    />{" "}
                    Visible on the site
                  </label>
                </div>
              </div>
              <div>
                <ImageField
                  bucket="project-images"
                  label="Cover image"
                  value={draft.image_url}
                  onChange={(url) => patch({ image_url: url })}
                  hint="Shown on the project card. Pictures are resized and converted to WebP automatically."
                />
              </div>
            </div>
            <div className="adm-actions" style={{ marginTop: 8 }}>
              <button type="submit" className="adm-btn" disabled={saving}>
                {saving ? <Loader2 size={14} className="adm-spin" /> : null}
                {draft.id ? "Save changes" : "Add project"}
              </button>
              <button type="button" className="adm-btn is-ghost" onClick={() => setDraft(null)}>
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <Panel
        title={`${items.length} ${items.length === 1 ? "project" : "projects"}`}
        action={<span className="adm-panel-link">Order = order on the site</span>}
        flush
      >
        {items.length === 0 ? (
          <EmptyState title="No projects yet">
            Add your first project to show it in the portfolio's Selected Work.
          </EmptyState>
        ) : (
          items.map((p, index) => {
            const thumb = thumbOf(p);
            return (
              <div key={p.id} className="adm-proj">
                <div className="adm-proj-thumb">
                  {thumb ? <img src={thumb} alt="" loading="lazy" /> : null}
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3 className="adm-proj-title">
                    {p.title}
                    {p.featured ? (
                      <Star size={14} aria-label="Featured" fill="currentColor" />
                    ) : null}
                    {!p.published ? (
                      <span className="adm-badge">
                        <EyeOff size={11} /> hidden
                      </span>
                    ) : null}
                  </h3>
                  <p className="adm-proj-meta">
                    {[p.category, p.year].filter(Boolean).join(" · ")} · /{p.slug}
                  </p>
                  {p.technologies.length ? (
                    <div className="adm-proj-tech">
                      {p.technologies.map((t) => (
                        <span key={t} className="adm-chip">
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="adm-row-actions">
                  <button
                    type="button"
                    className="adm-btn is-ghost is-icon"
                    onClick={() => void move(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${p.title} up`}
                    title="Move up"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    className="adm-btn is-ghost is-icon"
                    onClick={() => void move(index, 1)}
                    disabled={index === items.length - 1}
                    aria-label={`Move ${p.title} down`}
                    title="Move down"
                  >
                    <ArrowDown size={14} />
                  </button>
                  {p.live_url ? (
                    <a
                      className="adm-btn is-ghost is-icon"
                      href={p.live_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open ${p.title} live demo`}
                      title="Live demo"
                    >
                      <ExternalLink size={14} />
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="adm-btn is-ghost is-icon"
                    onClick={() => open(fromProject(p), true)}
                    aria-label={`Edit ${p.title}`}
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    className="adm-btn is-danger is-icon"
                    onClick={() => setToDelete(p)}
                    aria-label={`Delete ${p.title}`}
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </Panel>

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this project?"
        body={
          toDelete
            ? `"${toDelete.title}" will be removed from the portfolio. This can't be undone.`
            : ""
        }
        confirmLabel="Delete project"
        danger
        busy={deleting}
        onConfirm={() => void remove()}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
