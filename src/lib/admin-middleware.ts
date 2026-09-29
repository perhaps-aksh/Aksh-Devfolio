import { createMiddleware } from "@tanstack/react-start";

import { requireAdmin } from "@/server/admin-auth.server";

/** Rejects the call with a 401 unless the request carries a valid admin session cookie. */
export const adminOnly = createMiddleware({ type: "function" }).server(async ({ next }) => {
  await requireAdmin();
  return next();
});
