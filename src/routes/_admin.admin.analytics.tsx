import { createFileRoute } from "@tanstack/react-router";
import { FileText, MousePointerClick, Users } from "lucide-react";

import { BarList, ChartLegend, VisitsChart } from "@/components/admin/charts";
import { formatNumber, timeAgo } from "@/components/admin/format";
import { EmptyState, PageHeader, Panel, RangeTabs, StatCard } from "@/components/admin/ui";
import { getAnalyticsFn } from "@/lib/admin.functions";

export const Route = createFileRoute("/_admin/admin/analytics")({
  validateSearch: (search: Record<string, unknown>): { days?: number } => {
    const days = Number(search["days"]);
    return days === 7 || days === 90 ? { days } : {};
  },
  loaderDeps: ({ search }) => ({ days: search.days ?? 30 }),
  loader: ({ deps }) => getAnalyticsFn({ data: { days: deps.days } }),
  head: () => ({ meta: [{ title: "Analytics — AKSH Admin" }] }),
  component: Analytics,
});

const DEVICE_LABEL: Record<string, string> = {
  desktop: "Desktop",
  mobile: "Mobile",
  tablet: "Tablet",
  unknown: "Unknown",
};

function Analytics() {
  const { stats, recentVisits } = Route.useLoaderData();
  const { days } = Route.useLoaderDeps();
  const { totals } = stats;
  const perDay = stats.range_days > 0 ? Math.round((totals.views / stats.range_days) * 10) / 10 : 0;

  return (
    <>
      <PageHeader kicker="TRAFFIC" jp="解析" title="Analytics">
        <RangeTabs to="/admin/analytics" days={days} />
      </PageHeader>

      <div className="adm-grid adm-stats">
        <StatCard
          label="Page views"
          value={formatNumber(totals.views)}
          sub={`${perDay} per day`}
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
          sub={
            totals.views
              ? `${Math.round((totals.blog_views / totals.views) * 100)}% of all views`
              : "—"
          }
          icon={<FileText size={14} />}
        />
        <StatCard
          label="All-time views"
          value={formatNumber(stats.all_time_views)}
          sub="Since tracking began"
        />
      </div>

      <Panel title="Visits over time" jp="推移" action={<ChartLegend />}>
        {totals.views === 0 ? (
          <EmptyState title="No visits recorded yet">
            Tracking is anonymous (no cookies, no IP addresses stored) and skips visitors who send
            Do&nbsp;Not&nbsp;Track or Global Privacy Control. Visit the public site to record your
            first view.
          </EmptyState>
        ) : (
          <VisitsChart daily={stats.daily} days={stats.range_days} />
        )}
      </Panel>

      <div className="adm-grid adm-2col">
        <Panel title="Most visited pages" flush>
          <BarList rows={stats.top_pages.map((p) => ({ label: p.path, value: p.views }))} />
        </Panel>
        <Panel title="Most viewed articles" jp="記事" flush>
          <BarList
            rows={stats.top_posts.map((p) => ({ label: p.title, value: p.views }))}
            empty="No article views yet."
          />
        </Panel>
        <Panel title="Referrers" flush>
          <BarList rows={stats.referrers.map((r) => ({ label: r.name, value: r.views }))} />
        </Panel>
        <Panel title="Devices" flush>
          <BarList
            rows={stats.devices.map((d) => ({
              label: DEVICE_LABEL[d.name] ?? d.name,
              value: d.views,
            }))}
          />
        </Panel>
        <Panel title="Browsers" flush>
          <BarList rows={stats.browsers.map((b) => ({ label: b.name, value: b.views }))} />
        </Panel>
        <Panel title="Countries" flush>
          <BarList
            rows={stats.countries.map((c) => ({ label: c.name, value: c.views }))}
            empty="Country data appears when the site runs behind Cloudflare."
          />
        </Panel>
      </div>

      <div style={{ marginTop: "clamp(12px, 1.6vw, 20px)" }}>
        <Panel title="Latest visits" flush>
          {recentVisits.length === 0 ? (
            <EmptyState title="Nothing yet" />
          ) : (
            <div className="adm-table-wrap">
              <table className="adm-table is-stack">
                <thead>
                  <tr>
                    <th>Page</th>
                    <th>Device</th>
                    <th>Browser / OS</th>
                    <th>Country</th>
                    <th>Referrer</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {recentVisits.map((v) => (
                    <tr key={v.id}>
                      <td data-label="Page">{v.path}</td>
                      <td data-label="Device">
                        <span className="adm-mono">{v.device ?? "—"}</span>
                      </td>
                      <td data-label="Browser / OS">
                        <span className="adm-mono">
                          {[v.browser, v.os].filter(Boolean).join(" · ") || "—"}
                        </span>
                      </td>
                      <td data-label="Country">
                        <span className="adm-mono">{v.country ?? "—"}</span>
                      </td>
                      <td data-label="Referrer">
                        <span className="adm-mono">{v.referrer ?? "direct"}</span>
                      </td>
                      <td data-label="When">
                        <span className="adm-mono">{timeAgo(v.created_at)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
