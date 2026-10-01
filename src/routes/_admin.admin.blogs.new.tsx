import { createFileRoute } from "@tanstack/react-router";

import { PostEditor } from "@/components/admin/PostEditor";
import { getContentStructureFn } from "@/lib/admin.functions";

export const Route = createFileRoute("/_admin/admin/blogs/new")({
  loader: () => getContentStructureFn(),
  head: () => ({ meta: [{ title: "New post — AKSH Admin" }] }),
  component: NewPost,
});

function NewPost() {
  const structure = Route.useLoaderData();
  return <PostEditor post={null} structure={structure} />;
}
