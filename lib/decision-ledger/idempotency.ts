import { createHash } from "node:crypto";

export function buildIdempotencyKey(parts: Array<string | number | null | undefined>): string {
  const material = parts.map((p) => (p == null ? "" : String(p))).join("|");
  return createHash("sha256").update(material, "utf8").digest("hex").slice(0, 40);
}
