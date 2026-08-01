import { SEO_EXPORT_MAX_ROWS, type SeoSection } from "./contracts";

export function seoToCsv(
  section: SeoSection,
  rows: Array<Record<string, unknown>>
): string {
  const limited = rows.slice(0, SEO_EXPORT_MAX_ROWS);
  if (!limited.length) {
    return "section,note\n" + `${section},empty`;
  }
  const keys = Object.keys(flattenRow(limited[0]!));
  const lines = [keys.join(",")];
  for (const row of limited) {
    const flat = flattenRow(row);
    lines.push(keys.map((k) => csvEscape(flat[k] ?? "")).join(","));
  }
  return lines.join("\n");
}

export function seoToJson(
  section: SeoSection,
  payload: unknown
): string {
  const cleaned = JSON.parse(
    JSON.stringify(payload, (k, v) => {
      if (typeof k === "string" && /(secret|password|token|signedHref)/i.test(k)) {
        return undefined;
      }
      return v;
    })
  );
  if (Array.isArray(cleaned)) {
    return JSON.stringify(
      { section, count: Math.min(cleaned.length, SEO_EXPORT_MAX_ROWS), items: cleaned.slice(0, SEO_EXPORT_MAX_ROWS) },
      null,
      2
    );
  }
  return JSON.stringify({ section, ...cleaned }, null, 2);
}

function flattenRow(obj: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (/(secret|password|token|signedHref)/i.test(k)) continue;
    if (v == null) out[k] = "";
    else if (typeof v === "object") out[k] = JSON.stringify(v);
    else out[k] = String(v);
  }
  return out;
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
