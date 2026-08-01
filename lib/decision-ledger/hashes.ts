import { createHash } from "node:crypto";

/** Canonical JSON: sorted keys, no undefined. */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalize(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`)
    .join(",")}}`;
}

export function payloadHash(payload: Record<string, unknown>): string {
  return createHash("sha256").update(canonicalize(payload), "utf8").digest("hex");
}

export function eventContentHash(input: {
  eventType: string;
  aggregateId: string;
  idempotencyKey: string;
  payloadHash: string;
  previousEventHash: string | null;
}): string {
  return createHash("sha256")
    .update(
      canonicalize({
        eventType: input.eventType,
        aggregateId: input.aggregateId,
        idempotencyKey: input.idempotencyKey,
        payloadHash: input.payloadHash,
        previousEventHash: input.previousEventHash,
      }),
      "utf8",
    )
    .digest("hex");
}

export function verifyPayloadHash(
  payload: Record<string, unknown>,
  expected: string,
): boolean {
  return payloadHash(payload) === expected;
}
