import { EXPERIMENT_EXPORT_MAX_ROWS } from "./contracts";

export function experimentToCsv(rows: Array<Record<string, unknown>>): string {
  const limited = rows.slice(0, EXPERIMENT_EXPORT_MAX_ROWS);
  if (limited.length === 0) return "empty\n";
  const keys = [...new Set(limited.flatMap((r) => Object.keys(r)))];
  const esc = (v: unknown) => {
    if (v == null) return "";
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return `${[keys.join(","), ...limited.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n")}\n`;
}

export function experimentToJson(payload: unknown): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

const FORBIDDEN = [
  "secret",
  "token",
  "signature",
  "password",
  "ip",
  "userAgent",
  "user_agent",
  "rawDestination",
];

export function stripSensitive<T extends Record<string, unknown>>(row: T): T {
  const out = { ...row };
  for (const k of Object.keys(out)) {
    if (FORBIDDEN.some((f) => k.toLowerCase().includes(f.toLowerCase()))) {
      delete out[k];
    }
  }
  return out;
}
