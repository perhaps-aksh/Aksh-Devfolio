import { createFileRoute, redirect } from "@tanstack/react-router";

/** Old article URLs (`/thoughts/<slug>`) keep working: they permanently redirect to `/blog/<slug>`. */
export const Route = createFileRoute("/thoughts/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/blog/$slug", params: { slug: params.slug }, statusCode: 301 });
  },
});
