/**
 * M10 Stage 1 — pure capture candidate provider (spec §4.0 Option C, §2).
 *
 * Turns normalized daily-list predictions + archive-derived capture state into deterministic
 * `CaptureRequest[]`, plus aggregate diagnostics. Grouping is per fixture (a fixture may have
 * several daily-list tabs → one capture candidate per window carrying all its markets). The
 * pure planning step (`planCaptureCandidates`) does discovery/classification/ordering/bounded
 * selection with NO dependency; `buildCaptureCandidates` adds the single injected derivation
 * dependency (M4 fetch + M5 derive, wired later) to assemble the frozen `CaptureRequest`.
 *
 * The provider mints no identity, writes no archive, acquires no lock, reads no env, and reads
 * no clock — the evaluation instant and every dependency are injected.
 */

import {
  isValidFixtureId,
  isValidInstant,
} from "@/lib/evidence-capture/identity";
import { kindForMarketKey } from "@/lib/evidence-capture/markets";
import type { PublishedDailyPrediction } from "@/lib/evidence-capture/source";
import { normalizeBatchLimit } from "./limits";
import { compareCaptureCandidates, sortDeterministic } from "./ordering";
import { emptyCaptureDiagnostics, bumpReason } from "./diagnostics";
import { classifyCaptureFixture } from "./eligibility";
import type {
  CandidateDiagnostics,
  CaptureCandidateMarket,
  CaptureCandidatePlan,
  CaptureProviderDeps,
  CaptureProviderInput,
  CaptureProviderResult,
  CaptureRequest,
  PlannedCaptureCandidate,
} from "./types";

type Group = {
  fixtureId: number;
  kickoffAt: string;
  leagueCode: string;
  competitionLabel: string;
  markets: CaptureCandidateMarket[];
  marketKeys: Set<string>;
};

function requireValidEvalMs(evaluationInstant: string): number {
  const ms = Date.parse(evaluationInstant);
  if (!Number.isFinite(ms)) {
    throw new TypeError(
      `capture provider: evaluationInstant must be a valid instant, got "${evaluationInstant}"`
    );
  }
  return ms;
}

function requireValidLead(leadMinutes: number): void {
  if (!Number.isInteger(leadMinutes) || leadMinutes <= 0) {
    throw new TypeError(
      `capture provider: leadMinutes must be a positive integer, got ${String(leadMinutes)}`
    );
  }
}

/**
 * Pure plan: group → validate markets → classify → order → cap. No derivation, no deps.
 */
export function planCaptureCandidates(
  input: CaptureProviderInput
): CaptureCandidatePlan {
  const diag = emptyCaptureDiagnostics();
  const rejected = diag.candidatesRejectedByReason;
  const evalMs = requireValidEvalMs(input.evaluationInstant);
  requireValidLead(input.leadMinutes);

  const config = input.config ?? {};
  const supportedCompetitions =
    config.supportedCompetitions == null
      ? null
      : new Set(config.supportedCompetitions);

  const observedMs =
    config.sourceObservedAt && isValidInstant(config.sourceObservedAt)
      ? Date.parse(config.sourceObservedAt)
      : null;
  const stale =
    observedMs !== null &&
    typeof config.maxSourceAgeMs === "number" &&
    Number.isFinite(config.maxSourceAgeMs) &&
    config.maxSourceAgeMs > 0 &&
    evalMs - observedMs > config.maxSourceAgeMs;

  diag.sourceRowsDiscovered = input.sourceRows.length;

  // 1. Group rows by fixtureId with per-row identity + market validation.
  const groups = new Map<number, Group>();
  for (const raw of input.sourceRows) {
    const row = raw as PublishedDailyPrediction | null | undefined;
    if (row === null || typeof row !== "object") {
      diag.sourceRowsMalformed++;
      bumpReason(rejected, "malformed_source_row");
      continue;
    }
    if (!isValidFixtureId(row.fixtureId)) {
      diag.sourceRowsMalformed++;
      bumpReason(rejected, "missing_fixture_identity");
      continue;
    }
    // Market must be a known daily-list market with the canonical "over" selection.
    const kind = kindForMarketKey(row.marketKey);
    if (kind === null || kind !== row.marketKind || row.selectionKey !== "over") {
      bumpReason(rejected, "unsupported_market");
      continue;
    }

    let group = groups.get(row.fixtureId);
    if (!group) {
      group = {
        fixtureId: row.fixtureId,
        kickoffAt: row.kickoffAt,
        leagueCode: row.leagueCode,
        competitionLabel: row.competitionLabel,
        markets: [],
        marketKeys: new Set(),
      };
      groups.set(row.fixtureId, group);
    }
    if (group.marketKeys.has(row.marketKey)) {
      bumpReason(rejected, "duplicate_candidate");
      continue;
    }
    group.marketKeys.add(row.marketKey);
    // RC-1: a valid row admitted into a fixture group (row grain, distinct from the
    // fixture-grain `candidatesEligible`). N distinct-market rows for one fixture → N here, 1 there.
    diag.sourceRowsAdmitted++;
    group.markets.push({
      marketKey: row.marketKey,
      selectionKey: row.selectionKey,
      marketKind: row.marketKind,
      modelProbabilityPct: row.modelProbabilityPct,
    });
  }

  // RC-1: distinct fixture groups formed (row → fixture grain boundary).
  diag.groupedFixtures = groups.size;

  // 2. Classify each grouped fixture.
  const eligible: PlannedCaptureCandidate[] = [];
  for (const group of groups.values()) {
    const decision = classifyCaptureFixture(
      {
        fixtureId: group.fixtureId,
        kickoffAt: group.kickoffAt,
        leagueCode: group.leagueCode,
      },
      {
        evalMs,
        leadMinutes: input.leadMinutes,
        supportedCompetitions,
        capturedWindowKeys: input.archiveState.capturedWindowKeys,
        partialWindowKeys:
          input.archiveState.partialWindowKeys ?? new Set<string>(),
        stale,
      }
    );
    if (decision.status === "reject") {
      bumpReason(rejected, decision.reason);
      continue;
    }
    diag.candidatesEligible++;
    if (decision.healing) diag.candidatesHealing++;
    eligible.push({
      fixtureId: group.fixtureId,
      kickoffAt: group.kickoffAt,
      capturedAt: decision.capturedAt,
      windowKey: decision.windowKey,
      leagueCode: group.leagueCode,
      competitionLabel: group.competitionLabel,
      healing: decision.healing,
      // Markets in a stable, order-independent order.
      markets: sortDeterministic(group.markets, (a, b) =>
        a.marketKey < b.marketKey ? -1 : a.marketKey > b.marketKey ? 1 : 0
      ),
    });
  }

  // 3. Deterministic ordering + bounded selection.
  const ordered = sortDeterministic(eligible, compareCaptureCandidates);
  const ceiling = normalizeBatchLimit(config.maxCandidates);
  diag.effectiveCeiling = ceiling; // INV-C: `[1,150]`, default 100, never the 500 legacy default
  const selected = ordered.slice(0, ceiling);
  const deferred = ordered.slice(ceiling);

  diag.candidatesSelected = selected.length;
  diag.candidatesDeferredByCap = deferred.length;
  diag.backlogSize = deferred.length;
  diag.oldestPendingAgeMs = oldestAge(
    deferred.map((c) => c.capturedAt),
    evalMs
  );

  return { selected, deferred, diagnostics: diag };
}

/**
 * Full provider: plan, then assemble `CaptureRequest[]` via the injected derivation.
 * Derivation rejections (not_admitted / invalid_odds / no_scorable_markets / …) are
 * counted; a modelInput whose fixtureId disagrees is a source-correspondence failure.
 */
export function buildCaptureCandidates(
  input: CaptureProviderInput,
  deps: CaptureProviderDeps
): CaptureProviderResult {
  const plan = planCaptureCandidates(input);
  const diag: CandidateDiagnostics = plan.diagnostics;
  const rejected = diag.candidatesRejectedByReason;
  const modelVersion = input.config?.modelVersion;

  const candidates: CaptureRequest[] = [];
  for (const c of plan.selected) {
    const result = deps.deriveCaptureInput({
      fixtureId: c.fixtureId,
      kickoffAt: c.kickoffAt,
      capturedAt: c.capturedAt,
      leagueCode: c.leagueCode,
      competitionLabel: c.competitionLabel,
      markets: c.markets,
      healing: c.healing,
    });
    if (!result.ok) {
      bumpReason(rejected, result.reason);
      continue;
    }
    if (result.modelInput.fixtureId !== c.fixtureId) {
      bumpReason(rejected, "source_correspondence_failure");
      continue;
    }
    const { ok: _ok, modelInput, ...provenance } = result;
    const request: CaptureRequest = {
      admitted: true,
      fixtureId: c.fixtureId,
      capturedAt: c.capturedAt,
      modelInput,
      ...provenance,
    };
    if (modelVersion !== undefined) request.modelVersion = modelVersion;
    candidates.push(request);
  }

  diag.emittedCandidates = candidates.length;
  return { candidates, diagnostics: diag };
}

/** Oldest (largest) age in ms among the given anchors relative to `evalMs`, or null. */
function oldestAge(anchors: readonly string[], evalMs: number): number | null {
  let oldest: number | null = null;
  for (const iso of anchors) {
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) continue;
    const age = evalMs - ms;
    if (oldest === null || age > oldest) oldest = age;
  }
  return oldest;
}
