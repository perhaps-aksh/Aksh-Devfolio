import { createFileRoute, redirect } from "@tanstack/react-router";

/** `/admin` simply forwards to the dashboard (which sends signed-out visitors to the login page). */
export const Route = createFileRoute("/admin/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/dashboard" });
  },
});
