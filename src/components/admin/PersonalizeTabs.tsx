import { Link } from "@tanstack/react-router";

import type { SectionKey } from "@/lib/site-content";

export type PersonalizeTab = "about" | "projects" | SectionKey;

type ListTab = { id: Exclude<PersonalizeTab, "about" | "projects" | "identity">; label: string };

const BEFORE_PROJECTS: ListTab[] = [
  { id: "journey", label: "Journey" },
  { id: "services", label: "What I build" },
];
const AFTER_PROJECTS: ListTab[] = [
  { id: "achievements", label: "Achievements" },
  { id: "toolbox", label: "Toolbox" },
  { id: "exploring", label: "Exploring" },
  { id: "faq", label: "FAQ" },
];

/** The tab bar shared by every Personalize page (and the Projects page, which lives in the same section). */
export function PersonalizeTabs({ current }: { current: PersonalizeTab }) {
  const cls = (id: PersonalizeTab) => `adm-tab ${current === id ? "is-on" : ""}`;
  const aria = (id: PersonalizeTab) => (current === id ? ("true" as const) : undefined);
  const listTab = (tab: ListTab) => (
    <Link
      key={tab.id}
      to="/admin/personalize/$section"
      params={{ section: tab.id }}
      className={cls(tab.id)}
      aria-current={aria(tab.id)}
    >
      {tab.label}
    </Link>
  );
  return (
    <nav className="adm-tabs adm-pz-tabs" aria-label="Personalize sections">
      <Link to="/admin/personalize" className={cls("about")} aria-current={aria("about")}>
        About &amp; contact
      </Link>
      {BEFORE_PROJECTS.map(listTab)}
      <Link to="/admin/projects" className={cls("projects")} aria-current={aria("projects")}>
        Projects
      </Link>
      {AFTER_PROJECTS.map(listTab)}
    </nav>
  );
}
