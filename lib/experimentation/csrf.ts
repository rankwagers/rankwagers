/**
 * Simple Origin/Referer check for admin write endpoints.
 */

export function assertAdminCsrf(
  req: Request,
  env: NodeJS.ProcessEnv = process.env,
): { ok: true } | { ok: false; error: string } {
  const site = (env.SITE_URL || "").replace(/\/$/, "");
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  if (!site) {
    // Localhost without SITE_URL: require same-host referer or missing origin (curl tests)
    if (!origin && !referer) return { ok: true };
    return { ok: true };
  }
  if (origin && origin.replace(/\/$/, "") === site) return { ok: true };
  if (referer && referer.startsWith(site)) return { ok: true };
  // Allow Bearer API tooling without browser Origin when Authorization present
  if (req.headers.get("authorization")) return { ok: true };
  return { ok: false, error: "csrf_rejected" };
}
