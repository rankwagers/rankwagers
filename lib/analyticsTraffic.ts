import type { SiteEvent } from "./events";

/** Kayıt dışı bırakılan otomatik / geliştirme istekleri */
const TEST_OR_BOT_UA =
  /curl\/|WindowsPowerShell|HeadlessChrome|Googlebot|bingbot|SemrushBot|AhrefsBot|Bytespider|GPTBot|python-requests|axios\/|Go-http-client|wget\/|Dataprovider\.com|BuiltWith\//i;

export function shouldRecordPath(pathname: string): boolean {
  const path = (pathname || "/").split("?")[0];
  if (path === "/admin" || path.startsWith("/admin/")) return false;
  if (path.startsWith("/api/")) return false;
  if (path === "/not-available") return false;
  return true;
}

export function shouldLogUserAgent(ua: string): boolean {
  if (!ua.trim()) return true;
  return !TEST_OR_BOT_UA.test(ua);
}

export function isInternalOrTestEvent(e: SiteEvent): boolean {
  if (!shouldRecordPath(e.path)) return true;

  const ip = (e.ip || "").trim().toLowerCase();
  if (
    ip === "::1" ||
    ip === "127.0.0.1" ||
    ip.startsWith("127.") ||
    ip === "localhost"
  ) {
    return true;
  }

  if (!shouldLogUserAgent(e.ua || "")) return true;

  const referer = e.referer || "";
  if (/localhost|127\.0\.0\.1/i.test(referer)) return true;

  // Eski demo / mock marka slug'ı
  if (e.brand === "brand-one") return true;

  return false;
}
