import { createFileRoute } from "@tanstack/react-router";

import { WritingEditor } from "@/components/admin/WritingEditor";
import { getContentStructureFn } from "@/lib/admin.functions";

export const Route = createFileRoute("/_admin/admin/writings/new")({
  loader: () => getContentStructureFn(),
  head: () => ({ meta: [{ title: "New writing — AKSH Admin" }] }),
  component: NewWriting,
});

function NewWriting() {
  const structure = Route.useLoaderData();
  return <WritingEditor writing={null} structure={structure} />;
}
