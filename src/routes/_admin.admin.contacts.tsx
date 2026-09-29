import * as React from "react";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Mail, MailOpen, Search, Trash2 } from "lucide-react";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { errorMessage, formatDateTime, timeAgo } from "@/components/admin/format";
import { useToast } from "@/components/admin/toast";
import { EmptyState, PageHeader, Panel } from "@/components/admin/ui";
import type { AdminContact, ContactStatus } from "@/lib/admin-types";
import { deleteContactsFn, listContactsFn, markContactsFn } from "@/lib/admin.functions";

type Search = {
  status?: ContactStatus | undefined;
  q?: string | undefined;
  page?: number | undefined;
  open?: string | undefined;
};

export const Route = createFileRoute("/_admin/admin/contacts")({
  validateSearch: (search: Record<string, unknown>): Search => {
    const out: Search = {};
    const q = typeof search["q"] === "string" ? search["q"].trim().slice(0, 80) : "";
    const page = Number(search["page"]);
    if (q) out.q = q;
    if (search["status"] === "unread" || search["status"] === "read") out.status = search["status"];
    if (Number.isInteger(page) && page > 1) out.page = page;
    if (typeof search["open"] === "string" && /^[0-9a-f-]{36}$/i.test(search["open"]))
      out.open = search["open"];
    return out;
  },
  loaderDeps: ({ search }) => ({ status: search.status, q: search.q, page: search.page ?? 1 }),
  loader: ({ deps }) => listContactsFn({ data: deps }),
  head: () => ({ meta: [{ title: "Messages — AKSH Admin" }] }),
  component: Contacts,
});

function Contacts() {
  const loaded = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/contacts" });
  const router = useRouter();
  const toast = useToast();

  const [items, setItems] = React.useState<AdminContact[]>(loaded.items);
  const [unread, setUnread] = React.useState(loaded.unread);
  React.useEffect(() => {
    setItems(loaded.items);
    setUnread(loaded.unread);
  }, [loaded]);

  const [openId, setOpenId] = React.useState<string | null>(search.open ?? null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [query, setQuery] = React.useState(search.q ?? "");
  const [confirm, setConfirm] = React.useState<string[] | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => setQuery(search.q ?? ""), [search.q]);
  React.useEffect(() => {
    if (query.trim() === (search.q ?? "")) return;
    const id = window.setTimeout(() => {
      void navigate({
        search: { ...search, q: query.trim() || undefined, page: undefined, open: undefined },
        replace: true,
      });
    }, 300);
    return () => window.clearTimeout(id);
  }, [query, search.q, navigate]);

  const open = items.find((c) => c.id === openId) ?? null;
  const pages = Math.max(1, Math.ceil(loaded.total / loaded.pageSize));

  const setStatus = async (ids: string[], status: ContactStatus) => {
    const before = items;
    const beforeUnread = unread;
    const changed = items.filter((c) => ids.includes(c.id) && c.status !== status).length;
    setItems((list) => list.map((c) => (ids.includes(c.id) ? { ...c, status } : c)));
    setUnread((n) => Math.max(0, n + (status === "unread" ? changed : -changed)));
    try {
      await markContactsFn({ data: { ids, status } });
    } catch (error) {
      setItems(before);
      setUnread(beforeUnread);
      toast("error", errorMessage(error));
    }
  };

  const openMessage = (contact: AdminContact) => {
    setOpenId(contact.id);
    if (contact.status === "unread") void setStatus([contact.id], "read");
  };

  const remove = async () => {
    if (!confirm) return;
    setDeleting(true);
    try {
      await deleteContactsFn({ data: { ids: confirm } });
      toast(
        "ok",
        confirm.length === 1 ? "Message deleted." : `${confirm.length} messages deleted.`,
      );
      setSelected(new Set());
      if (openId && confirm.includes(openId)) setOpenId(null);
      setConfirm(null);
      await router.invalidate();
    } catch (error) {
      toast("error", errorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  const allOnPage = items.length > 0 && items.every((c) => selected.has(c.id));
  const toggleAll = () => setSelected(allOnPage ? new Set() : new Set(items.map((c) => c.id)));
  const toggleOne = (id: string) =>
    setSelected((set) => {
      const next = new Set(set);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <>
      <PageHeader kicker="INBOX" jp="連絡" title="Messages">
        <span className="adm-mono">{unread} UNREAD</span>
      </PageHeader>

      <Panel title="Contact form submissions" flush>
        <div className="adm-toolbar">
          <div className="adm-search">
            <Search size={15} strokeWidth={1.6} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email or message"
              aria-label="Search messages"
            />
          </div>
          <div className="adm-tabs" role="group" aria-label="Filter by status">
            {([undefined, "unread", "read"] as const).map((status) => (
              <Link
                key={status ?? "all"}
                to="/admin/contacts"
                search={{ ...search, status, page: undefined, open: undefined }}
                className={`adm-tab ${search.status === status ? "is-on" : ""}`}
                aria-current={search.status === status ? "true" : undefined}
              >
                {status === undefined
                  ? "All"
                  : status === "unread"
                    ? `Unread${unread ? ` (${unread})` : ""}`
                    : "Read"}
              </Link>
            ))}
          </div>
          {selected.size > 0 ? (
            <div className="adm-actions" style={{ marginLeft: "auto" }}>
              <span className="adm-mono">{selected.size} selected</span>
              <button
                type="button"
                className="adm-btn is-ghost is-sm"
                onClick={() => void setStatus([...selected], "read")}
              >
                <MailOpen size={13} /> Mark read
              </button>
              <button
                type="button"
                className="adm-btn is-ghost is-sm"
                onClick={() => void setStatus([...selected], "unread")}
              >
                <Mail size={13} /> Mark unread
              </button>
              <button
                type="button"
                className="adm-btn is-danger is-sm"
                onClick={() => setConfirm([...selected])}
              >
                <Trash2 size={13} /> Delete
              </button>
            </div>
          ) : null}
        </div>

        {items.length === 0 ? (
          <EmptyState title={search.q || search.status ? "No messages match" : "No messages yet"}>
            {search.q || search.status
              ? "Try a different search or filter."
              : "When someone uses the contact form, their message shows up here and is stored in Supabase."}
          </EmptyState>
        ) : (
          <div className={`adm-inbox ${open ? "has-open" : ""}`}>
            <div className="adm-inbox-list">
              <label
                className="adm-msg"
                style={{
                  cursor: "pointer",
                  alignItems: "center",
                  background: "rgba(242,242,238,0.02)",
                }}
              >
                <span className="adm-msg-check">
                  <input
                    type="checkbox"
                    checked={allOnPage}
                    onChange={toggleAll}
                    aria-label="Select all messages on this page"
                  />
                </span>
                <span className="adm-mono">SELECT ALL</span>
              </label>
              {items.map((c) => (
                <div
                  key={c.id}
                  style={{ display: "flex", borderBottom: "1px solid var(--border)" }}
                >
                  <label
                    className="adm-msg-check"
                    style={{ padding: "0 4px 0 14px", cursor: "pointer" }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggleOne(c.id)}
                      aria-label={`Select message from ${c.name}`}
                    />
                  </label>
                  <button
                    type="button"
                    className={`adm-msg ${c.status === "unread" ? "is-unread" : ""} ${openId === c.id ? "is-open" : ""}`}
                    style={{ borderBottom: 0, flex: 1, minWidth: 0 }}
                    onClick={() => openMessage(c)}
                    aria-current={openId === c.id ? "true" : undefined}
                  >
                    <span
                      className="adm-msg-dot"
                      aria-label={c.status === "unread" ? "Unread" : "Read"}
                    />
                    <span style={{ minWidth: 0 }}>
                      <span className="adm-msg-top">
                        <span className="adm-msg-name">{c.name}</span>
                        <span className="adm-mono">{timeAgo(c.created_at)}</span>
                      </span>
                      <span className="adm-msg-snippet">{c.message}</span>
                    </span>
                  </button>
                </div>
              ))}
            </div>

            <div className="adm-detail-pane">
              {open ? (
                <article className="adm-detail" aria-label={`Message from ${open.name}`}>
                  <button
                    type="button"
                    className="adm-btn is-ghost is-sm adm-back"
                    onClick={() => setOpenId(null)}
                  >
                    <ArrowLeft size={13} /> All messages
                  </button>
                  <h2>{open.name}</h2>
                  <div className="adm-detail-meta">
                    <a href={`mailto:${open.email}`}>{open.email}</a>
                    <span>{formatDateTime(open.created_at)}</span>
                    <span className={`adm-badge ${open.status === "unread" ? "is-red" : ""}`}>
                      {open.status}
                    </span>
                  </div>
                  <div className="adm-detail-body">{open.message}</div>
                  {open.user_agent ? <p className="adm-detail-ua">{open.user_agent}</p> : null}
                  <div className="adm-actions" style={{ marginTop: 18 }}>
                    <a
                      className="adm-btn"
                      href={`mailto:${open.email}?subject=${encodeURIComponent("Re: your message")}`}
                    >
                      <Mail size={14} /> Reply by email
                    </a>
                    <button
                      type="button"
                      className="adm-btn is-ghost"
                      onClick={() =>
                        void setStatus([open.id], open.status === "read" ? "unread" : "read")
                      }
                    >
                      {open.status === "read" ? <Mail size={14} /> : <MailOpen size={14} />}
                      Mark as {open.status === "read" ? "unread" : "read"}
                    </button>
                    <button
                      type="button"
                      className="adm-btn is-danger"
                      onClick={() => setConfirm([open.id])}
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </article>
              ) : (
                <EmptyState title="Select a message">
                  Pick a message from the list to read it.
                </EmptyState>
              )}
            </div>
          </div>
        )}

        {pages > 1 ? (
          <div className="adm-pager">
            {loaded.page > 1 ? (
              <Link
                to="/admin/contacts"
                search={{
                  ...search,
                  page: loaded.page - 1 > 1 ? loaded.page - 1 : undefined,
                  open: undefined,
                }}
                className="adm-btn is-ghost is-sm"
              >
                ← Newer
              </Link>
            ) : (
              <span />
            )}
            <span>
              PAGE {loaded.page} / {pages}
            </span>
            {loaded.page < pages ? (
              <Link
                to="/admin/contacts"
                search={{ ...search, page: loaded.page + 1, open: undefined }}
                className="adm-btn is-ghost is-sm"
              >
                Older →
              </Link>
            ) : (
              <span />
            )}
          </div>
        ) : null}
      </Panel>

      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm && confirm.length > 1
            ? `Delete ${confirm.length} messages?`
            : "Delete this message?"
        }
        body="This permanently removes the submission from the database. It can't be undone."
        confirmLabel="Delete"
        danger
        busy={deleting}
        onConfirm={() => void remove()}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}
