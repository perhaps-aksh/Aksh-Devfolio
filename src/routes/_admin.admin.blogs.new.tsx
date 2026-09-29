import { createFileRoute } from "@tanstack/react-router";

import { PostEditor } from "@/components/admin/PostEditor";

export const Route = createFileRoute("/_admin/admin/blogs/new")({
  head: () => ({ meta: [{ title: "New post — AKSH Admin" }] }),
  component: () => <PostEditor post={null} />,
});
