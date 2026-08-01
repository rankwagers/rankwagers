import { BLOCKED_COUNTRIES, isAllowedCountry } from "./countries";

/** tr-only (varsayılan): yalnızca engelli ülke IP (TR). strict: + VPN/bot + tr Accept-Language */
export function isStrictGeoAccess(): boolean {
  const mode = (process.env.GEO_ACCESS_MODE || "tr-only").toLowerCase();
  return mode === "strict";
}

// Edge tarafında ülke tespiti: Cloudflare / Vercel header'ları.
export function detectCountry(headers: Headers): string | null {
  const candidates = [
    headers.get("cf-ipcountry"),
    headers.get("x-vercel-ip-country"),
    headers.get("x-country"),
  ];
  for (const c of candidates) {
    if (c && c !== "XX") return c.toUpperCase();
  }
  // Lokal geliştirmede CF header'ı yoktur; izinli bir ülkeyi taklit et.
  // Üretimde (NODE_ENV=production) bu devreye GİRMEZ, gerçek IP ülkesi kullanılır.
  if (process.env.NODE_ENV !== "production") {
    return (process.env.DEV_COUNTRY || "NG").toUpperCase();
  }
  return null;
}

// Cloudflare bot yönetimi / tehdit skoru header'ı (varsa) ile basit VPN sinyali.
// Not: Datacenter/VPN tespiti için asıl güç IP intelligence servisidir;
// burada header tabanlı hızlı sinyaller değerlendirilir.
export function looksLikeVpn(headers: Headers): boolean {
  // Cloudflare Enterprise bot score (varsa)
  const botScore = headers.get("cf-bot-score");
  if (botScore && Number(botScore) > 0 && Number(botScore) < 5) return true;

  // Kendi upstream'inizin işaretleyebileceği bayrak
  const proxyFlag = headers.get("x-proxy-detected");
  if (proxyFlag === "1" || proxyFlag === "true") return true;

  return false;
}

// Tarayıcı dili/timezone ile ülke çapraz kontrolü (yumuşak sinyal).
// IP ülkesi izinli ama Accept-Language tr ise şüphelidir.
export function languageContradictsCountry(
  headers: Headers,
  country: string | null
): boolean {
  if (!country) return false;
  const al = (headers.get("accept-language") || "").toLowerCase();
  // Türkçe tercih eden ama izinli ülke IP'si => muhtemel TR + VPN
  if (al.startsWith("tr") || al.includes(",tr") || al.includes(" tr")) {
    return true;
  }
  return false;
}

export type AccessDecision =
  | { allow: true; country: string }
  | { allow: false; reason: "blocked_country" | "vpn" | "not_allowed" };

export function decideAccess(headers: Headers): AccessDecision {
  const country = detectCountry(headers);

  if (country && BLOCKED_COUNTRIES.has(country)) {
    return { allow: false, reason: "blocked_country" };
  }

  // strict: VPN/bot skoru + Türkçe tarayıcı + yabancı IP (GEO_ACCESS_MODE=strict)
  const devBypass = process.env.NODE_ENV !== "production";
  if (
    isStrictGeoAccess() &&
    !devBypass &&
    (looksLikeVpn(headers) || languageContradictsCountry(headers, country))
  ) {
    return { allow: false, reason: "vpn" };
  }

  if (!isAllowedCountry(country)) {
    return { allow: false, reason: "blocked_country" };
  }

  return { allow: true, country: country ?? "" };
}
