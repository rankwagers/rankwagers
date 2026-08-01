import { CALIBRATION_EXPORT_MAX_ROWS } from "./contracts";

export function calibrationToCsv(
  rows: Array<Record<string, unknown>>,
): string {
  const limited = rows.slice(0, CALIBRATION_EXPORT_MAX_ROWS);
  if (limited.length === 0) return "empty\n";
  const keys = [...new Set(limited.flatMap((r) => Object.keys(r)))];
  const esc = (v: unknown) => {
    if (v == null) return "";
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [keys.join(",")];
  for (const row of limited) {
    lines.push(keys.map((k) => esc(row[k])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function calibrationToJson(payload: unknown): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

const FORBIDDEN_KEYS = [
  "secret",
  "token",
  "signature",
  "password",
  "apiKey",
  "api_key",
  "rawProvider",
  "providerPayload",
  "signed",
];

export function stripSecrets<T extends Record<string, unknown>>(row: T): T {
  const out = { ...row };
  for (const k of Object.keys(out)) {
    if (FORBIDDEN_KEYS.some((f) => k.toLowerCase().includes(f.toLowerCase()))) {
      delete out[k];
    }
  }
  return out;
}
