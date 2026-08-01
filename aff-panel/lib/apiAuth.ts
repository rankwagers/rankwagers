import { NextRequest, NextResponse } from "next/server";

import { adminKey, isAuthorized } from "@/lib/config";

export function requireAdmin(req: NextRequest): NextResponse | null {
  const key = req.nextUrl.searchParams.get("key");
  const cookie = req.headers.get("cookie");
  if (!isAuthorized(cookie, key)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export function unauthorizedPage(): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0a0e17;color:#fff;padding:2rem"><h1>Unauthorized</h1><p>Add <code>?key=YOUR_ADMIN_KEY</code> once to set the cookie.</p></body></html>`,
    { status: 401, headers: { "Content-Type": "text/html" } }
  );
}

export { adminKey };
