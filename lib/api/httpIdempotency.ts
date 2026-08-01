import { createHash } from "node:crypto";
import { canonicalizeToJson } from "@/lib/builder-approval/checksum";

/**
 * HTTP request-replay idempotency (Sprint 20B-B, stage B3).
 *
 * This is the ONE subsystem B3 adds, because the repository genuinely had none. The existing
 * idempotency in `lib/builder-approval` is DOMAIN idempotency — a key stored alongside the
 * candidate row, specific to candidate creation. It cannot express "replay this HTTP response",
 * which is what an operator double-clicking Approve actually needs.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DURABILITY: MEMORY ONLY. PROCESS-LOCAL.
 * ─────────────────────────────────────────────────────────────────────────────
 * Records live in a module-scope Map. They do NOT survive a restart and are NOT shared between
 * processes or instances. Under more than one Node process, two concurrent identical requests
 * that land on different processes will BOTH execute. No cross-process replay protection is
 * claimed, and none exists. What still protects correctness in that case is the B1/B2
 * optimistic concurrency layer: the second request loses on expectedVersion and returns a typed
 * conflict rather than duplicating the mutation. Idempotency is a usability and
 * response-stability mechanism here; it is NOT the concurrency guarantee.
 *
 * RELATIONSHIP TO expectedVersion.
 * Idempotency never replaces the optimistic precondition. Every mutation route still requires
 * `expectedVersion` in the body, and the domain layer still enforces it.
 *
 * SECRETS.
 * A record stores the idempotency key only as a SHA-256 digest, and stores no credential,
 * cookie, Authorization header or CSRF value. The actor scope is an opaque identifier supplied
 * by the caller, never a token.
 */

export const IDEMPOTENCY_KEY_MIN_LENGTH = 8;
export const IDEMPOTENCY_KEY_MAX_LENGTH = 200;
const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9._:-]+$/;

/** 24 hours. Long enough for a human retry, short enough to bound memory. */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
/** Hard cap on retained records; the oldest are evicted first. */
export const IDEMPOTENCY_MAX_RECORDS = 5_000;

export type IdempotencyScope = {
  /** Server-derived actor. Two actors can never share a record. */
  actorId: string;
  /** Route/action family, e.g. "candidate.approve". */
  action: string;
  /** The resource the mutation targets. */
  targetId: string;
};

export type StoredHttpResponse = {
  status: number;
  body: Record<string, unknown>;
};

export type IdempotencyKeyCheck =
  | { ok: true; key: string }
  | { ok: false; reason: "missing" | "too_short" | "too_long" | "invalid_characters" };

export function validateIdempotencyKey(raw: unknown): IdempotencyKeyCheck {
  if (typeof raw !== "string") return { ok: false, reason: "missing" };
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: false, reason: "missing" };
  if (trimmed.length < IDEMPOTENCY_KEY_MIN_LENGTH) return { ok: false, reason: "too_short" };
  if (trimmed.length > IDEMPOTENCY_KEY_MAX_LENGTH) return { ok: false, reason: "too_long" };
  if (!IDEMPOTENCY_KEY_RE.test(trimmed)) return { ok: false, reason: "invalid_characters" };
  return { ok: true, key: trimmed };
}

function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Fingerprint of the request payload.
 *
 * Canonicalized with the repository's existing canonical-JSON encoder (sorted keys, and a hard
 * rejection of `undefined`, sparse arrays, NaN, Infinity and prototype-pollution keys), so two
 * requests that differ only in key order are the same request, and two that differ in any value
 * are not. A body that cannot be canonicalized yields a distinct sentinel rather than throwing,
 * because a malformed body must still be able to CONFLICT with a stored record.
 */
export function fingerprintRequest(body: unknown): string {
  const canonical = canonicalizeToJson(body ?? {});
  return canonical.ok ? sha256(canonical.json) : `uncanonicalizable:${sha256(String(body))}`;
}

type Settled = {
  state: "settled";
  fingerprint: string;
  response: StoredHttpResponse;
  storedAt: number;
  expiresAt: number;
};

type InFlight = {
  state: "in_flight";
  fingerprint: string;
  storedAt: number;
  expiresAt: number;
  promise: Promise<StoredHttpResponse | null>;
};

type Record_ = Settled | InFlight;

const records = new Map<string, Record_>();

function storageKey(scope: IdempotencyScope, key: string): string {
  // Every component is length-prefixed so no combination of values can be made to collide by
  // embedding the separator: actor "a|b" + action "c" must not equal actor "a" + action "b|c".
  const parts = [scope.actorId, scope.action, scope.targetId, sha256(key)];
  return parts.map((p) => `${p.length}:${p}`).join("|");
}

function sweep(now: number): void {
  for (const [k, v] of records) {
    if (v.expiresAt <= now) records.delete(k);
  }
  if (records.size <= IDEMPOTENCY_MAX_RECORDS) return;
  // Map preserves insertion order, so the head is the oldest.
  const excess = records.size - IDEMPOTENCY_MAX_RECORDS;
  let removed = 0;
  for (const k of records.keys()) {
    if (removed >= excess) break;
    records.delete(k);
    removed++;
  }
}

/**
 * Which responses are worth remembering.
 *
 *  2xx  — the mutation happened. Replaying is the entire point.
 *  409  — a deterministic domain conflict (status/version/already-converted). The same request
 *         would produce the same answer, so replaying is stable and cheap.
 *
 * Everything else is deliberately NOT stored:
 *  4xx validation (400/403/404/415/422) — nothing was mutated, and a caller who fixes their
 *      body should be allowed to retry rather than being permanently pinned to their mistake.
 *  5xx — transient by definition. Pinning a caller to a 500 would turn a recoverable blip into
 *      a permanent failure for that key.
 *
 * Consequence, stated plainly: fingerprint-conflict detection only applies once a record
 * EXISTS. A key whose first use failed validation is not yet bound to any payload.
 */
export function shouldPersist(status: number): boolean {
  if (status >= 200 && status < 300) return true;
  return status === 409;
}

export type IdempotentOutcome =
  | { kind: "executed"; response: StoredHttpResponse }
  | { kind: "replayed"; response: StoredHttpResponse }
  | { kind: "conflict" };

/**
 * Run `execute` at most once per (scope, key), replaying the stored response afterwards.
 *
 * Concurrency: the in-flight record is inserted BEFORE `execute` is awaited, so a second
 * caller arriving while the first is still running finds it and awaits the same promise rather
 * than starting a second mutation.
 */
export async function withHttpIdempotency(input: {
  key: string;
  scope: IdempotencyScope;
  fingerprint: string;
  execute: () => Promise<StoredHttpResponse>;
  now?: number;
}): Promise<IdempotentOutcome> {
  const now = input.now ?? Date.now();
  sweep(now);

  const id = storageKey(input.scope, input.key);
  const existing = records.get(id);

  if (existing && existing.expiresAt > now) {
    if (existing.fingerprint !== input.fingerprint) return { kind: "conflict" };
    if (existing.state === "settled") {
      return { kind: "replayed", response: existing.response };
    }
    // In flight with the same payload: wait for the first caller's result.
    const awaited = await existing.promise;
    if (awaited) return { kind: "replayed", response: awaited };
    // The first caller produced a non-persistable response (validation or 5xx). Fall through
    // and execute, because nothing was committed on its behalf.
  }

  let settle!: (value: StoredHttpResponse | null) => void;
  const promise = new Promise<StoredHttpResponse | null>((resolve) => {
    settle = resolve;
  });

  records.set(id, {
    state: "in_flight",
    fingerprint: input.fingerprint,
    storedAt: now,
    expiresAt: now + IDEMPOTENCY_TTL_MS,
    promise,
  });

  let response: StoredHttpResponse;
  try {
    response = await input.execute();
  } catch (err) {
    records.delete(id);
    settle(null);
    throw err;
  }

  if (shouldPersist(response.status)) {
    records.set(id, {
      state: "settled",
      fingerprint: input.fingerprint,
      response,
      storedAt: now,
      expiresAt: now + IDEMPOTENCY_TTL_MS,
    });
    settle(response);
  } else {
    records.delete(id);
    settle(null);
  }

  return { kind: "executed", response };
}

/** Reported by the routes so an operator is never misled about the guarantee. */
export function describeIdempotencyDurability(): {
  mode: "memory";
  durable: false;
  processLocal: true;
  crossProcessReplayProtection: false;
} {
  return {
    mode: "memory",
    durable: false,
    processLocal: true,
    crossProcessReplayProtection: false,
  };
}

/** Test-only introspection and reset. */
export function resetHttpIdempotencyForTests(): void {
  records.clear();
}

export function httpIdempotencyRecordCount(): number {
  return records.size;
}
