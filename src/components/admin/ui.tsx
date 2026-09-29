import * as React from "react";
import { Link } from "@tanstack/react-router";
import { CircleAlert, CircleCheck, Info } from "lucide-react";

export function PageHeader({
  kicker,
  jp,
  title,
  children,
}: {
  kicker: string;
  jp?: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="adm-head">
      <div>
        <p className="adm-kicker">
          {kicker}
          {jp ? <b className="jp">{jp}</b> : null}
        </p>
        <h1 className="adm-title">{title}</h1>
      </div>
      {children ? <div className="adm-actions">{children}</div> : null}
    </header>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="adm-stat">
      <p className="adm-stat-label">
        {label}
        {icon}
      </p>
      <p className="adm-stat-value">{value}</p>
      {sub ? <p className="adm-stat-sub">{sub}</p> : null}
    </div>
  );
}

export function Panel({
  title,
  jp,
  action,
  children,
  flush = false,
}: {
  title: string;
  jp?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  flush?: boolean;
}) {
  return (
    <section className="adm-panel">
      <div className="adm-panel-head">
        <h2 className="adm-panel-title">
          {title}
          {jp ? <b className="jp">{jp}</b> : null}
        </h2>
        {action}
      </div>
      {flush ? children : <div className="adm-panel-body">{children}</div>}
    </section>
  );
}

export function Banner({
  tone,
  children,
}: {
  tone: "warn" | "info" | "ok";
  children: React.ReactNode;
}) {
  const Icon = tone === "warn" ? CircleAlert : tone === "ok" ? CircleCheck : Info;
  return (
    <div className={`adm-banner is-${tone}`} role={tone === "warn" ? "alert" : "status"}>
      <Icon size={18} />
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="adm-empty">
      <strong>{title}</strong>
      {children ? <p>{children}</p> : null}
    </div>
  );
}

export function LoadingBlock({ label = "LOADING" }: { label?: string }) {
  return (
    <div className="adm-loading" role="status" aria-live="polite">
      {label}…
    </div>
  );
}

const RANGES = [7, 30, 90] as const;

/** 7 / 30 / 90 day switcher used by the dashboard and analytics pages. */
export function RangeTabs({
  to,
  days,
}: {
  to: "/admin/dashboard" | "/admin/analytics";
  days: number;
}) {
  return (
    <div className="adm-tabs" role="group" aria-label="Date range">
      {RANGES.map((range) => (
        <Link
          key={range}
          to={to}
          search={{ days: range }}
          className={`adm-tab ${days === range ? "is-on" : ""}`}
          aria-current={days === range ? "true" : undefined}
        >
          {range}D
        </Link>
      ))}
    </div>
  );
}
