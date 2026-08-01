import type { AdminDashboardSection } from "./contracts";

/** Flatten nested dashboard JSON into CSV-safe rows (no internal IDs). */
export function dashboardToCsv(
  section: AdminDashboardSection,
  payload: Record<string, unknown>
): string {
  const rows: string[][] = [["section", "key", "value"]];
  const flat = flatten(payload, "");
  for (const [key, value] of Object.entries(flat)) {
    if (key.includes("requestId") || key.includes("signedHref") || key.endsWith(".id")) {
      continue;
    }
    rows.push([section, key, value]);
  }
  return rows.map((r) => r.map(csvEscape).join(",")).join("\n");
}

export function dashboardToJson(
  section: AdminDashboardSection,
  payload: Record<string, unknown>
): string {
  const cleaned = JSON.parse(JSON.stringify(payload, (k, v) => {
    if (typeof k === "string" && /(requestId|signedHref|\.id$)/i.test(k)) {
      return undefined;
    }
    return v;
  }));
  return JSON.stringify({ section, ...cleaned }, null, 2);
}

function flatten(
  obj: unknown,
  prefix: string
): Record<string, string> {
  const out: Record<string, string> = {};
  if (obj == null) {
    out[prefix || "value"] = "";
    return out;
  }
  if (typeof obj !== "object") {
    out[prefix || "value"] = String(obj);
    return out;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      Object.assign(out, flatten(item, `${prefix}[${i}]`));
    });
    return out;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && "available" in (v as object)) {
      const m = v as { available: boolean; value?: unknown; reason?: string };
      out[path] = m.available ? String(m.value) : `Unavailable: ${m.reason ?? ""}`;
    } else {
      Object.assign(out, flatten(v, path));
    }
  }
  return out;
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
