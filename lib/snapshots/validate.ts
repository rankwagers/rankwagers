import type { ComboSnapshotPayload } from "./types";

const MAX_FIXTURES = 400;
const MAX_ODDS = 800;
const MAX_PAYLOAD_CHARS = 1_500_000;

export type ValidationResult =
  | { ok: true; payload: ComboSnapshotPayload }
  | { ok: false; errorCode: string };

export function validateComboSnapshotPayload(
  raw: unknown
): ValidationResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, errorCode: "payload_missing" };
  }
  const p = raw as Partial<ComboSnapshotPayload>;
  if (p.version !== 1) return { ok: false, errorCode: "payload_version" };
  if (typeof p.date !== "string") return { ok: false, errorCode: "payload_date" };
  if (typeof p.generatedAt !== "string") {
    return { ok: false, errorCode: "payload_generated_at" };
  }
  if (!Array.isArray(p.fixtures) || !Array.isArray(p.odds)) {
    return { ok: false, errorCode: "payload_arrays" };
  }
  if (p.fixtures.length > MAX_FIXTURES) {
    return { ok: false, errorCode: "payload_fixtures_cap" };
  }
  if (p.odds.length > MAX_ODDS) {
    return { ok: false, errorCode: "payload_odds_cap" };
  }
  const serialized = JSON.stringify(p);
  if (serialized.length > MAX_PAYLOAD_CHARS) {
    return { ok: false, errorCode: "payload_too_large" };
  }
  if (!p.empty && p.fixtures.length === 0) {
    return { ok: false, errorCode: "payload_empty_nonempty_flag" };
  }

  return {
    ok: true,
    payload: {
      version: 1,
      date: p.date,
      generatedAt: p.generatedAt,
      empty: Boolean(p.empty),
      oddsFreshness: typeof p.oddsFreshness === "string" ? p.oddsFreshness : "unknown",
      fixtureCount: p.fixtures.length,
      oddsCount: p.odds.length,
      fixtures: p.fixtures,
      odds: p.odds,
    },
  };
}
