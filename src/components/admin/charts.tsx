import * as React from "react";

import { formatNumber } from "./format";

type Point = { day: string; views: number; visitors: number };

/** Fill in days with no traffic so the line is continuous. `daily` comes from the database as UTC dates. */
function fillDays(daily: Point[], days: number): Point[] {
  const byDay = new Map(daily.map((d) => [d.day, d]));
  const out: Point[] = [];
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(end);
    date.setUTCDate(end.getUTCDate() - i);
    const key = date.toISOString().slice(0, 10);
    out.push(byDay.get(key) ?? { day: key, views: 0, visitors: 0 });
  }
  return out;
}

const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

/** Lightweight SVG area chart (views + unique visitors). No chart library. */
export function VisitsChart({ daily, days }: { daily: Point[]; days: number }) {
  const data = React.useMemo(() => fillDays(daily, days), [daily, days]);
  const [hover, setHover] = React.useState<number | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);

  const W = 800;
  const H = 220;
  const pad = 6;
  const max = Math.max(4, ...data.map((d) => d.views));
  const x = (i: number) =>
    data.length === 1 ? W / 2 : pad + (i / (data.length - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);
  const line = (key: "views" | "visitors") =>
    data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(" ");
  const area = `${line("views")} L${x(data.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`;
  const total = data.reduce((sum, d) => sum + d.views, 0);

  const onMove = (event: React.PointerEvent) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    setHover(Math.round(ratio * (data.length - 1)));
  };

  const active = hover === null ? null : data[hover];

  return (
    <div>
      <div
        className="adm-chart"
        ref={ref}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Visits over the last ${days} days: ${formatNumber(total)} page views`}
        >
          <defs>
            <linearGradient id="adm-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f86ff" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#4f86ff" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((r) => (
            <line
              key={r}
              x1="0"
              x2={W}
              y1={H * r}
              y2={H * r}
              stroke="rgba(242,242,238,0.07)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path d={area} fill="url(#adm-area)" />
          <path
            d={line("views")}
            fill="none"
            stroke="#4f86ff"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
          <path
            d={line("visitors")}
            fill="none"
            stroke="#ff4557"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            strokeDasharray="5 4"
          />
          {hover !== null ? (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1="0"
              y2={H}
              stroke="rgba(242,242,238,0.3)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
        </svg>
        {active ? (
          <div
            className="adm-chart-tip"
            style={{
              left: `${Math.min(88, Math.max(12, (hover! / Math.max(1, data.length - 1)) * 100))}%`,
            }}
          >
            <b>{shortDate(active.day).toUpperCase()}</b>
            {formatNumber(active.views)} views · {formatNumber(active.visitors)} visitors
          </div>
        ) : null}
      </div>
      <div className="adm-chart-axis" aria-hidden="true">
        <span>{shortDate(data[0]!.day)}</span>
        <span>{shortDate(data[Math.floor(data.length / 2)]!.day)}</span>
        <span>{shortDate(data[data.length - 1]!.day)}</span>
      </div>
    </div>
  );
}

export function ChartLegend() {
  return (
    <div className="adm-legend" aria-hidden="true">
      <span>
        <i style={{ background: "#4f86ff" }} />
        Views
      </span>
      <span>
        <i style={{ background: "#ff4557" }} />
        Visitors
      </span>
    </div>
  );
}

export function BarList({
  rows,
  empty = "No data yet.",
}: {
  rows: { label: string; value: number; href?: string }[];
  empty?: string;
}) {
  if (rows.length === 0)
    return (
      <p className="adm-empty" style={{ padding: "28px 18px" }}>
        {empty}
      </p>
    );
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="adm-bars">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="adm-bar-top">
            <span title={row.label}>{row.label}</span>
            <span>{formatNumber(row.value)}</span>
          </div>
          <div className="adm-bar-track" role="presentation">
            <div
              className="adm-bar-fill"
              style={{ width: `${Math.max(3, (row.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
