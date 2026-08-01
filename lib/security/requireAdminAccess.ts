import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  clientKey,
  evaluateAdminAccess,
  type AdminAuthResult,
} from "./adminAuth";

export function adminDeniedResponse(result: Extract<AdminAuthResult, { ok: false }>): Response {
  return NextResponse.json(
    { ok: false, error: result.code },
    {
      status: result.status,
      headers: {
        "Cache-Control": "no-store",
        "x-robots-tag": "noindex, nofollow, noarchive",
      },
    }
  );
}

/** API guard — Bearer or session cookie. */
export function requireAdminAccess(req: NextRequest | Request): Response | null {
  const cookieHeader =
    "cookies" in req && typeof req.cookies?.get === "function"
      ? req.cookies.get(ADMIN_COOKIE)?.value
      : undefined;
  const cookieFromHeader = (() => {
    const raw = req.headers.get("cookie") || "";
    const match = raw.match(new RegExp(`${ADMIN_COOKIE}=([^;]+)`));
    return match?.[1] ? decodeURIComponent(match[1]) : undefined;
  })();

  const result = evaluateAdminAccess({
    headers: req.headers,
    cookieValue: cookieHeader ?? cookieFromHeader,
    clientKey: clientKey({ headers: req.headers }),
  });
  if (result.ok) return null;
  return adminDeniedResponse(result);
}

/** Server Component / page guard. */
export function requireAdminPageAccess(): AdminAuthResult {
  const jar = cookies();
  return evaluateAdminAccess({
    headers: new Headers(),
    cookieValue: jar.get(ADMIN_COOKIE)?.value,
    clientKey: "admin-page",
  });
}
