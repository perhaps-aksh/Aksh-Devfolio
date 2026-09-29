import { createFileRoute } from "@tanstack/react-router";

import { PersonalizeTabs } from "@/components/admin/PersonalizeTabs";
import { ProfileForm } from "@/components/admin/ProfileForm";
import { SectionManager } from "@/components/admin/SectionManager";
import { PageHeader } from "@/components/admin/ui";
import { getProfileFn, listSectionFn } from "@/lib/admin.functions";

export const Route = createFileRoute("/_admin/admin/personalize/")({
  loader: async () => {
    const [profile, identity] = await Promise.all([
      getProfileFn(),
      listSectionFn({ data: { key: "identity" } }),
    ]);
    return { profile, identity };
  },
  head: () => ({ meta: [{ title: "Personalize — AKSH Admin" }] }),
  component: PersonalizeAbout,
});

function PersonalizeAbout() {
  const { profile, identity } = Route.useLoaderData();
  return (
    <>
      <PageHeader kicker="SITE" jp="個性" title="Personalize" />
      <PersonalizeTabs current="about" />
      <ProfileForm profile={profile} />
      <div style={{ height: 22 }} />
      <SectionManager sectionKey="identity" rows={identity} compact />
    </>
  );
}
