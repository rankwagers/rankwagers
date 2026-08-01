/**
 * Decision Ledger contracts (Sprint 26).
 * Append-only immutable events — not a blockchain.
 */

export type LedgerEnvironment = "LOCAL" | "TEST" | "STAGING" | "PRODUCTION";

export type TimestampProvenance = "EXACT" | "PROXY" | "UNKNOWN";

export type SettlementOutcome =
  | "WON"
  | "LOST"
  | "VOID"
  | "PENDING"
  | "UNRESOLVED"
  | "INVALID"
  | "PARTIAL_VOID";

export type ProvenanceConfidence =
  | "AUTHORITATIVE"
  | "VERIFIED"
  | "DERIVED"
  | "PROXY"
  | "UNKNOWN";

export type BackfillClass =
  | "EXACT_SNAPSHOT"
  | "PARTIAL_SNAPSHOT"
  | "RECONSTRUCTED"
  | "PROXY_TIMESTAMP"
  | "UNLINKABLE"
  | "UNSAFE_TO_BACKFILL";

export type LedgerCapabilityStatus =
  | "LEDGER_EXACT"
  | "LEDGER_PARTIAL"
  | "LEGACY_PROXY"
  | "UNAVAILABLE";

export type LedgerSection =
  | "overview"
  | "events"
  | "predictions"
  | "builder"
  | "combinations"
  | "settlements"
  | "integrity"
  | "reconciliation"
  | "backfill"
  | "methodology";

export type LedgerFilters = {
  eventType: string | null;
  entityType: string | null;
  from: string | null;
  to: string | null;
  q: string | null;
  offset: number;
  limit: number;
};

export type LedgerEventBase = {
  eventId: string;
  eventType: string;
  schemaVersion: string;
  aggregateType: string;
  aggregateId: string;
  sequence: number;
  occurredAt: string;
  recordedAt: string;
  source: string;
  requestId: string | null;
  idempotencyKey: string;
  payloadHash: string;
  previousEventHash: string | null;
  environment: LedgerEnvironment;
  provenanceConfidence: ProvenanceConfidence;
  causationId: string | null;
  correlationId: string | null;
  payload: Record<string, unknown>;
};

export const LEDGER_METHODOLOGY_VERSION = "26.0.0";
export const LEDGER_SCHEMA_VERSION = "26.0.0";
export const LEDGER_EXPORT_MAX_ROWS = 2_000;
export const LEDGER_DEFAULT_PAGE_SIZE = 50;
export const LEDGER_MAX_PAGE_SIZE = 200;
export const LEDGER_MAX_CANDIDATES_PER_GENERATION = 120;
