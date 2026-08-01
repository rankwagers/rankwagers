import { createHash, randomBytes } from "node:crypto";

export function computeChecksum(payload: unknown): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

export function newSnapshotId(checksum: string): string {
  const salt = randomBytes(4).toString("hex");
  return `psnap_${checksum.slice(0, 16)}_${salt}`;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = sortKeys(obj[key]);
    }
    return out;
  }
  return value;
}
