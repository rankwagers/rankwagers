import "server-only";
import type { LedgerEnvironment, LedgerEventBase, ProvenanceConfidence } from "./contracts";
import { LEDGER_SCHEMA_VERSION } from "./contracts";
import { appendEventFile, lastEventForAggregate } from "./adapters/file";
import { payloadHash } from "./hashes";
import { mintEventId } from "./identifiers";
import { validateEventShape } from "./validation";
import { resolveLedgerEnvironment } from "./environment";

export type AppendInput = {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  occurredAt?: string;
  source: string;
  requestId?: string | null;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  provenanceConfidence?: ProvenanceConfidence;
  causationId?: string | null;
  correlationId?: string | null;
  environment?: LedgerEnvironment;
};

export async function appendLedgerEvent(
  input: AppendInput,
): Promise<{ ok: true; appended: boolean; event: LedgerEventBase } | { ok: false; error: string }> {
  const recordedAt = new Date().toISOString();
  const previous = await lastEventForAggregate(input.aggregateId);
  const sequence = (previous?.sequence ?? 0) + 1;
  const pHash = payloadHash(input.payload);
  const eventId = mintEventId(
    `${input.idempotencyKey}|${input.eventType}|${input.aggregateId}`,
  );

  const event: LedgerEventBase = {
    eventId,
    eventType: input.eventType,
    schemaVersion: LEDGER_SCHEMA_VERSION,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    sequence,
    occurredAt: input.occurredAt ?? recordedAt,
    recordedAt,
    source: input.source,
    requestId: input.requestId ?? null,
    idempotencyKey: input.idempotencyKey,
    payloadHash: pHash,
    previousEventHash: previous?.payloadHash ?? null,
    environment: input.environment ?? resolveLedgerEnvironment(),
    provenanceConfidence: input.provenanceConfidence ?? "AUTHORITATIVE",
    causationId: input.causationId ?? null,
    correlationId: input.correlationId ?? null,
    payload: input.payload,
  };

  const shape = validateEventShape(event);
  if (!shape.ok) {
    return { ok: false, error: shape.errors.join("; ") };
  }

  try {
    const result = await appendEventFile(event);
    return { ok: true, appended: result.appended, event: result.event };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "append_failed",
    };
  }
}

/** Fail-open helper for public paths — never throws. */
export async function appendLedgerEventSafe(
  input: AppendInput,
): Promise<void> {
  try {
    await appendLedgerEvent(input);
  } catch {
    /* fail-open */
  }
}
