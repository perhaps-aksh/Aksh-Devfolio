import * as React from "react";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { Eye, EyeOff, ExternalLink, Pencil, Plus, Search, Trash2 } from "lucide-react";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { errorMessage, formatDate } from "@/components/admin/format";
import { useToast } from "@/components/admin/toast";
import { Banner, EmptyState, PageHeader, Panel } from "@/components/admin/ui";
import type { AdminPostRow, PostStatus } from "@/lib/admin-types";
import { deletePostFn, listAdminPostsFn, setPostStatusFn } from "@/lib/admin.functions";

type Search = {
  q?: string | undefined;
  status?: PostStatus | undefined;
  page?: number | undefined;
};

export const Route = createFileRoute("/_admin/admin/blogs/")({
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
  loader: ({ deps }) => listAdminPostsFn({ data: deps }),
  head: () => ({ meta: [{ title: "Blog posts — AKSH Admin" }] }),
  component: BlogList,
});

const isScheduled = (post: AdminPostRow) =>
  post.status === "published" &&
  post.published_at !== null &&
  post.published_at > new Date().toISOString();

function BlogList() {
  const { items, total, page, pageSize } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/blogs/" });
  const router = useRouter();
  const toast = useToast();

  const [query, setQuery] = React.useState(search.q ?? "");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [toDelete, setToDelete] = React.useState<AdminPostRow | null>(null);

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

  const toggle = async (post: AdminPostRow) => {
    setBusyId(post.id);
    try {
      await setPostStatusFn({
        data: { id: post.id, status: post.status === "published" ? "draft" : "published" },
      });
      toast("ok", post.status === "published" ? "Post unpublished." : "Post published.");
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
      await deletePostFn({ data: { id: toDelete.id } });
      toast("ok", "Post deleted.");
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
      <PageHeader kicker="CONTENT" jp="随筆" title="Blog posts">
        <Link to="/admin/blogs/new" className="adm-btn">
          <Plus size={14} /> New post
        </Link>
      </PageHeader>

      <Panel title={`${total} ${total === 1 ? "post" : "posts"}`} flush>
        <div className="adm-toolbar">
          <div className="adm-search">
            <Search size={15} strokeWidth={1.6} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, slug or category"
              aria-label="Search posts"
            />
          </div>
          <div className="adm-tabs" role="group" aria-label="Filter by status">
            {([undefined, "published", "draft"] as const).map((status) => (
              <Link
                key={status ?? "all"}
                to="/admin/blogs"
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
          <EmptyState title={unfiltered ? "No posts yet" : "No posts match"}>
            {unfiltered
              ? "Create your first article — it will appear on the blog as soon as you publish it."
              : "Try a different search or filter."}
          </EmptyState>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table is-stack">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {items.map((post) => (
                  <tr key={post.id}>
                    <td data-label="Title">
                      <Link
                        to="/admin/blogs/$id/edit"
                        params={{ id: post.id }}
                        className="adm-cell-title"
                      >
                        {post.title}
                      </Link>
                      <span className="adm-cell-sub">/blog/{post.slug}</span>
                    </td>
                    <td data-label="Category">
                      <span className="adm-mono">{post.category}</span>
                    </td>
                    <td data-label="Status">
                      <span
                        className={`adm-badge ${post.status === "published" ? (isScheduled(post) ? "is-sched" : "is-live") : ""}`}
                      >
                        {post.status === "published"
                          ? isScheduled(post)
                            ? "scheduled"
                            : "published"
                          : "draft"}
                      </span>
                    </td>
                    <td data-label="Updated">
                      <span className="adm-mono">{formatDate(post.updated_at)}</span>
                    </td>
                    <td>
                      <div className="adm-row-actions">
                        <Link
                          to="/admin/blogs/$id/edit"
                          params={{ id: post.id }}
                          className="adm-btn is-ghost is-icon"
                          aria-label={`Edit ${post.title}`}
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </Link>
                        <a
                          className="adm-btn is-ghost is-icon"
                          href={`/blog/${post.slug}?preview=1`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${post.status === "published" ? "View" : "Preview"} ${post.title}`}
                          title={post.status === "published" ? "View" : "Preview"}
                        >
                          <ExternalLink size={14} />
                        </a>
                        <button
                          type="button"
                          className="adm-btn is-ghost is-icon"
                          disabled={busyId === post.id}
                          onClick={() => void toggle(post)}
                          aria-label={
                            post.status === "published"
                              ? `Unpublish ${post.title}`
                              : `Publish ${post.title}`
                          }
                          title={post.status === "published" ? "Unpublish" : "Publish"}
                        >
                          {post.status === "published" ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button
                          type="button"
                          className="adm-btn is-danger is-icon"
                          onClick={() => setToDelete(post)}
                          aria-label={`Delete ${post.title}`}
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
                to="/admin/blogs"
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
                to="/admin/blogs"
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
        title="Delete this post?"
        body={
          toDelete
            ? `"${toDelete.title}" will be permanently removed and its public page will stop working. This can't be undone.`
            : ""
        }
        confirmLabel="Delete post"
        danger
        busy={busyId !== null && busyId === toDelete?.id}
        onConfirm={() => void remove()}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
