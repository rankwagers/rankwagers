"use client";

import {
 useEffect,
 useId,
 useRef,
 useState,
 type FormEvent,
} from "react";
import Link from "next/link";
import {
 BUILDER_LIST_MARKETS,
 RISK_MODE_RULES,
 defaultBuilderConfig,
 trackAccaBuilderEvent,
 type AccaBuilderCombination,
 type AccaBuilderConfig,
 type AccaBuilderMarketKey,
 type AccaBuilderResult,
 type AccaBuilderRiskMode,
} from "@/lib/acca-builder";
import { useAccaOptional } from "@/components/acca/AccaProvider";

type UiState =
 | "initial"
 | "loading"
 | "success"
 | "partial"
 | "no_candidates"
 | "no_combination"
 | "missing_odds"
 | "stale"
 | "rate_limited"
 | "timeout"
 | "error";

const MARKET_LABELS: Record<AccaBuilderMarketKey, string> = {
 over15: "Over 1.5",
 over25: "Over 2.5",
 fh: "1st half O0.5",
 sh: "2nd half O0.5",
};

function classifyResult(result: AccaBuilderResult): UiState {
 if (result.status === "no_candidates") return "no_candidates";
 if (result.status === "no_combination") return "no_combination";
 if (result.status === "error") return "error";
 if (result.providerAvailability.oddsEnrichment === "unavailable") {
 return "missing_odds";
 }
 if (result.providerAvailability.oddsEnrichment === "partial") return "partial";
 if (
 result.combinations.some((c) =>
 c.legs.some((l) => l.oddsFreshness === "stale")
 )
 ) {
 return "stale";
 }
 return "success";
}

export function AccaBuilderView({
 locale,
 initialTargetMin,
 initialTargetMax,
}: {
 locale: string;
 initialTargetMin?: number | null;
 initialTargetMax?: number | null;
}) {
 const formId = useId();
 const liveRef = useRef<HTMLDivElement>(null);
 const acca = useAccaOptional();
 const [config, setConfig] = useState<AccaBuilderConfig>(() =>
 defaultBuilderConfig({
 locale,
 targetOddsMin: initialTargetMin ?? null,
 targetOddsMax: initialTargetMax ?? null,
 })
 );
 const [uiState, setUiState] = useState<UiState>("initial");
 const [result, setResult] = useState<AccaBuilderResult | null>(null);
 const [errorMessage, setErrorMessage] = useState<string | null>(null);
 const [requestId, setRequestId] = useState<string | null>(null);
 const [transferCombo, setTransferCombo] =
 useState<AccaBuilderCombination | null>(null);
 const transferDialogRef = useRef<HTMLDivElement | null>(null);

 useEffect(() => {
 trackAccaBuilderEvent("acca_builder_viewed", { locale });
 return () => {
 trackAccaBuilderEvent("acca_builder_abandoned", { locale });
 };
 }, [locale]);

 function patchConfig(partial: Partial<AccaBuilderConfig>) {
 setConfig((prev) => {
 const next = { ...prev, ...partial };
 trackAccaBuilderEvent("acca_builder_configuration_changed", {
 locale,
 properties: { keys: Object.keys(partial).join(",") },
 });
 return next;
 });
 }

 async function onGenerate(e?: FormEvent) {
 e?.preventDefault();
 setUiState("loading");
 setErrorMessage(null);
 setResult(null);
 trackAccaBuilderEvent("acca_builder_generation_started", {
 locale,
 properties: {
 riskMode: config.riskMode,
 legCount: config.legCount,
 },
 });

 const controller = new AbortController();
 const timeout = window.setTimeout(() => controller.abort(), 45_000);

 try {
 const res = await fetch("/api/acca/builder", {
 method: "POST",
 headers: {
 "Content-Type": "application/json",
 Accept: "application/json",
 },
 body: JSON.stringify(config),
 signal: controller.signal,
 });
 const headerId = res.headers.get("x-request-id");
 if (headerId) setRequestId(headerId);

 const payload = (await res.json()) as AccaBuilderResult & {
 error?: string;
 message?: string;
 retryAfterSec?: number;
 };

 if (res.status === 429 || payload.error === "rate_limited") {
 setUiState("rate_limited");
 setErrorMessage(
 payload.message ??
 `Rate limited. Retry after ${payload.retryAfterSec ?? 60}s.`
 );
 trackAccaBuilderEvent("acca_builder_generation_failed", {
 locale,
 properties: { reason: "rate_limited" },
 });
 return;
 }

 if (!res.ok && payload.status !== "no_candidates" && payload.status !== "no_combination") {
 setUiState("error");
 setErrorMessage(payload.message ?? "Generation failed.");
 setRequestId(payload.requestId ?? headerId);
 trackAccaBuilderEvent("acca_builder_generation_failed", {
 locale,
 properties: { reason: payload.error ?? "error" },
 });
 return;
 }

 setResult(payload);
 setRequestId(payload.requestId ?? headerId);
 const state = classifyResult(payload);
 setUiState(state);

 if (payload.status === "success") {
 trackAccaBuilderEvent("acca_builder_generation_succeeded", {
 locale,
 properties: {
 combinations: payload.combinations.length,
 eligible: payload.eligibleCount,
 },
 });
 } else if (
 payload.status === "no_candidates" ||
 payload.status === "no_combination"
 ) {
 trackAccaBuilderEvent("acca_builder_no_valid_combination", {
 locale,
 properties: { status: payload.status },
 });
 }
 } catch (err) {
 if (err instanceof DOMException && err.name === "AbortError") {
 setUiState("timeout");
 setErrorMessage("Provider request timed out. Try again.");
 } else {
 setUiState("error");
 setErrorMessage("Network failure. Check localhost connectivity.");
 }
 trackAccaBuilderEvent("acca_builder_generation_failed", {
 locale,
 properties: { reason: "network" },
 });
 } finally {
 window.clearTimeout(timeout);
 }
 }

 function confirmTransfer(mode: "merge" | "replace") {
 if (!transferCombo || !acca) return;
 const outcome = acca.transferBuilder(transferCombo.drafts, mode);
 if (outcome.ok) {
 setTransferCombo(null);
 }
 }

 const announce =
 uiState === "loading"
 ? "Generating accumulator suggestions…"
 : result?.diagnostics.message ?? errorMessage ?? "";

 return (
 <div className="mt-8 space-y-8">
 <div
 ref={liveRef}
 className="sr-only"
 aria-live="polite"
 aria-atomic="true"
 >
 {announce}
 </div>

 <form
 id={formId}
 onSubmit={onGenerate}
 className="rounded-xl border border-border bg-[var(--canvas)] p-4 sm:p-5"
 >
 <fieldset className="space-y-4">
 <legend className="rw-display text-lg font-semibold text-foreground">
 Builder configuration
 </legend>
 <p className="text-sm text-[var(--ink-secondary)]">
 Uses today&apos;s published FootyStats list markets and bounded odds
 enrichment. Risk labels are not guarantees.
 </p>

 <div>
 <p className="text-xs font-semibold uppercase tracking-label text-[var(--hero-ink-2)]">
 Risk mode
 </p>
 <div
 role="radiogroup"
 aria-label="Risk mode"
 className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3"
 >
 {(Object.keys(RISK_MODE_RULES) as AccaBuilderRiskMode[]).map(
 (mode) => {
 const rules = RISK_MODE_RULES[mode];
 const selected = config.riskMode === mode;
 return (
 <button
 key={mode}
 type="button"
 role="radio"
 aria-checked={selected}
 onClick={() => {
 patchConfig({
 riskMode: mode,
 minConfidence: rules.minConfidence,
 markets: [...rules.markets],
 legCount: Math.min(config.legCount, rules.maxLegs),
 });
 trackAccaBuilderEvent(
 "acca_builder_risk_mode_selected",
 { locale, properties: { riskMode: mode } }
 );
 }}
 className={`min-h-11 rounded-md border px-3 py-2 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
 selected
 ? "border-brand bg-[var(--green-surface)] font-semibold text-[var(--hero-ink)]"
 : "border-border bg-[var(--canvas-secondary)]"
 }`}
 >
 <span className="capitalize">{mode}</span>
 <span className="mt-1 block text-xs font-normal text-[var(--hero-ink-2)]">
 min {rules.minConfidence}% · max {rules.maxLegs} legs
 </span>
 </button>
 );
 }
 )}
 </div>
 </div>

 <div className="grid gap-4 sm:grid-cols-2">
 <label className="block text-sm">
 <span className="font-medium">Legs ({config.legCount})</span>
 <input
 type="range"
 min={2}
 max={RISK_MODE_RULES[config.riskMode].maxLegs}
 value={config.legCount}
 onChange={(e) =>
 patchConfig({ legCount: Number(e.target.value) })
 }
 className="mt-2 w-full"
 />
 </label>
 <label className="block text-sm">
 <span className="font-medium">
 Min confidence ({config.minConfidence}%)
 </span>
 <input
 type="range"
 min={50}
 max={95}
 value={config.minConfidence}
 onChange={(e) =>
 patchConfig({ minConfidence: Number(e.target.value) })
 }
 className="mt-2 w-full"
 />
 </label>
 </div>

 <fieldset>
 <legend className="text-sm font-medium">Allowed markets</legend>
 <div className="mt-2 flex flex-wrap gap-2">
 {BUILDER_LIST_MARKETS.map((m) => {
 const checked = config.markets.includes(m);
 return (
 <label
 key={m}
 className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm"
 >
 <input
 type="checkbox"
 checked={checked}
 onChange={() => {
 const markets = checked
 ? config.markets.filter((x) => x !== m)
 : [...config.markets, m];
 if (markets.length) patchConfig({ markets });
 }}
 />
 {MARKET_LABELS[m]}
 </label>
 );
 })}
 </div>
 </fieldset>

 <div className="grid gap-3 sm:grid-cols-2">
 <label className="block text-sm">
 <span className="font-medium">Target odds min (optional)</span>
 <input
 type="number"
 min={1.01}
 step={0.1}
 inputMode="decimal"
 placeholder="e.g. 4"
 value={config.targetOddsMin ?? ""}
 onChange={(e) => {
 const v = e.target.value === "" ? null : Number(e.target.value);
 patchConfig({ targetOddsMin: v });
 trackAccaBuilderEvent("acca_builder_target_odds_selected", {
 locale,
 properties: { bound: "min", value: v ?? 0 },
 });
 }}
 className="mt-1 w-full min-h-11 rounded-md border border-border bg-[var(--canvas-secondary)] px-3"
 />
 </label>
 <label className="block text-sm">
 <span className="font-medium">Target odds max (optional)</span>
 <input
 type="number"
 min={1.01}
 step={0.1}
 inputMode="decimal"
 placeholder="e.g. 12"
 value={config.targetOddsMax ?? ""}
 onChange={(e) => {
 const v = e.target.value === "" ? null : Number(e.target.value);
 patchConfig({ targetOddsMax: v });
 }}
 className="mt-1 w-full min-h-11 rounded-md border border-border bg-[var(--canvas-secondary)] px-3"
 />
 </label>
 </div>

 <label className="block text-sm">
 <span className="font-medium">Exclude teams (comma-separated)</span>
 <input
 type="text"
 value={config.excludedTeams.join(", ")}
 onChange={(e) =>
 patchConfig({
 excludedTeams: e.target.value
 .split(",")
 .map((s) => s.trim())
 .filter(Boolean),
 })
 }
 className="mt-1 w-full min-h-11 rounded-md border border-border bg-[var(--canvas-secondary)] px-3"
 placeholder="e.g. Arsenal"
 />
 </label>

 <label className="block text-sm">
 <span className="font-medium">
 Competition filter (comma-separated, optional)
 </span>
 <input
 type="text"
 value={config.competitions.join(", ")}
 onChange={(e) =>
 patchConfig({
 competitions: e.target.value
 .split(",")
 .map((s) => s.trim())
 .filter(Boolean),
 })
 }
 className="mt-1 w-full min-h-11 rounded-md border border-border bg-[var(--canvas-secondary)] px-3"
 placeholder="e.g. Premier League"
 />
 </label>

 <div className="flex flex-wrap gap-4 text-sm">
 <label className="inline-flex items-center gap-2">
 <input
 type="checkbox"
 checked={config.oneSelectionPerFixture}
 onChange={(e) =>
 patchConfig({ oneSelectionPerFixture: e.target.checked })
 }
 />
 One selection per fixture
 </label>
 <label className="inline-flex items-center gap-2">
 <input
 type="checkbox"
 checked={config.preMatchOnly}
 onChange={(e) =>
 patchConfig({
 preMatchOnly: e.target.checked,
 includeLive: e.target.checked ? false : config.includeLive,
 })
 }
 />
 Pre-match only
 </label>
 </div>
 </fieldset>

 <div className="mt-5 flex flex-wrap gap-3">
 <button
 type="submit"
 disabled={uiState === "loading"}
 className="rw-m inline-flex items-center justify-center border border-[var(--hero-ink)] px-4 text-[var(--hero-ink)] transition-colors hover:bg-[var(--hero-ink)] hover:text-[var(--hero-canvas)] min-h-11"
 >
 {uiState === "loading" ? "Generating…" : "Generate Acca"}
 </button>
 <Link
 href={`/${locale}/acca`}
 className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-medium"
 >
 Open accumulators
 </Link>
 </div>
 </form>

 {(errorMessage || uiState === "initial") && (
 <div
 className="rounded-lg border border-border bg-[var(--canvas-secondary)] px-4 py-3 text-sm"
 role="status"
 >
 {uiState === "initial" && !errorMessage ? (
 <p>
 Configure filters, then generate. Combinations use real published
 list predictions — never invented fixtures or odds.
 </p>
 ) : (
 <p className="text-[var(--amber-primary)]">{errorMessage}</p>
 )}
 {requestId ? (
 <p className="mt-1 font-mono text-xs text-[var(--hero-ink-2)]">
 requestId: {requestId}
 </p>
 ) : null}
 </div>
 )}

 {result ? (
 <section aria-labelledby="builder-results-heading" className="space-y-4">
 <div className="flex flex-wrap items-end justify-between gap-3">
 <div>
 <h2
 id="builder-results-heading"
 className="rw-display text-xl font-semibold"
 >
 Ranked combinations
 </h2>
 <p className="mt-1 text-sm text-[var(--ink-secondary)]">
 {result.diagnostics.message} · {result.eligibleCount} eligible /{" "}
 {result.candidateCount} candidates
 </p>
 </div>
 <ProviderStatus result={result} />
 </div>

 {!result.combinations.length ? (
 <div className="rounded-lg border border-dashed border-border px-4 py-8 text-sm text-[var(--hero-ink-2)]">
 No valid combination for this configuration. Relax confidence,
 markets, or leg count — quality gates are not lowered automatically.
 </div>
 ) : (
 <ul className="space-y-4">
 {result.combinations.map((combo) => (
 <CombinationCard
 key={combo.id}
 combo={combo}
 locale={locale}
 onAdd={() => {
 trackAccaBuilderEvent("acca_builder_combination_viewed", {
 locale,
 properties: { label: combo.label, legs: combo.legCount },
 });
 if (!acca) {
 setErrorMessage(
 "Accumulators are unavailable in this view. Open accumulators first."
 );
 return;
 }
 if (acca.slip.selections.length > 0) {
 setTransferCombo(combo);
 queueMicrotask(() =>
 transferDialogRef.current
 ?.querySelector<HTMLElement>("button")
 ?.focus()
 );
 } else {
 acca.transferBuilder(combo.drafts, "replace");
 }
 }}
 onEvidence={() =>
 trackAccaBuilderEvent("acca_builder_leg_evidence_expanded", {
 locale,
 properties: { combo: combo.label },
 })
 }
 />
 ))}
 </ul>
 )}

 {result.warnings.length ? (
 <aside
 className="rounded-md border border-[var(--amber-border)] bg-[var(--amber-surface)] px-3 py-2 text-xs text-[var(--amber-primary)]"
 aria-label="Warnings"
 >
 <ul className="list-disc space-y-1 pl-4">
 {result.warnings.map((w) => (
 <li key={w}>{w}</li>
 ))}
 </ul>
 </aside>
 ) : null}

 {requestId ? (
 <p className="font-mono text-xs text-[var(--hero-ink-2)]">
 Diagnostic requestId: {requestId} · snapshot: {result.snapshotId}
 </p>
 ) : null}
 </section>
 ) : null}

 {transferCombo && acca ? (
 <div
 role="dialog"
 aria-modal="true"
 aria-labelledby="transfer-title"
 className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
 ref={transferDialogRef}
 >
 <div className="w-full max-w-md rounded-xl border border-border bg-[var(--canvas)] p-5 shadow-card">
 <h3 id="transfer-title" className="rw-display text-lg font-semibold">
 Add to accumulators
 </h3>
 <p className="mt-2 text-sm text-[var(--ink-secondary)]">
 Your Studio already has {acca.slip.selections.length} selection
 {acca.slip.selections.length === 1 ? "" : "s"}. Merge keeps existing
 legs (fixture conflicts replace), or replace the whole Acca.
 </p>
 <div className="mt-4 flex flex-wrap gap-2">
 <button
 type="button"
 className="rw-m inline-flex items-center justify-center border border-[var(--hero-ink)] px-4 text-[var(--hero-ink)] transition-colors hover:bg-[var(--hero-ink)] hover:text-[var(--hero-canvas)] min-h-11"
 onClick={() => confirmTransfer("merge")}
 >
 Merge
 </button>
 <button
 type="button"
 className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm font-semibold"
 onClick={() => confirmTransfer("replace")}
 >
 Replace
 </button>
 <button
 type="button"
 className="inline-flex min-h-11 items-center rounded-md px-3 text-sm"
 onClick={() => setTransferCombo(null)}
 >
 Cancel
 </button>
 </div>
 </div>
 </div>
 ) : null}
 </div>
 );
}

function ProviderStatus({ result }: { result: AccaBuilderResult }) {
 const items = [
 ["Lists", result.providerAvailability.footystatsLists],
 ["Odds", result.providerAvailability.oddsEnrichment],
 ["Archive", result.providerAvailability.archiveHistory],
 ] as const;
 return (
 <ul className="flex flex-wrap gap-2 text-xs" aria-label="Provider availability">
 {items.map(([label, value]) => (
 <li
 key={label}
 className="rounded border border-border px-2 py-1 text-[var(--hero-ink-2)]"
 >
 <span className="font-medium text-foreground">{label}</span>: {value}
 </li>
 ))}
 </ul>
 );
}

function CombinationCard({
 combo,
 locale,
 onAdd,
 onEvidence,
}: {
 combo: AccaBuilderCombination;
 locale: string;
 onAdd: () => void;
 onEvidence: () => void;
}) {
 const label =
 combo.label === "recommended"
 ? "Recommended"
 : combo.label === "safer"
 ? "Safer alternative"
 : "Higher-risk alternative";

 return (
 <li className="rounded-xl border border-border bg-[var(--canvas)] p-4">
 <div className="flex flex-wrap items-start justify-between gap-3">
 <div>
 <p className="text-metadata font-medium uppercase tracking-label text-[var(--hero-ink)]">
 {label}
 </p>
 <p className="mt-1 text-sm text-[var(--ink-secondary)]">
 {combo.legCount} legs · risk {combo.riskMode}
 {combo.averageConfidence != null
 ? ` · avg confidence ${combo.averageConfidence}%`
 : ""}
 {` · evidence ${combo.evidenceCompleteness}%`}
 </p>
 <p className="mt-2 rw-display text-2xl font-semibold tabular-nums">
 {combo.combinedOdds != null && combo.oddsComplete
 ? combo.combinedOdds.toFixed(2)
 : "Odds unavailable"}
 </p>
 <p className="text-xs text-[var(--hero-ink-2)]">{combo.freshnessSummary}</p>
 </div>
 <button
 type="button"
 onClick={onAdd}
 className="rw-m inline-flex items-center justify-center border border-[var(--hero-ink)] px-4 text-[var(--hero-ink)] transition-colors hover:bg-[var(--hero-ink)] hover:text-[var(--hero-canvas)] min-h-11"
 >
 Add entire Acca to Studio
 </button>
 </div>

 <ol className="mt-4 space-y-2">
 {combo.legs.map((leg, idx) => (
 <li
 key={leg.id}
 className="rounded-md border border-border bg-[var(--canvas-secondary)] px-3 py-2"
 >
 <div className="flex flex-wrap items-baseline justify-between gap-2">
 <p className="text-sm font-semibold">
 {idx + 1}. {leg.homeTeam} vs {leg.awayTeam}
 </p>
 <p className="text-xs tabular-nums text-[var(--hero-ink-2)]">
 {leg.odds != null ? `@ ${leg.odds.toFixed(2)}` : "odds n/a"} ·{" "}
 {leg.confidence}%
 </p>
 </div>
 <p className="mt-0.5 text-xs text-[var(--ink-secondary)]">
 {leg.marketLabel} · {leg.competition}
 </p>
 <details
 className="mt-2 text-xs"
 onToggle={(e) => {
 if ((e.target as HTMLDetailsElement).open) onEvidence();
 }}
 >
 <summary className="cursor-pointer font-medium text-[var(--hero-ink)]">
 Why this leg
 </summary>
 <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[var(--hero-ink-2)]">
 {leg.evidenceSummary.map((line) => (
 <li key={line}>{line}</li>
 ))}
 <li>
 Score {leg.score} (
 {Object.entries(leg.scoreParts)
 .map(([k, v]) => `${k}:${v}`)
 .join(", ")}
 )
 </li>
 </ul>
 </details>
 <Link
 href={leg.matchHref || `/${locale}/fixtures/${leg.matchId}`}
 className="mt-1 inline-block text-xs font-medium text-[var(--hero-ink)] hover:underline"
 >
 Match detail
 </Link>
 </li>
 ))}
 </ol>

 {(combo.correlationWarnings.length > 0 ||
 combo.limitations.length > 0) && (
 <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-[var(--hero-ink-2)]">
 {[...combo.correlationWarnings, ...combo.limitations].map((w) => (
 <li key={w}>{w}</li>
 ))}
 </ul>
 )}
 </li>
 );
}
