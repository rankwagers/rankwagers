import { isLocale, type Locale } from "./i18n";

export function parseAcceptLanguage(header: string | null): string[] {
  if (!header) return [];
  const out: string[] = [];
  for (const part of header.split(",")) {
    const raw = part.trim().split(";")[0].toLowerCase();
    if (!raw) continue;
    const primary = raw.split("-")[0];
    if (primary && !out.includes(primary)) out.push(primary);
    if (raw.includes("-") && !out.includes(raw)) out.push(raw);
  }
  return out;
}

export function firstLocaleMatch(al: string[], candidates: Locale[]): Locale | null {
  for (const code of al) {
    if (isLocale(code)) return code;
    const primary = code.split("-")[0];
    for (const loc of candidates) {
      if (loc === primary || loc.startsWith(`${primary}-`)) return loc;
    }
  }
  for (const loc of candidates) {
    if (al.includes(loc)) return loc;
  }
  return null;
}
