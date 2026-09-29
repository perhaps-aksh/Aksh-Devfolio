import * as React from "react";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { Eye, EyeOff, ExternalLink, Pencil, Plus, Search, Star, Trash2 } from "lucide-react";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { errorMessage, formatDate } from "@/components/admin/format";
import { useToast } from "@/components/admin/toast";
import { EmptyState, PageHeader, Panel } from "@/components/admin/ui";
import type { AdminWritingRow, PostStatus } from "@/lib/admin-types";
import { deleteWritingFn, listAdminWritingsFn, setWritingStatusFn } from "@/lib/admin.functions";

type Search = {
  q?: string | undefined;
  status?: PostStatus | undefined;
  page?: number | undefined;
};

export const Route = createFileRoute("/_admin/admin/writings/")({
  validateSearch: (search: Record<string, unknown>): Search => {
    const out: Search = {};
    const q = typeof search["q"] === "string" ? search["q"].trim().slice(0, 80) : "";
    const page = Number(search["page"]);
    if (q) out.q = q;
    if (search["status"] === "draft" || search["status"] === "published")
      out.status = search["status"];
    if (Number.isInteger(page) && page > 1) out.page = page;
    return out;
  },
  loaderDeps: ({ search }) => ({ q: search.q, status: search.status, page: search.page ?? 1 }),
  loader: ({ deps }) => listAdminWritingsFn({ data: deps }),
  head: () => ({ meta: [{ title: "Writings — AKSH Admin" }] }),
  component: WritingsList,
});

const isScheduled = (w: AdminWritingRow) =>
  w.status === "published" && w.published_at !== null && w.published_at > new Date().toISOString();

function WritingsList() {
  const { items, total, page, pageSize } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/writings/" });
  const router = useRouter();
  const toast = useToast();

  const [query, setQuery] = React.useState(search.q ?? "");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [toDelete, setToDelete] = React.useState<AdminWritingRow | null>(null);

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
  const unfiltered = !search.q && !search.status;

  const toggle = async (w: AdminWritingRow) => {
    setBusyId(w.id);
    try {
      await setWritingStatusFn({
        data: { id: w.id, status: w.status === "published" ? "draft" : "published" },
      });
      toast("ok", w.status === "published" ? "Unpublished." : "Published.");
      await router.invalidate();
    } catch (error) {
      toast("error", errorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setBusyId(toDelete.id);
    try {
      await deleteWritingFn({ data: { id: toDelete.id } });
      toast("ok", "Writing deleted.");
      setToDelete(null);
      await router.invalidate();
    } catch (error) {
      toast("error", errorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <PageHeader kicker="CONTENT" jp="随想" title="Writings">
        <Link to="/admin/writings/new" className="adm-btn">
          <Plus size={14} /> New writing
        </Link>
      </PageHeader>

      <Panel title={`${total} ${total === 1 ? "writing" : "writings"}`} flush>
        <div className="adm-toolbar">
          <div className="adm-search">
            <Search size={15} strokeWidth={1.6} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, slug or type"
              aria-label="Search writings"
            />
          </div>
          <div className="adm-tabs" role="group" aria-label="Filter by status">
            {([undefined, "published", "draft"] as const).map((status) => (
              <Link
                key={status ?? "all"}
                to="/admin/writings"
                search={{ ...search, status, page: undefined }}
                className={`adm-tab ${search.status === status ? "is-on" : ""}`}
                aria-current={search.status === status ? "true" : undefined}
              >
                {status === undefined ? "All" : status === "published" ? "Published" : "Drafts"}
              </Link>
            ))}
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyState title={unfiltered ? "No writings yet" : "No writings match"}>
            {unfiltered
              ? "Poems, thoughts, questions, stories — write the first one."
              : "Try a different search or filter."}
          </EmptyState>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table is-stack">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {items.map((w) => (
                  <tr key={w.id}>
                    <td data-label="Title">
                      <Link
                        to="/admin/writings/$id/edit"
                        params={{ id: w.id }}
                        className="adm-cell-title"
                      >
                        {w.featured ? (
                          <Star
                            size={12}
                            style={{ marginRight: 6, color: "var(--hl-red)" }}
                            fill="currentColor"
                          />
                        ) : null}
                        {w.title}
                      </Link>
                      <span className="adm-cell-sub">/writings/{w.slug}</span>
                    </td>
                    <td data-label="Type">
                      <span className="adm-mono">{w.type}</span>
                    </td>
                    <td data-label="Status">
                      <span
                        className={`adm-badge ${w.status === "published" ? (isScheduled(w) ? "is-sched" : "is-live") : ""}`}
                      >
                        {w.status === "published"
                          ? isScheduled(w)
                            ? "scheduled"
                            : "published"
                          : "draft"}
                      </span>
                    </td>
                    <td data-label="Updated">
                      <span className="adm-mono">{formatDate(w.updated_at)}</span>
                    </td>
                    <td>
                      <div className="adm-row-actions">
                        <Link
                          to="/admin/writings/$id/edit"
                          params={{ id: w.id }}
                          className="adm-btn is-ghost is-icon"
                          aria-label={`Edit ${w.title}`}
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </Link>
                        <a
                          className="adm-btn is-ghost is-icon"
                          href={`/writings/${w.slug}?preview=1`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${w.status === "published" ? "View" : "Preview"} ${w.title}`}
                          title={w.status === "published" ? "View" : "Preview"}
                        >
                          <ExternalLink size={14} />
                        </a>
                        <button
                          type="button"
                          className="adm-btn is-ghost is-icon"
                          disabled={busyId === w.id}
                          onClick={() => void toggle(w)}
                          aria-label={
                            w.status === "published" ? `Unpublish ${w.title}` : `Publish ${w.title}`
                          }
                          title={w.status === "published" ? "Unpublish" : "Publish"}
                        >
                          {w.status === "published" ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button
                          type="button"
                          className="adm-btn is-danger is-icon"
                          onClick={() => setToDelete(w)}
                          aria-label={`Delete ${w.title}`}
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 ? (
          <div className="adm-pager">
            {page > 1 ? (
              <Link
                to="/admin/writings"
                search={{ ...search, page: page - 1 > 1 ? page - 1 : undefined }}
                className="adm-btn is-ghost is-sm"
              >
                ← Prev
              </Link>
            ) : (
              <span />
            )}
            <span>
              PAGE {page} / {pages}
            </span>
            {page < pages ? (
              <Link
                to="/admin/writings"
                search={{ ...search, page: page + 1 }}
                className="adm-btn is-ghost is-sm"
              >
                Next →
              </Link>
            ) : (
              <span />
            )}
          </div>
        ) : null}
      </Panel>

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this writing?"
        body={
          toDelete
            ? `"${toDelete.title}" will be permanently removed and its public page will stop working. This can't be undone.`
            : ""
        }
        confirmLabel="Delete writing"
        danger
        busy={busyId !== null && busyId === toDelete?.id}
        onConfirm={() => void remove()}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
