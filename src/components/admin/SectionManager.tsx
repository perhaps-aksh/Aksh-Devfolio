import * as React from "react";
import { useRouter } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import {
  deleteSectionRowFn,
  reorderSectionFn,
  saveSectionRowFn,
  setSectionRowPublishedFn,
} from "@/lib/admin.functions";
import {
  type FieldDef,
  type MediaKind,
  SECTIONS,
  type SectionKey,
  type SectionRow,
} from "@/lib/site-content";

import { ConfirmDialog } from "./ConfirmDialog";
import { errorMessage } from "./format";
import { MediaField } from "./MediaField";
import { TagField } from "./TagField";
import { useToast } from "./toast";
import { EmptyState, Panel } from "./ui";

type Values = Record<string, unknown>;
type Draft = { id?: string; values: Values; published: boolean };

const asString = (value: unknown) => (typeof value === "string" ? value : "");
const asList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

function blankValues(fields: readonly FieldDef[]): Values {
  const values: Values = {};
  for (const field of fields) {
    if (field.type === "tags") values[field.key] = [];
    else if (field.type === "media") {
      values[field.key] = null;
      if (field.kindKey) values[field.kindKey] = null;
    } else if (field.type === "select") values[field.key] = field.options?.[0]?.value ?? "";
    else values[field.key] = "";
  }
  return values;
}

function valuesFromRow(fields: readonly FieldDef[], row: SectionRow): Values {
  const values = blankValues(fields);
  for (const field of fields) {
    if (field.type === "tags") values[field.key] = asList(row[field.key]);
    else if (field.type === "media") {
      values[field.key] = asString(row[field.key]) || null;
      if (field.kindKey) values[field.kindKey] = asString(row[field.kindKey]) || null;
    } else values[field.key] = asString(row[field.key]) || values[field.key];
  }
  return values;
}

/** Fields that are short single-line inputs sit two to a row; everything else is full width. */
function isShort(field: FieldDef) {
  return (field.type === "text" || field.type === "select") && field.max <= 60 && !field.required;
}

function groupFields(fields: readonly FieldDef[]): FieldDef[][] {
  const groups: FieldDef[][] = [];
  for (const field of fields) {
    const last = groups[groups.length - 1];
    if (isShort(field) && last && last.length === 1 && isShort(last[0]!)) last.push(field);
    else groups.push([field]);
  }
  return groups;
}

function FieldInput({
  sectionKey,
  field,
  values,
  set,
}: {
  sectionKey: SectionKey;
  field: FieldDef;
  values: Values;
  set: (patch: Values) => void;
}) {
  const id = `sec-${sectionKey}-${field.key}`;
  const text = asString(values[field.key]);

  switch (field.type) {
    case "tags":
      return (
        <TagField
          id={id}
          label={field.label}
          value={asList(values[field.key])}
          onChange={(next) => set({ [field.key]: next })}
          maxLength={field.max}
          maxItems={field.maxItems ?? 12}
          hint={field.hint}
        />
      );
    case "media":
      return (
        <MediaField
          label={field.label}
          url={asString(values[field.key]) || null}
          kind={(asString(values[field.kindKey ?? ""]) || null) as MediaKind | null}
          onChange={(url, kind) =>
            set({ [field.key]: url, ...(field.kindKey ? { [field.kindKey]: kind } : {}) })
          }
          hint={field.hint}
        />
      );
    case "select":
      return (
        <div className="adm-field">
          <label className="adm-label" htmlFor={id}>
            {field.label}
          </label>
          <select
            id={id}
            className="adm-select"
            value={text}
            onChange={(event) => set({ [field.key]: event.target.value })}
          >
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      );
    case "longtext":
      return (
        <div className="adm-field">
          <label className="adm-label" htmlFor={id}>
            {field.label}{" "}
            <span className="adm-mono">
              {Array.from(text).length}/{field.max}
            </span>
          </label>
          <textarea
            id={id}
            className="adm-textarea"
            value={text}
            maxLength={field.max}
            placeholder={field.placeholder}
            onChange={(event) => set({ [field.key]: event.target.value })}
          />
          {field.hint ? <p className="adm-hint">{field.hint}</p> : null}
        </div>
      );
    default:
      return (
        <div className="adm-field">
          <label className="adm-label" htmlFor={id}>
            {field.label}
            {field.required ? " *" : ""}
          </label>
          <input
            id={id}
            className="adm-input"
            value={text}
            maxLength={field.max}
            placeholder={field.placeholder}
            required={field.required}
            onChange={(event) => set({ [field.key]: event.target.value })}
          />
          {field.hint ? <p className="adm-hint">{field.hint}</p> : null}
        </div>
      );
  }
}

function RowThumb({ row }: { row: SectionRow }) {
  const url = asString(row["media_url"]);
  if (!url) return null;
  return (
    <span className="adm-thumb" aria-hidden="true">
      {row["media_kind"] === "video" ? (
        <video src={`${url}#t=0.1`} muted playsInline preload="metadata" />
      ) : (
        <img src={url} alt="" loading="lazy" />
      )}
    </span>
  );
}

/**
 * The editor for one home-page list (journey, services, achievements…). Everything it renders — the
 * form fields, limits and labels — comes from the section's entry in the shared registry.
 */
export function SectionManager({
  sectionKey,
  rows,
  compact = false,
}: {
  sectionKey: SectionKey;
  rows: readonly SectionRow[];
  /** Smaller heading, for when it sits below another form on the same page. */
  compact?: boolean;
}) {
  const def = SECTIONS[sectionKey];
  const router = useRouter();
  const toast = useToast();

  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [toDelete, setToDelete] = React.useState<SectionRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const openNew = () => setDraft({ values: blankValues(def.fields), published: true });
  const openEdit = (row: SectionRow) =>
    setDraft({ id: row.id, values: valuesFromRow(def.fields, row), published: row.published });
  const patch = (next: Values) =>
    setDraft((current) =>
      current ? { ...current, values: { ...current.values, ...next } } : current,
    );

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft || saving) return;
    setSaving(true);
    try {
      await saveSectionRowFn({
        data: {
          key: sectionKey,
          ...(draft.id ? { id: draft.id } : {}),
          values: draft.values,
          published: draft.published,
        },
      });
      toast("ok", draft.id ? "Changes saved." : `Added to ${def.label}.`);
      setDraft(null);
      await router.invalidate();
    } catch (error) {
      toast("error", errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= rows.length) return;
    const ids = rows.map((row) => row.id);
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    setBusyId(rows[index]!.id);
    try {
      await reorderSectionFn({ data: { key: sectionKey, ids } });
      await router.invalidate();
    } catch (error) {
      toast("error", errorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const toggle = async (row: SectionRow) => {
    setBusyId(row.id);
    try {
      await setSectionRowPublishedFn({
        data: { key: sectionKey, id: row.id, published: !row.published },
      });
      toast("ok", row.published ? "Hidden from the site." : "Now visible on the site.");
      await router.invalidate();
    } catch (error) {
      toast("error", errorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteSectionRowFn({ data: { key: sectionKey, id: toDelete.id } });
      toast("ok", "Deleted.");
      if (draft?.id === toDelete.id) setDraft(null);
      setToDelete(null);
      await router.invalidate();
    } catch (error) {
      toast("error", errorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  const summary = (row: SectionRow): string => {
    const meta = def.metaField ? row[def.metaField] : null;
    if (Array.isArray(meta)) return meta.join(" · ");
    return typeof meta === "string" ? meta : "";
  };

  return (
    <>
      <Panel
        title={
          compact
            ? def.label
            : `${rows.length} ${rows.length === 1 ? def.singular : `${def.singular}s`}`
        }
        jp={def.jp}
        flush
        action={
          <button
            type="button"
            className="adm-btn is-sm"
            onClick={openNew}
            data-testid={`add-${sectionKey}`}
          >
            <Plus size={14} /> Add {def.singular}
          </button>
        }
      >
        {compact ? <p className="adm-hint adm-pad">{def.blurb}</p> : null}

        {draft && !draft.id ? (
          <form className="adm-inline-form" onSubmit={save} aria-label={`New ${def.singular}`}>
            <FormBody
              sectionKey={sectionKey}
              def={def}
              draft={draft}
              patch={patch}
              setDraft={setDraft}
              saving={saving}
              onCancel={() => setDraft(null)}
              title={`New ${def.singular}`}
            />
          </form>
        ) : null}

        {rows.length === 0 && !draft ? (
          <EmptyState title={`No ${def.label.toLowerCase()} yet`}>
            {def.blurb} Use “Add {def.singular}” to create the first one.
          </EmptyState>
        ) : (
          <div>
            {rows.map((row, index) => {
              const editing = draft?.id === row.id;
              return (
                <div key={row.id} className="adm-struct-row" data-testid={`row-${sectionKey}`}>
                  <div className="adm-struct-main">
                    <span className="adm-mono adm-index">{String(index + 1).padStart(2, "0")}</span>
                    <RowThumb row={row} />
                    <div className="grow" style={{ minWidth: 0, flex: 1 }}>
                      <span className="adm-cell-title">{asString(row[def.titleField])}</span>
                      {summary(row) ? <span className="adm-cell-sub">{summary(row)}</span> : null}
                    </div>
                    <span className={`adm-badge ${row.published ? "is-live" : ""}`}>
                      {row.published ? "Live" : "Hidden"}
                    </span>
                    <div className="adm-row-actions">
                      <button
                        type="button"
                        className="adm-btn is-ghost is-icon"
                        aria-label={`Move ${asString(row[def.titleField])} up`}
                        disabled={index === 0 || busyId !== null}
                        onClick={() => void move(index, -1)}
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        className="adm-btn is-ghost is-icon"
                        aria-label={`Move ${asString(row[def.titleField])} down`}
                        disabled={index === rows.length - 1 || busyId !== null}
                        onClick={() => void move(index, 1)}
                      >
                        <ArrowDown size={13} />
                      </button>
                      <button
                        type="button"
                        className="adm-btn is-ghost is-icon"
                        aria-label={`${row.published ? "Hide" : "Show"} ${asString(row[def.titleField])}`}
                        title={row.published ? "Hide from the site" : "Show on the site"}
                        disabled={busyId === row.id}
                        onClick={() => void toggle(row)}
                      >
                        {busyId === row.id ? (
                          <Loader2 size={13} className="adm-spin" />
                        ) : row.published ? (
                          <Eye size={13} />
                        ) : (
                          <EyeOff size={13} />
                        )}
                      </button>
                      <button
                        type="button"
                        className="adm-btn is-ghost is-icon"
                        aria-label={`Edit ${asString(row[def.titleField])}`}
                        onClick={() => (editing ? setDraft(null) : openEdit(row))}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        className="adm-btn is-danger is-icon"
                        aria-label={`Delete ${asString(row[def.titleField])}`}
                        onClick={() => setToDelete(row)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  {editing && draft ? (
                    <form
                      className="adm-inline-form"
                      onSubmit={save}
                      aria-label={`Edit ${asString(row[def.titleField])}`}
                    >
                      <FormBody
                        sectionKey={sectionKey}
                        def={def}
                        draft={draft}
                        patch={patch}
                        setDraft={setDraft}
                        saving={saving}
                        onCancel={() => setDraft(null)}
                        title={`Edit ${def.singular}`}
                      />
                    </form>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
        <p className="adm-hint adm-pad">{def.visibility}</p>
      </Panel>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={`Delete this ${def.singular}?`}
        body={
          toDelete
            ? `“${asString(toDelete[def.titleField])}” will be removed from the site. This can't be undone.`
            : ""
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

function FormBody({
  sectionKey,
  def,
  draft,
  patch,
  setDraft,
  saving,
  onCancel,
  title,
}: {
  sectionKey: SectionKey;
  def: (typeof SECTIONS)[SectionKey];
  draft: Draft;
  patch: (next: Values) => void;
  setDraft: React.Dispatch<React.SetStateAction<Draft | null>>;
  saving: boolean;
  onCancel: () => void;
  title: string;
}) {
  return (
    <>
      <p className="adm-kicker" style={{ marginBottom: 14 }}>
        {title.toUpperCase()}
      </p>
      {groupFields(def.fields).map((group) => (
        <div key={group.map((f) => f.key).join("+")} className={group.length > 1 ? "adm-row" : ""}>
          {group.map((field) => (
            <FieldInput
              key={field.key}
              sectionKey={sectionKey}
              field={field}
              values={draft.values}
              set={patch}
            />
          ))}
        </div>
      ))}
      <label className="adm-check" style={{ marginBottom: 16 }}>
        <input
          type="checkbox"
          checked={draft.published}
          onChange={(event) =>
            setDraft((current) =>
              current ? { ...current, published: event.target.checked } : current,
            )
          }
        />
        Visible on the site
      </label>
      <div className="adm-actions">
        <button type="submit" className="adm-btn" disabled={saving}>
          {saving ? <Loader2 size={14} className="adm-spin" /> : null}
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" className="adm-btn is-ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </>
  );
}
