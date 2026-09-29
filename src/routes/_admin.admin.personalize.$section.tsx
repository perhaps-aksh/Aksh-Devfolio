import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { PersonalizeTabs } from "@/components/admin/PersonalizeTabs";
import { SectionManager } from "@/components/admin/SectionManager";
import { PageHeader } from "@/components/admin/ui";
import { listSectionFn } from "@/lib/admin.functions";
import { isSectionKey, SECTIONS } from "@/lib/site-content";

export const Route = createFileRoute("/_admin/admin/personalize/$section")({
  loader: async ({ params }) => {
    if (!isSectionKey(params.section)) throw notFound();
    return { key: params.section, rows: await listSectionFn({ data: { key: params.section } }) };
  },
  head: ({ params }) => ({
    meta: [
      {
        title: `${isSectionKey(params.section) ? SECTIONS[params.section].label : "Personalize"} — AKSH Admin`,
      },
    ],
  }),
  notFoundComponent: () => (
    <div className="adm-empty">
      <strong>Section not found</strong>
      <p style={{ marginTop: 14 }}>
        <Link to="/admin/personalize" className="adm-btn is-ghost">
          Back to Personalize
        </Link>
      </p>
    </div>
  ),
  component: PersonalizeSection,
});

function PersonalizeSection() {
  const { key, rows } = Route.useLoaderData();
  const def = SECTIONS[key];
  return (
    <>
      <PageHeader kicker="SITE / PERSONALIZE" jp={def.jp} title={def.label} />
      <PersonalizeTabs current={key} />
      <p className="adm-hint" style={{ marginBottom: 18 }}>
        {def.blurb}
      </p>
      {/* key: switching tabs must remount the manager so an open form never leaks across sections */}
      <SectionManager key={key} sectionKey={key} rows={rows} />
    </>
  );
}
