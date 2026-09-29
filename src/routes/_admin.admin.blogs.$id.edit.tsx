import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { PostEditor } from "@/components/admin/PostEditor";
import { getAdminPostFn } from "@/lib/admin.functions";

export const Route = createFileRoute("/_admin/admin/blogs/$id/edit")({
  loader: async ({ params }) => {
    const post = await getAdminPostFn({ data: { id: params.id } });
    if (!post) throw notFound();
    return post;
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
  const post = Route.useLoaderData();
  // Re-mount the editor when a different post is opened.
  return <PostEditor key={post.id} post={post} />;
}
