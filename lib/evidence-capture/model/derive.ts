/**
 * Evidence-model derivation (Sprint 23B, M5 — Contract §4.4/§4.5, §4.9-R1).
 *
 * PURE derivation of deterministic evidence inputs from interpreted provider stats.
 * It owns ONLY derivation: it mints no EvidenceSnapshot, writes no archive, reads no
 * clock/filesystem/network, and uses no `modelVersion`. Same inputs ⇒ identical
 * outputs, independent of order/machine/host/pid/timezone/env.
 *
 * `evidenceScore` is the frozen `scoreFromSignals` over signals built as a
 * baseline-relative, sample-discounted residual — deliberately NOT `modelProbability`
 * (§4.6). Qualification is the frozen `deriveQualification`; the fixture rollup is the
 * conservative binding of §4.5. Labels/pairings come from the M1 registry; strength and
 * band come from the frozen `resolveEvidenceStrength` / `evidenceScoreBand`.
 */

import type {
  EvidenceQualification,
  EvidenceScoreBand,
  EvidenceSignal,
  EvidenceSignalDirection,
  SupportedMarket,
} from "@/types/evidence";
import { evidenceScoreBand, scoreFromSignals } from "@/lib/evidence/score";
import {
  deriveQualification,
  qualificationRank,
} from "@/lib/evidence/qualification";
import {
  EVIDENCE_MIN_SAMPLE_SIZE,
  EVIDENCE_QUALIFICATION_THRESHOLDS,
} from "@/lib/evidence/constants";
import { resolveEvidenceStrength } from "@/lib/evidence-ui/strength";
import type { EvidenceStrength } from "@/lib/evidence-ui/types";
import { isCanonicalPairing, marketLabel, selectionLabel } from "../keys";
import { isValidFixtureId } from "../identity";
import {
  BASELINE_SCALE,
  COUNTER_MIN_PCT,
  LEAGUE_MIN_SAMPLE,
  neutralBandPp,
  SAMPLE_MIN,
  W_COUNTER_MAX,
  W_PRIMARY_MAX,
  clamp,
  round2,
  sampleConfidence,
} from "./constants";

// ---- Canonical evidence-model input (deterministic provider interpretation) -

/** A team's venue-specific rate (0–100 %) with its sample denominator. */
export type VenueStat = { pct: number; played: number; hits?: number | null };

/** A counter observation (clean-sheet / failed-to-score) for over-goal markets. */
export type CounterStat = { pct: number; played: number };

export type MarketInput = {
  marketKey: string;
  selectionKey: string;
  home: VenueStat | null;
  away: VenueStat | null;
  /** Same-competition, same-season, completed-before-kickoff league rate + sample. */
  leagueBaseline: { pct: number; played: number } | null;
  /** Optional counter signals per venue (over15/over25 only). */
  counters?: { home?: CounterStat[] | null; away?: CounterStat[] | null } | null;
  /** Provider potential 0–100 — the separate modelProbability axis (§4.6). */
  modelProbabilityPct?: number | null;
};

export type FixtureModelInput = { fixtureId: number; markets: MarketInput[] };

// ---- Outputs (canonical evidence model) ------------------------------------

export type MarketDiagnostic = {
  marketKey: string;
  selectionKey: string;
  marketScore: number;
  marketSample: number;
  qualification: EvidenceQualification;
  scored: boolean;
};

export type EvidenceModelDiagnostics = {
  marketsConsidered: number;
  marketsWithData: number;
  marketsScored: number;
  marketsOmitted: { marketKey: string; reason: string }[];
  bindingMarketKey: string | null;
  perMarket: MarketDiagnostic[];
};

export type EvidenceModel = {
  fixtureId: number;
  evidenceScore: number; // 0–100, 2dp
  qualification: EvidenceQualification; // qualified|provisional|unqualified (never excluded here)
  qualificationReasons: string[];
  supportedMarkets: SupportedMarket[];
  signals: EvidenceSignal[];
  evidenceStrength: EvidenceStrength;
  confidenceBand: EvidenceScoreBand;
  sampleSize: number;
  diagnostics: EvidenceModelDiagnostics;
};

export type DeriveEvidenceModelResult =
  | { ok: true; model: EvidenceModel }
  | { ok: false; reason: string; diagnostics: EvidenceModelDiagnostics };

// ---- Helpers ---------------------------------------------------------------

const OVER_MARKETS = new Set(["over15", "over25"]);

function isPct(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}
function isPlayed(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/** modelProbabilityPct (0–100) → fraction [0,1], or null when out of range/absent. */
export function toModelProbabilityFraction(
  pct: number | null | undefined
): number | null {
  if (pct === null || pct === undefined) return null;
  if (typeof pct !== "number" || !Number.isFinite(pct) || pct < 0 || pct > 100) {
    return null;
  }
  return Math.round((pct / 100) * 1e6) / 1e6;
}

function venueSignal(
  marketKey: string,
  venue: "home" | "away",
  stat: VenueStat | null,
  baselinePct: number
): EvidenceSignal | null {
  if (!stat || !isPct(stat.pct) || !isPlayed(stat.played) || stat.played <= 0) {
    return null;
  }
  const residualPp = stat.pct - baselinePct;
  const norm = clamp(residualPp / BASELINE_SCALE, -1, 1);
  const conf = sampleConfidence(stat.played);
  // The band scales with what this sample can actually support (see `neutralBandPp`): a rate from
  // eight matches must clear a wider gap than one from thirty before it counts as evidence.
  const neutral = Math.abs(residualPp) < neutralBandPp(baselinePct, stat.played);
  const direction: EvidenceSignalDirection = neutral
    ? "neutral"
    : norm > 0
      ? "supporting"
      : "opposing";
  const weight = neutral ? 0 : round2(W_PRIMARY_MAX * Math.abs(norm) * conf);
  const label = marketLabel(marketKey) ?? marketKey;
  const denom =
    stat.hits != null && Number.isFinite(stat.hits)
      ? `${stat.hits}/${stat.played}`
      : `${stat.played}`;
  return {
    key: `season_${marketKey}_${venue}`,
    label: `${label} rate (${venue})`,
    value: stat.pct,
    displayValue: `${stat.pct}% (${denom})`,
    weight,
    direction,
    sampleSize: stat.played,
    source: "footystats:team",
  };
}

function counterSignals(
  marketKey: string,
  venue: "home" | "away",
  counters: CounterStat[] | null | undefined
): EvidenceSignal[] {
  // Fail closed on a malformed counters value (non-null but not an array) — no throw,
  // no fabricated counter evidence. A real array is unaffected.
  if (!Array.isArray(counters)) return [];
  const out: EvidenceSignal[] = [];
  counters.forEach((c, i) => {
    if (!c || !isPct(c.pct) || !isPlayed(c.played) || c.played <= 0) return;
    if (c.pct < COUNTER_MIN_PCT) return; // only above-threshold values oppose
    const norm = clamp((c.pct - COUNTER_MIN_PCT) / BASELINE_SCALE, 0, 1);
    const weight = round2(W_COUNTER_MAX * norm * sampleConfidence(c.played));
    out.push({
      key: `counter_${marketKey}_${venue}_${i}`,
      label: `Counter evidence (${venue})`,
      value: c.pct,
      displayValue: `${c.pct}% (${c.played})`,
      weight,
      direction: "opposing",
      sampleSize: c.played,
      source: "footystats:team",
    });
  });
  return out;
}

type DerivedMarket = {
  marketKey: string;
  selectionKey: string;
  marketScore: number;
  marketSample: number;
  qualification: EvidenceQualification;
  scored: boolean;
  signals: EvidenceSignal[];
  supportedMarket: SupportedMarket;
};

type MarketDerivation =
  | { ok: true; market: DerivedMarket }
  | { ok: false; marketKey: string; reason: string };

function deriveMarket(input: unknown): MarketDerivation {
  // Fail closed on a malformed market entry (null / non-object) before any
  // dereference — omitted deterministically, never thrown, never fabricated.
  if (input === null || typeof input !== "object") {
    return { ok: false, marketKey: "?", reason: "malformed_market_input" };
  }
  const m = input as MarketInput;
  const marketKey = typeof m.marketKey === "string" ? m.marketKey : "";
  const selectionKey = typeof m.selectionKey === "string" ? m.selectionKey : "";
  if (!isCanonicalPairing(marketKey, selectionKey)) {
    return { ok: false, marketKey: marketKey || "?", reason: "non_canonical_market" };
  }
  if (
    !m.leagueBaseline ||
    !isPct(m.leagueBaseline.pct) ||
    !isPlayed(m.leagueBaseline.played) ||
    m.leagueBaseline.played < LEAGUE_MIN_SAMPLE
  ) {
    return { ok: false, marketKey, reason: "baseline_unavailable" };
  }
  const baselinePct = m.leagueBaseline.pct;
  const home = venueSignal(marketKey, "home", m.home, baselinePct);
  const away = venueSignal(marketKey, "away", m.away, baselinePct);
  const venues = [home, away].filter((s): s is EvidenceSignal => s !== null);
  if (venues.length === 0) {
    return { ok: false, marketKey, reason: "no_venue_data" };
  }
  const counters = OVER_MARKETS.has(marketKey)
    ? [
        ...counterSignals(marketKey, "home", m.counters?.home),
        ...counterSignals(marketKey, "away", m.counters?.away),
      ]
    : [];
  const signals = [...venues, ...counters];
  const marketScore = scoreFromSignals(signals);
  const marketSample = Math.min(...venues.map((s) => s.sampleSize as number));
  const qualification = deriveQualification({
    evidenceScore: marketScore,
    sampleSize: marketSample,
  });
  const supportedMarket: SupportedMarket = {
    marketKey,
    marketLabel: marketLabel(marketKey) ?? marketKey,
    selectionKey,
    selectionLabel: selectionLabel(marketKey, selectionKey) ?? selectionKey,
    modelProbability: toModelProbabilityFraction(m.modelProbabilityPct),
    qualification,
  };
  return {
    ok: true,
    market: {
      marketKey,
      selectionKey,
      marketScore,
      marketSample,
      qualification,
      scored: marketSample >= SAMPLE_MIN,
      signals,
      supportedMarket,
    },
  };
}

/** Reasons for a (score, sample) qualification — mirrors deriveQualification's branches. */
export function qualificationReasons(
  evidenceScore: number,
  sampleSize: number
): string[] {
  const suff = sampleSize >= EVIDENCE_MIN_SAMPLE_SIZE;
  const q = EVIDENCE_QUALIFICATION_THRESHOLDS;
  if (evidenceScore >= q.qualified) {
    return [`score_ge_qualified(${q.qualified})`, suff ? `sample_ge_min(${EVIDENCE_MIN_SAMPLE_SIZE})` : `sample_lt_min(${EVIDENCE_MIN_SAMPLE_SIZE})`];
  }
  if (evidenceScore >= q.provisional) {
    const r = [`score_ge_provisional(${q.provisional})`, `score_lt_qualified(${q.qualified})`];
    r.push(suff ? `sample_ge_min(${EVIDENCE_MIN_SAMPLE_SIZE})` : `sample_lt_min(${EVIDENCE_MIN_SAMPLE_SIZE})`);
    return r;
  }
  return [`score_lt_provisional(${q.provisional})`];
}

// ---- Top-level derivation --------------------------------------------------

export function deriveEvidenceModel(
  input: FixtureModelInput
): DeriveEvidenceModelResult {
  const omitted: { marketKey: string; reason: string }[] = [];
  const derived: DerivedMarket[] = [];
  const markets = Array.isArray(input?.markets) ? input.markets : [];

  const emptyDiag = (): EvidenceModelDiagnostics => ({
    marketsConsidered: markets.length,
    marketsWithData: derived.length,
    marketsScored: derived.filter((d) => d.scored).length,
    marketsOmitted: omitted,
    bindingMarketKey: null,
    perMarket: derived.map((d) => ({
      marketKey: d.marketKey,
      selectionKey: d.selectionKey,
      marketScore: d.marketScore,
      marketSample: d.marketSample,
      qualification: d.qualification,
      scored: d.scored,
    })),
  });

  if (!isValidFixtureId(input?.fixtureId)) {
    return { ok: false, reason: "invalid_fixture_id", diagnostics: emptyDiag() };
  }

  for (const m of markets) {
    const r = deriveMarket(m);
    if (r.ok) derived.push(r.market);
    else omitted.push({ marketKey: r.marketKey, reason: r.reason });
  }

  if (derived.length === 0) {
    return { ok: false, reason: "no_markets_with_data", diagnostics: emptyDiag() };
  }
  const scored = derived.filter((d) => d.scored);
  if (scored.length === 0) {
    return { ok: false, reason: "no_scored_markets", diagnostics: emptyDiag() };
  }

  // Conservative binding: weakest adequately-sampled market (lowest rank, then score).
  const binding = scored.reduce((best, cur) => {
    const br = qualificationRank(best.qualification);
    const cr = qualificationRank(cur.qualification);
    if (cr !== br) return cr < br ? cur : best;
    return cur.marketScore < best.marketScore ? cur : best;
  });

  const evidenceScore = binding.marketScore;
  const sampleSize = binding.marketSample;
  const qualification = deriveQualification({ evidenceScore, sampleSize });

  const diagnostics: EvidenceModelDiagnostics = {
    marketsConsidered: markets.length,
    marketsWithData: derived.length,
    marketsScored: scored.length,
    marketsOmitted: omitted,
    bindingMarketKey: binding.marketKey,
    perMarket: derived.map((d) => ({
      marketKey: d.marketKey,
      selectionKey: d.selectionKey,
      marketScore: d.marketScore,
      marketSample: d.marketSample,
      qualification: d.qualification,
      scored: d.scored,
    })),
  };

  return {
    ok: true,
    model: {
      fixtureId: input.fixtureId,
      evidenceScore,
      qualification,
      qualificationReasons: [
        ...qualificationReasons(evidenceScore, sampleSize),
        `binding_market:${binding.marketKey}`,
      ],
      supportedMarkets: derived.map((d) => d.supportedMarket),
      signals: derived.flatMap((d) => d.signals),
      evidenceStrength: resolveEvidenceStrength({
        sampleSize,
        coveragePercent: evidenceScore,
        qualified: qualification !== "unqualified" && qualification !== "excluded",
        providerComplete: true,
      }),
      confidenceBand: evidenceScoreBand(evidenceScore),
      sampleSize,
      diagnostics,
    },
  };
}
