import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { WritingEditor } from "@/components/admin/WritingEditor";
import { getAdminWritingFn, getContentStructureFn } from "@/lib/admin.functions";

export const Route = createFileRoute("/_admin/admin/writings/$id/edit")({
  loader: async ({ params }) => {
    const [writing, structure] = await Promise.all([
      getAdminWritingFn({ data: { id: params.id } }),
      getContentStructureFn(),
    ]);
    if (!writing) throw notFound();
    return { writing, structure };
  },
  head: () => ({ meta: [{ title: "Edit writing — AKSH Admin" }] }),
  notFoundComponent: () => (
    <div className="adm-empty">
      <strong>Writing not found</strong>
      <p>It may have been deleted.</p>
      <p style={{ marginTop: 14 }}>
        <Link to="/admin/writings" className="adm-btn is-ghost">
          Back to writings
        </Link>
      </p>
    </div>
  ),
  component: EditWriting,
});

function EditWriting() {
  const { writing, structure } = Route.useLoaderData();
  return <WritingEditor key={writing.id} writing={writing} structure={structure} />;
}
