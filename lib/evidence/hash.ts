/**
 * Content hashing for immutable evidence rows.
 *
 * Deliberately self-contained (no import from the Sprint 26 decision ledger) so the
 * evidence archive's integrity guarantee does not depend on another sprint's module
 * staying put. The canonicalization rules are the same shape on purpose: sorted keys,
 * dropped `undefined`, arrays in order.
 *
 * Node-only: imports `node:crypto`. Never import this from a Client Component — use
 * `@/lib/evidence/presentation` for anything the browser renders.
 */

import { createHash } from "node:crypto";

/** Canonical JSON: object keys sorted, `undefined` members dropped, arrays ordered. */
export function canonicalizeEvidence(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value ?? null);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalizeEvidence(entry)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${canonicalizeEvidence(record[key])}`)
    .join(",")}}`;
}

/** sha256 of the canonical form, hex encoded. */
export function evidenceContentHash(body: Record<string, unknown>): string {
  return createHash("sha256")
    .update(canonicalizeEvidence(body), "utf8")
    .digest("hex");
}

/**
 * Recompute and compare. Used by integrity checks at read time — a mismatch means the
 * row was edited in place, which the archive contract forbids.
 */
export function verifyEvidenceContentHash(
  body: Record<string, unknown>,
  expected: string
): boolean {
  return evidenceContentHash(body) === expected;
}
