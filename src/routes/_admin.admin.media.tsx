import * as React from "react";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import {
  Copy,
  Download,
  File,
  FileArchive,
  FileText,
  Film,
  Loader2,
  Search,
  Trash2,
  UploadCloud,
} from "lucide-react";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { errorMessage, formatDateTime } from "@/components/admin/format";
import { useToast } from "@/components/admin/toast";
import { EmptyState, PageHeader, Panel } from "@/components/admin/ui";
import type { AdminMediaAsset, MediaKind } from "@/lib/admin-types";
import { deleteMediaAssetFn, listMediaAssetsFn } from "@/lib/admin.functions";
import { MAX_MEDIA_MB, uploadMedia } from "@/lib/media-upload";

type Search = { q?: string | undefined; kind?: MediaKind | undefined; page?: number | undefined };
const KINDS: { id: MediaKind | undefined; label: string }[] = [
  { id: undefined, label: "All" },
  { id: "image", label: "Images" },
  { id: "video", label: "Videos" },
  { id: "pdf", label: "PDFs" },
  { id: "document", label: "Documents" },
  { id: "archive", label: "Archives" },
  { id: "other", label: "Other" },
];

export const Route = createFileRoute("/_admin/admin/media")({
  validateSearch: (search: Record<string, unknown>): Search => {
    const out: Search = {};
    const q = typeof search["q"] === "string" ? search["q"].trim().slice(0, 80) : "";
    const page = Number(search["page"]);
    const kind = search["kind"];
    if (q) out.q = q;
    if (
      kind === "image" ||
      kind === "video" ||
      kind === "pdf" ||
      kind === "document" ||
      kind === "archive" ||
      kind === "other"
    )
      out.kind = kind;
    if (Number.isInteger(page) && page > 1) out.page = page;
    return out;
  },
  loaderDeps: ({ search }) => ({ q: search.q, kind: search.kind, page: search.page ?? 1 }),
  loader: ({ deps }) => listMediaAssetsFn({ data: deps }),
  head: () => ({ meta: [{ title: "Media library — AKSH Admin" }] }),
  component: MediaLibrary,
});

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function KindIcon({ kind }: { kind: MediaKind }) {
  if (kind === "pdf" || kind === "document") return <FileText size={22} />;
  if (kind === "archive") return <FileArchive size={22} />;
  if (kind === "video") return <Film size={22} />;
  return <File size={22} />;
}

function MediaLibrary() {
  const { items, total, page, pageSize } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/media" });
  const router = useRouter();
  const toast = useToast();

  const [query, setQuery] = React.useState(search.q ?? "");
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState<string>("");
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [toDelete, setToDelete] = React.useState<AdminMediaAsset | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => setQuery(search.q ?? ""), [search.q]);
  React.useEffect(() => {
    if (query.trim() === (search.q ?? "")) return;
    const id = window.setTimeout(() => {
      void navigate({
        search: { ...search, q: query.trim() || undefined, page: undefined },
        replace: true,
      });
    }, 300);
    return () => window.clearTimeout(id);
  }, [query, search.q, navigate]);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    let ok = 0;
    const batch = Array.from(files).slice(0, 10);
    for (const [index, file] of batch.entries()) {
      const label = batch.length > 1 ? `${index + 1}/${batch.length} ` : "";
      setProgress(`${label}0%`);
      try {
        await uploadMedia(file, {
          onProgress: (fraction) => setProgress(`${label}${Math.round(fraction * 100)}%`),
        });
        ok++;
      } catch (error) {
        toast("error", `${file.name}: ${errorMessage(error)}`);
      }
    }
    if (ok) toast("ok", ok === 1 ? "File uploaded." : `${ok} files uploaded.`);
    setUploading(false);
    setProgress("");
    if (fileRef.current) fileRef.current.value = "";
    await router.invalidate();
  };

  const copy = async (asset: AdminMediaAsset) => {
    try {
      await navigator.clipboard.writeText(asset.url);
      setCopiedId(asset.id);
      window.setTimeout(() => setCopiedId((id) => (id === asset.id ? null : id)), 1600);
    } catch {
      window.prompt("Copy this URL", asset.url);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteMediaAssetFn({ data: { id: toDelete.id } });
      toast("ok", "File deleted.");
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
      <PageHeader kicker="ASSETS" jp="資料" title="Media library">
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          accept="image/*,video/mp4,video/webm,video/quicktime,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
          onChange={(e) => void upload(e.target.files)}
        />
        <button
          type="button"
          className="adm-btn"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? <Loader2 size={14} className="adm-spin" /> : <UploadCloud size={14} />}
          {uploading ? `Uploading ${progress}` : "Upload files"}
        </button>
      </PageHeader>
      <p className="adm-hint" style={{ marginTop: -10, marginBottom: 18 }}>
        Images, short videos (MP4 / WebM), PDFs, Word/Excel/PowerPoint documents, text files and zip
        archives, up to {MAX_MEDIA_MB} MB each. Copy a file's URL to link it from a post or writing
        — as a downloadable attachment, or paste it into the editor's image button for pictures.
      </p>

      <Panel title={`${total} ${total === 1 ? "file" : "files"}`} flush>
        <div className="adm-toolbar">
          <div className="adm-search">
            <Search size={15} strokeWidth={1.6} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search filenames"
              aria-label="Search media"
            />
          </div>
          <div className="adm-tabs" role="group" aria-label="Filter by type">
            {KINDS.map((k) => (
              <button
                key={k.id ?? "all"}
                type="button"
                className={`adm-tab ${search.kind === k.id ? "is-on" : ""}`}
                onClick={() =>
                  void navigate({ search: { ...search, kind: k.id, page: undefined } })
                }
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyState
            title={total === 0 && !search.q && !search.kind ? "No files yet" : "No files match"}
          >
            {total === 0 && !search.q && !search.kind
              ? "Upload an image, video, PDF or document to use it in a post, writing, project or achievement."
              : "Try a different search or filter."}
          </EmptyState>
        ) : (
          <ul className="adm-media-grid">
            {items.map((asset) => (
              <li key={asset.id} className="adm-media-card">
                <div className="adm-media-thumb">
                  {asset.kind === "image" ? (
                    <img src={asset.url} alt={asset.alt_text} loading="lazy" />
                  ) : asset.kind === "video" ? (
                    <video src={`${asset.url}#t=0.1`} preload="metadata" muted playsInline />
                  ) : (
                    <KindIcon kind={asset.kind} />
                  )}
                </div>
                <div className="adm-media-body">
                  <span className="adm-media-name" title={asset.filename}>
                    {asset.filename}
                  </span>
                  <span className="adm-mono">
                    {formatSize(asset.size_bytes)} · {formatDateTime(asset.created_at)}
                  </span>
                </div>
                <div className="adm-row-actions">
                  <button
                    type="button"
                    className="adm-btn is-ghost is-icon"
                    onClick={() => void copy(asset)}
                    aria-label={`Copy URL for ${asset.filename}`}
                    title="Copy URL"
                  >
                    {copiedId === asset.id ? (
                      <span className="adm-mono" style={{ fontSize: 9 }}>
                        OK
                      </span>
                    ) : (
                      <Copy size={13} />
                    )}
                  </button>
                  <a
                    className="adm-btn is-ghost is-icon"
                    href={asset.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${asset.filename}`}
                    title="Open"
                  >
                    <Download size={13} />
                  </a>
                  <button
                    type="button"
                    className="adm-btn is-danger is-icon"
                    onClick={() => setToDelete(asset)}
                    aria-label={`Delete ${asset.filename}`}
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {pages > 1 ? (
          <div className="adm-pager">
            {page > 1 ? (
              <button
                type="button"
                className="adm-btn is-ghost is-sm"
                onClick={() =>
                  void navigate({
                    search: { ...search, page: page - 1 > 1 ? page - 1 : undefined },
                  })
                }
              >
                ← Prev
              </button>
            ) : (
              <span />
            )}
            <span>
              PAGE {page} / {pages}
            </span>
            {page < pages ? (
              <button
                type="button"
                className="adm-btn is-ghost is-sm"
                onClick={() => void navigate({ search: { ...search, page: page + 1 } })}
              >
                Next →
              </button>
            ) : (
              <span />
            )}
          </div>
        ) : null}
      </Panel>

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this file?"
        body={
          toDelete
            ? `"${toDelete.filename}" will be permanently removed. If it's linked from a post or writing, that link will break.`
            : ""
        }
        confirmLabel="Delete file"
        danger
        busy={deleting}
        onConfirm={() => void remove()}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
