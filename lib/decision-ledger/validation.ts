import type { LedgerEventBase } from "./contracts";
import { isLedgerEventType } from "./event-types";
import { verifyPayloadHash } from "./hashes";

const FORBIDDEN_PAYLOAD_KEYS = [
  "secret",
  "token",
  "signature",
  "password",
  "apiKey",
  "api_key",
  "authorization",
  "signedHref",
  "ctx",
];

export function validateEventShape(
  event: LedgerEventBase,
): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!event.eventId) errors.push("eventId required");
  if (!isLedgerEventType(event.eventType)) {
    errors.push(`unsupported eventType ${event.eventType}`);
  }
  if (!event.aggregateId) errors.push("aggregateId required");
  if (!event.idempotencyKey) errors.push("idempotencyKey required");
  if (!event.payloadHash) errors.push("payloadHash required");
  if (!verifyPayloadHash(event.payload, event.payloadHash)) {
    errors.push("payloadHash mismatch");
  }
  for (const key of Object.keys(event.payload)) {
    if (FORBIDDEN_PAYLOAD_KEYS.some((f) => key.toLowerCase().includes(f))) {
      errors.push(`forbidden payload key ${key}`);
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}

/** Reject unsupported post-kickoff publication revisions by default. */
export function mayRevisePublication(input: {
  kickoffAt: string | null;
  now?: number;
}): { allowed: boolean; reason: string } {
  if (!input.kickoffAt) {
    return { allowed: true, reason: "kickoff_unknown" };
  }
  const ko = Date.parse(input.kickoffAt);
  const now = input.now ?? Date.now();
  if (Number.isFinite(ko) && now >= ko) {
    return { allowed: false, reason: "post_kickoff_revision_rejected" };
  }
  return { allowed: true, reason: "pre_kickoff" };
}
