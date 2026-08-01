import type { AccaRecord, AccaStatus } from "./contracts";

/**
 * Public freshness and availability state for a published Acca (Sprint 24).
 *
 * PURE. No I/O, no clock of its own — `now` is always supplied by the caller, so the same record
 * renders identically on the server, in a test and in a snapshot comparison.
 *
 * WHY TWO DIMENSIONS RATHER THAN ONE STATUS
 *
 * "Stale" and "expired" are different facts about a published Acca and collapsing them into one
 * badge would misdescribe both:
 *
 *   AVAILABILITY  — derived from the stored kick-off times. It answers "can these selections
 *                   still be taken?" A fixture that has kicked off is closed whether the page was
 *                   published a minute ago or a month ago.
 *   ODDS FRESHNESS — derived from the capture timestamp. It answers "how old is the price we are
 *                   showing?" The publication snapshot is immutable and is never re-fetched, so
 *                   the honest thing is to state its age rather than quietly refresh it.
 *
 * WHAT IS DELIBERATELY NOT MODELLED
 *
 * Settlement. An `AccaRecord` carries no result for any leg — the Builder Approval chain copies
 * a pre-kick-off snapshot and nothing writes back to it. Reporting a "settled" state would mean
 * inventing one, so `settlement` is a single honest value: NOT_RECORDED. If a later sprint adds
 * real settlement data to the record, this is the one place that has to change.
 *
 * Likewise nothing here polls, re-fetches or estimates. Every value is a function of fields the
 * immutable snapshot already carries plus the caller's clock.
 */

/* ------------------------------------------------------------------ *
 * Vocabulary
 * ------------------------------------------------------------------ */

export type AccaAvailabilityState =
  /** Every kick-off is still ahead. */
  | "ACTIVE"
  /** At least one kick-off has passed and at least one has not. */
  | "PARTIALLY_STARTED"
  /** Every kick-off has passed. */
  | "EXPIRED"
  /** Withdrawn by an operator. Never publicly reachable; present so admin surfaces agree. */
  | "WITHDRAWN"
  /** No kick-off on the record could be parsed. Stated, never guessed. */
  | "UNKNOWN";

export const ACCA_AVAILABILITY_STATES: readonly AccaAvailabilityState[] = [
  "ACTIVE",
  "PARTIALLY_STARTED",
  "EXPIRED",
  "WITHDRAWN",
  "UNKNOWN",
];

export type AccaOddsFreshness = "FRESH" | "STALE" | "UNKNOWN";

export const ACCA_ODDS_FRESHNESS_STATES: readonly AccaOddsFreshness[] = [
  "FRESH",
  "STALE",
  "UNKNOWN",
];

/**
 * The only settlement value this domain can support.
 *
 * Kept as a one-member union rather than a boolean so a future sprint that genuinely records
 * settlement extends the union and every exhaustive switch fails to compile until it is handled.
 */
export type AccaSettlementState = "NOT_RECORDED";

/* ------------------------------------------------------------------ *
 * Stale-state policy
 * ------------------------------------------------------------------ */

/**
 * How old a captured price may be before the page says so.
 *
 * 24 hours, chosen to match the Builder's own daily list cycle: the lists an Acca is drawn from
 * are rebuilt each day, so a price older than one cycle is one a reader should not assume is
 * still on offer. It is a display honesty threshold only — nothing expires, nothing is hidden,
 * and no page is de-indexed because of it.
 *
 * Deliberately a constant rather than an environment variable: a disclosure that varies between
 * deployments is not a disclosure, and it would make the same page tell two readers different
 * things about the same stored value.
 */
export const ACCA_ODDS_STALE_AFTER_HOURS = 24;

const MS_PER_HOUR = 3_600_000;

/* ------------------------------------------------------------------ *
 * Derivation
 * ------------------------------------------------------------------ */

export type AccaFreshness = {
  availability: AccaAvailabilityState;
  oddsFreshness: AccaOddsFreshness;
  settlement: AccaSettlementState;
  /** ISO-8601, or null when no leg carried a parseable kick-off. */
  earliestKickoffAt: string | null;
  latestKickoffAt: string | null;
  /** When the prices on this page were captured. Always the creation timestamp. */
  oddsCapturedAt: string;
  /** Whole hours since capture, or null when the timestamp is unparseable. */
  oddsAgeHours: number | null;
  legsStarted: number;
  legCount: number;
  /** The threshold that produced `oddsFreshness`, so a surface can state it. */
  staleAfterHours: number;
};

function parseMs(value: unknown): number | null {
  if (typeof value !== "string" || value === "") return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Derive the public freshness view of a stored Acca.
 *
 * `now` is required. A default clock here would make every consumer's output depend on when it
 * happened to run, which is exactly the property that makes a page untestable.
 */
export function accaFreshness(acca: AccaRecord, now: string | Date): AccaFreshness {
  const nowMs = now instanceof Date ? now.getTime() : parseMs(now);
  const kickoffs = acca.legs
    .map((leg) => parseMs(leg.kickoffAt))
    .filter((ms): ms is number => ms !== null);

  const earliest = kickoffs.length ? Math.min(...kickoffs) : null;
  const latest = kickoffs.length ? Math.max(...kickoffs) : null;
  const legsStarted =
    nowMs === null ? 0 : kickoffs.filter((ms) => ms <= nowMs).length;

  const availability = deriveAvailability({
    status: acca.status,
    nowMs,
    kickoffCount: kickoffs.length,
    legCount: acca.legs.length,
    legsStarted,
  });

  const capturedMs = parseMs(acca.createdAt);
  const oddsAgeHours =
    capturedMs === null || nowMs === null
      ? null
      : Math.max(0, Math.floor((nowMs - capturedMs) / MS_PER_HOUR));

  const oddsFreshness: AccaOddsFreshness =
    oddsAgeHours === null
      ? "UNKNOWN"
      : oddsAgeHours >= ACCA_ODDS_STALE_AFTER_HOURS
        ? "STALE"
        : "FRESH";

  return {
    availability,
    oddsFreshness,
    settlement: "NOT_RECORDED",
    earliestKickoffAt: earliest === null ? null : new Date(earliest).toISOString(),
    latestKickoffAt: latest === null ? null : new Date(latest).toISOString(),
    oddsCapturedAt: acca.createdAt,
    oddsAgeHours,
    legsStarted,
    legCount: acca.legs.length,
    staleAfterHours: ACCA_ODDS_STALE_AFTER_HOURS,
  };
}

function deriveAvailability(input: {
  status: AccaStatus;
  nowMs: number | null;
  kickoffCount: number;
  legCount: number;
  legsStarted: number;
}): AccaAvailabilityState {
  // Withdrawal outranks everything: an archived record's kick-off times are irrelevant to a
  // reader, because the record is gone from every public surface regardless.
  if (input.status === "ARCHIVED") return "WITHDRAWN";
  if (input.nowMs === null) return "UNKNOWN";
  // A partial parse is still a gap: reporting ACTIVE while one leg's kick-off is unreadable
  // would assert something the record does not support.
  if (input.kickoffCount === 0 || input.kickoffCount !== input.legCount) return "UNKNOWN";
  if (input.legsStarted === 0) return "ACTIVE";
  if (input.legsStarted === input.legCount) return "EXPIRED";
  return "PARTIALLY_STARTED";
}

/* ------------------------------------------------------------------ *
 * Labels
 * ------------------------------------------------------------------ */

export type FreshnessLabel = {
  /** Short label. Carries the meaning on its own — status is never colour-only. */
  label: string;
  /** One sentence explaining what the state means for a reader. */
  detail: string;
};

export function availabilityLabel(state: AccaAvailabilityState): FreshnessLabel {
  switch (state) {
    case "ACTIVE":
      return {
        label: "Current",
        detail:
          "Every fixture in this combination is still ahead of its kick-off at the time this page was rendered.",
      };
    case "PARTIALLY_STARTED":
      return {
        label: "Partly under way",
        detail:
          "At least one fixture has already kicked off. Those selections can no longer be taken; the rest have not started.",
      };
    case "EXPIRED":
      return {
        label: "Closed",
        detail:
          "Every fixture has kicked off. This page is kept as a record of what was published and when.",
      };
    case "WITHDRAWN":
      return {
        label: "Withdrawn",
        detail: "This Acca was withdrawn by an administrator and is no longer published.",
      };
    case "UNKNOWN":
    default:
      return {
        label: "State not determinable",
        detail:
          "At least one kick-off time on this record could not be read, so its current state is not stated rather than guessed.",
      };
  }
}

export function oddsFreshnessLabel(
  state: AccaOddsFreshness,
  ageHours: number | null,
): FreshnessLabel {
  switch (state) {
    case "FRESH":
      return {
        label: "Captured within the last day",
        detail:
          "The prices below were recorded when this Acca was created and are shown exactly as captured. They are not re-checked.",
      };
    case "STALE":
      return {
        label:
          ageHours === null
            ? `Captured over ${ACCA_ODDS_STALE_AFTER_HOURS} hours ago`
            : `Captured ${ageHours} hours ago`,
        detail:
          "These prices are older than one daily list cycle. They may have moved or be unavailable everywhere. They are shown as captured because the published record must not change.",
      };
    case "UNKNOWN":
    default:
      return {
        label: "Capture time not readable",
        detail:
          "The capture timestamp on this record could not be read, so the age of these prices is not stated rather than guessed.",
      };
  }
}

export function settlementLabel(state: AccaSettlementState): FreshnessLabel {
  switch (state) {
    case "NOT_RECORDED":
    default:
      return {
        label: "Results not recorded here",
        detail:
          "A published Acca stores what was known before kick-off and is never written back to, so no outcome is recorded on this page. Settled single predictions are published in the archive.",
      };
  }
}

/**
 * Lower-case token for analytics.
 *
 * A single, stable vocabulary means dashboards can group by state without a mapping table, and it
 * keeps the analytics property free of display copy that will change.
 */
export function analyticsFreshnessState(freshness: AccaFreshness): string {
  return freshness.availability.toLowerCase();
}
