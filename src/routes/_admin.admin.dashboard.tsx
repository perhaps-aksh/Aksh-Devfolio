import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, FolderKanban, Inbox, MousePointerClick, Users } from "lucide-react";

import { BarList, ChartLegend, VisitsChart } from "@/components/admin/charts";
import { formatNumber, timeAgo } from "@/components/admin/format";
import { EmptyState, PageHeader, Panel, RangeTabs, StatCard } from "@/components/admin/ui";
import { getDashboardFn } from "@/lib/admin.functions";

export const Route = createFileRoute("/_admin/admin/dashboard")({
  validateSearch: (search: Record<string, unknown>): { days?: number } => {
    const days = Number(search["days"]);
    return days === 7 || days === 90 ? { days } : {};
  },
  loaderDeps: ({ search }) => ({ days: search.days ?? 30 }),
  loader: ({ deps }) => getDashboardFn({ data: { days: deps.days } }),
  head: () => ({ meta: [{ title: "Dashboard — AKSH Admin" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { stats, recentVisits, recentContacts, recentPosts } = Route.useLoaderData();
  const { days } = Route.useLoaderDeps();
  const { counts, totals } = stats;

  return (
    <>
      <PageHeader kicker="OVERVIEW" jp="概要" title="Dashboard">
        <RangeTabs to="/admin/dashboard" days={days} />
      </PageHeader>

      <div className="adm-grid adm-stats">
        <StatCard
          label="Page views"
          value={formatNumber(totals.views)}
          sub={`Last ${days} days · ${formatNumber(stats.all_time_views)} all time`}
          icon={<MousePointerClick size={14} />}
        />
        <StatCard
          label="Visitors"
          value={formatNumber(totals.visitors)}
          sub="Unique per day, anonymous"
          icon={<Users size={14} />}
        />
        <StatCard
          label="Blog views"
          value={formatNumber(totals.blog_views)}
          sub="Article page views"
          icon={<FileText size={14} />}
        />
        <StatCard
          label="Published posts"
          value={formatNumber(counts.posts_published)}
          sub={`${formatNumber(counts.posts_draft)} drafts · ${formatNumber(counts.posts_scheduled)} scheduled`}
          icon={<FileText size={14} />}
        />
        <StatCard
          label="Projects"
          value={formatNumber(counts.projects)}
          sub="Shown on the portfolio"
          icon={<FolderKanban size={14} />}
        />
        <StatCard
          label="Messages"
          value={formatNumber(counts.contacts_total)}
          sub={
            counts.contacts_unread ? (
              <span style={{ color: "var(--hl-red)" }}>{counts.contacts_unread} unread</span>
            ) : (
              "All read"
            )
          }
          icon={<Inbox size={14} />}
        />
      </div>

      <Panel title="Visits" jp="訪問" action={<ChartLegend />}>
        {totals.views === 0 ? (
          <EmptyState title="No visits recorded yet">
            Page views appear here once visitors browse the site. Tracking is anonymous and skips
            visitors who send Do&nbsp;Not&nbsp;Track.
          </EmptyState>
        ) : (
          <VisitsChart daily={stats.daily} days={stats.range_days} />
        )}
      </Panel>

      <div className="adm-grid adm-2col">
        <Panel
          title="Top pages"
          action={
            <Link to="/admin/analytics" search={{ days }} className="adm-panel-link">
              Analytics →
            </Link>
          }
          flush
        >
          <BarList
            rows={stats.top_pages.map((p) => ({ label: p.path, value: p.views }))}
            empty="No page views yet."
          />
        </Panel>
        <Panel title="Most viewed articles" jp="記事" flush>
          <BarList
            rows={stats.top_posts.map((p) => ({ label: p.title, value: p.views }))}
            empty="No article views yet."
          />
        </Panel>
      </div>

      <div className="adm-grid adm-2col">
        <Panel
          title="Recent messages"
          jp="連絡"
          action={
            <Link to="/admin/contacts" className="adm-panel-link">
              All messages →
            </Link>
          }
          flush
        >
          {recentContacts.length === 0 ? (
            <EmptyState title="No messages yet">
              Submissions from the contact form will show up here.
            </EmptyState>
          ) : (
            <ul className="adm-list">
              {recentContacts.map((c) => (
                <li key={c.id}>
                  <Link to="/admin/contacts" search={{ open: c.id }} className="grow">
                    <span style={{ fontWeight: c.status === "unread" ? 700 : 400 }}>{c.name}</span>
                    <span className="sub">{c.message}</span>
                  </Link>
                  <span className="adm-mono">{timeAgo(c.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Recently edited posts"
          jp="随筆"
          action={
            <Link to="/admin/blogs" className="adm-panel-link">
              All posts →
            </Link>
          }
          flush
        >
          {recentPosts.length === 0 ? (
            <EmptyState title="No posts yet">
              <Link to="/admin/blogs/new" className="adm-panel-link">
                Write the first one →
              </Link>
            </EmptyState>
          ) : (
            <ul className="adm-list">
              {recentPosts.map((p) => (
                <li key={p.id}>
                  <Link to="/admin/blogs/$id/edit" params={{ id: p.id }} className="grow">
                    <span>{p.title}</span>
                    <span className="sub">/blog/{p.slug}</span>
                  </Link>
                  <span className={`adm-badge ${p.status === "published" ? "is-live" : ""}`}>
                    {p.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div style={{ marginTop: "clamp(12px, 1.6vw, 20px)" }}>
        <Panel title="Recent visits" flush>
          {recentVisits.length === 0 ? (
            <EmptyState title="Nothing yet" />
          ) : (
            <ul className="adm-list">
              {recentVisits.map((v) => (
                <li key={v.id}>
                  <span className="grow">
                    <span>{v.path}</span>
                    <span className="sub">
                      {[
                        v.device,
                        v.browser,
                        v.os,
                        v.country,
                        v.referrer ? `via ${v.referrer}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="adm-mono">{timeAgo(v.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
