import { NextRequest, NextResponse } from "next/server";
import { isLocale } from "@/lib/i18n";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from "@/lib/localePreference";

const COOKIE_NAME = "rankwagers-age-verified";
const MAX_AGE = 60 * 60 * 24 * 365;

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/en";
  }
  return raw;
}

function localeFromPath(path: string): string | null {
  const seg = path.split("/").filter(Boolean)[0];
  return seg && isLocale(seg) ? seg : null;
}

export function GET(req: NextRequest) {
  const next = safeNextPath(req.nextUrl.searchParams.get("next"));
  const res = NextResponse.redirect(new URL(next, req.url));
  res.cookies.set(COOKIE_NAME, "1", {
    path: "/",
    maxAge: MAX_AGE,
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });
  const loc = localeFromPath(next);
  if (loc) {
    res.cookies.set(LOCALE_COOKIE, loc, {
      path: "/",
      maxAge: LOCALE_COOKIE_MAX_AGE,
      sameSite: "lax",
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
    });
  }
  return res;
}
