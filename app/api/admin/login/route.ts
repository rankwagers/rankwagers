import { NextRequest, NextResponse } from "next/server";
import { isInsecureSecret, isDeployedEnv, resolveAppEnv } from "@/lib/config/env";
import {
  ADMIN_COOKIE,
  adminCookieOptions,
  clientKey,
  mintAdminSession,
  safeEqualSecret,
} from "@/lib/security/adminAuth";
import { checkRateLimitSafe } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function wantsJson(req: NextRequest): boolean {
  const accept = req.headers.get("accept") || "";
  const ct = req.headers.get("content-type") || "";
  return ct.includes("application/json") || accept.includes("application/json");
}

export async function POST(req: NextRequest) {
  const rl = checkRateLimitSafe({
    key: `admin-login:${clientKey(req)}`,
    limit: 10,
    windowMs: 60_000,
    route: "admin_login",
    onAdapterFailure: "fail_closed",
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, code: "rate_limited" },
      {
        status: 429,
        headers: {
          "Retry-After": String(rl.retryAfterSec),
          "Cache-Control": "no-store",
        },
      }
    );
  }

  if (process.env.FF_EMERGENCY_DISABLE_ADMIN === "true") {
    return NextResponse.json(
      { ok: false, code: "route_disabled" },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  const secret = process.env.ADMIN_KEY?.trim() || "";
  if (!secret || (isDeployedEnv(resolveAppEnv()) && isInsecureSecret(secret))) {
    return NextResponse.json(
      { ok: false, code: "insecure_admin_secret" },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  let provided = "";
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as { key?: string } | null;
    provided = typeof body?.key === "string" ? body.key : "";
  } else {
    const form = await req.formData().catch(() => null);
    const raw = form?.get("key");
    provided = typeof raw === "string" ? raw : "";
  }

  if (!provided || !safeEqualSecret(provided, secret)) {
    if (wantsJson(req)) {
      return NextResponse.json(
        { ok: false, code: "forbidden" },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.redirect(new URL("/admin?error=1", req.url), 303);
  }

  const session = mintAdminSession(secret);
  const opts = adminCookieOptions();

  if (wantsJson(req)) {
    const res = NextResponse.json(
      { ok: true },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
    res.cookies.set(ADMIN_COOKIE, session, opts);
    return res;
  }

  const res = NextResponse.redirect(new URL("/admin/dashboard", req.url), 303);
  res.cookies.set(ADMIN_COOKIE, session, opts);
  return res;
}

export async function GET() {
  return NextResponse.json(
    { ok: false, code: "method_not_allowed" },
    { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } }
  );
}
