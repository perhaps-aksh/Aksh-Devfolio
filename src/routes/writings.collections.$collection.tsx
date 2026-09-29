import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Layout only. TanStack Router nests `writings.collections.$collection.$chapter.tsx` under this file
 * by its dot-separated name, so this must exist and render an `<Outlet/>` for that child route (and
 * `writings.collections.$collection.index.tsx`, the collection overview itself) to ever be shown.
 */
export const Route = createFileRoute("/writings/collections/$collection")({
  component: () => <Outlet />,
});
