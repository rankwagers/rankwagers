import { NextResponse } from "next/server";
import { NextRequest } from "next/server";

import { isAuthorized } from "@/lib/adminAuth";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/_next") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/affpanel", req.url));
  }
  if (!pathname.startsWith("/affpanel") && !pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const key = req.nextUrl.searchParams.get("key");
  const cookie = req.headers.get("cookie");
  if (!isAuthorized(cookie, key)) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:system-ui;background:#0a0e17;color:#e2e8f0;padding:2rem;max-width:32rem"><h1 style="color:#fbbf24">aff-panel</h1><p>Unauthorized. Open with your admin key:</p><p><code>/affpanel?key=YOUR_ADMIN_KEY</code></p></body></html>`,
      { status: 401, headers: { "Content-Type": "text/html" } }
    );
  }

  const res = NextResponse.next();
  res.headers.set("x-robots-tag", "noindex, nofollow");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
