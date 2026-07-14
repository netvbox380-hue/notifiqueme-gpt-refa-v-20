import type { Express } from "express";

/** Legacy OAuth callback kept as a deterministic 410 route.
 * The current application uses the local/session authentication flow.
 */
export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", (_req, res) => {
    res.status(410).json({ error: "OAuth callback desativado" });
  });
}
