import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { PostEditor } from "@/components/admin/PostEditor";
import { getAdminPostFn, getContentStructureFn } from "@/lib/admin.functions";

export const Route = createFileRoute("/_admin/admin/blogs/$id/edit")({
  loader: async ({ params }) => {
    const [post, structure] = await Promise.all([
      getAdminPostFn({ data: { id: params.id } }),
      getContentStructureFn(),
    ]);
    if (!post) throw notFound();
    return { post, structure };
  },
  head: () => ({ meta: [{ title: "Edit post — AKSH Admin" }] }),
  notFoundComponent: () => (
    <div className="adm-empty">
      <strong>Post not found</strong>
      <p>It may have been deleted.</p>
      <p style={{ marginTop: 14 }}>
        <Link to="/admin/blogs" className="adm-btn is-ghost">
          Back to posts
        </Link>
      </p>
    </div>
  ),
  component: EditPost,
});

function EditPost() {
  const { post, structure } = Route.useLoaderData();
  // Re-mount the editor when a different post is opened.
  return <PostEditor key={post.id} post={post} structure={structure} />;
}
