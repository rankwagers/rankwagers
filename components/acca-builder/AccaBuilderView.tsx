"use client";

import {
 useEffect,
 useId,
 useRef,
 useState,
 type FormEvent,
} from "react";
import Link from "next/link";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";
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
 p,
 initialTargetMin,
 initialTargetMax,
}: {
 p: PredictionStrings;
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
 setErrorMessage(payload.message ?? p.apbGenerationFailed);
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
 setErrorMessage(p.apbTimeout);
 } else {
 setUiState("error");
 setErrorMessage(p.apbNetworkFail);
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
 ? p.apbGeneratingLong
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
 className="p-4 sm:p-5"
 style={{
 border: "1px solid var(--line)",
 background: "var(--surface)",
 borderRadius: 6,
 }}
 >
 <fieldset className="space-y-4">
 <legend className="rw3-title">
 {p.apbConfigTitle}
 </legend>
 <p className="text-[13px]" style={{ color: "var(--muted)" }}>
 Uses today&apos;s published FootyStats list markets and bounded odds
 enrichment. Risk labels are not guarantees.
 </p>

 <div>
 <p className="rw3-label">
 {p.apbRiskMode}
 </p>
 <div
 role="radiogroup"
 aria-label={p.apbRiskMode}
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
 className="rw3-hoverable min-h-11 px-3 py-2 text-left text-[13px]"
 style={{
 border: selected
 ? "1px solid var(--accent)"
 : "1px solid var(--line)",
 background: selected ? "var(--hover)" : "var(--bg)",
 borderRadius: 6,
 fontWeight: selected ? 600 : 400,
 }}
 >
 <span className="capitalize">{mode}</span>
 <span
 className="mt-1 block text-[11px] font-normal"
 style={{ color: "var(--muted)" }}
 >
 min {rules.minConfidence}% · max {rules.maxLegs} legs
 </span>
 </button>
 );
 }
 )}
 </div>
 </div>

 <div className="grid gap-4 sm:grid-cols-2">
 <label className="block text-[13px]">
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
 <label className="block text-[13px]">
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
 <legend className="text-[13px] font-medium">{p.apbAllowedMarkets}</legend>
 <div className="mt-2 flex flex-wrap gap-2">
 {BUILDER_LIST_MARKETS.map((m) => {
 const checked = config.markets.includes(m);
 return (
 <label
 key={m}
 className="inline-flex min-h-10 items-center gap-2 px-3 text-[13px]"
 style={{ border: "1px solid var(--line)", borderRadius: 6 }}
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
 <label className="block text-[13px]">
 <span className="font-medium">{p.apbTargetMin}</span>
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
 className="mt-1 w-full min-h-11 px-3"
 style={{
 border: "1px solid var(--line)",
 background: "var(--bg)",
 borderRadius: 6,
 }}
 />
 </label>
 <label className="block text-[13px]">
 <span className="font-medium">{p.apbTargetMax}</span>
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
 className="mt-1 w-full min-h-11 px-3"
 style={{
 border: "1px solid var(--line)",
 background: "var(--bg)",
 borderRadius: 6,
 }}
 />
 </label>
 </div>

 <label className="block text-[13px]">
 <span className="font-medium">{p.apbExcludeTeams}</span>
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
 className="mt-1 w-full min-h-11 px-3"
 style={{
 border: "1px solid var(--line)",
 background: "var(--bg)",
 borderRadius: 6,
 }}
 placeholder="e.g. Arsenal"
 />
 </label>

 <label className="block text-[13px]">
 <span className="font-medium">
 {p.apbCompetitionFilter}
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
 className="mt-1 w-full min-h-11 px-3"
 style={{
 border: "1px solid var(--line)",
 background: "var(--bg)",
 borderRadius: 6,
 }}
 placeholder="e.g. Premier League"
 />
 </label>

 <div className="flex flex-wrap gap-4 text-[13px]">
 <label className="inline-flex items-center gap-2">
 <input
 type="checkbox"
 checked={config.oneSelectionPerFixture}
 onChange={(e) =>
 patchConfig({ oneSelectionPerFixture: e.target.checked })
 }
 />
 {p.apbOnePerFixture}
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
 {p.apbPrematchOnly}
 </label>
 </div>
 </fieldset>

 <div className="mt-5 flex flex-wrap gap-3">
 <button
 type="submit"
 disabled={uiState === "loading"}
 className="rw3-ghost min-h-11 justify-center px-4"
 >
 {uiState === "loading" ? p.apbGenerating : p.apbGenerate}
 </button>
 <Link
 href={`/${locale}/acca`}
 className="rw3-ghost min-h-11 px-4"
 >
 {p.apbOpenAccas}
 </Link>
 </div>
 </form>

 {(errorMessage || uiState === "initial") && (
 <div
 className="px-4 py-3 text-[13px]"
 style={{
 border: "1px solid var(--line)",
 background: "var(--surface)",
 borderRadius: 6,
 }}
 role="status"
 >
 {uiState === "initial" && !errorMessage ? (
 <p>{p.apbIdleNote}</p>
 ) : (
 <p style={{ color: "var(--loss)" }}>{errorMessage}</p>
 )}
 {requestId ? (
 <p className="mt-1 font-mono text-[11px]" style={{ color: "var(--muted)" }}>
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
 className="rw3-title"
 >
 {p.apbRanked}
 </h2>
 <p className="mt-1 text-[12px]" style={{ color: "var(--muted)" }}>
 {result.diagnostics.message} · {result.eligibleCount} eligible /{" "}
 {result.candidateCount} candidates
 </p>
 </div>
 <ProviderStatus result={result} />
 </div>

 {!result.combinations.length ? (
 <div
 className="px-4 py-8 text-[13px]"
 style={{
 border: "1px dashed var(--line)",
 borderRadius: 6,
 color: "var(--muted)",
 }}
 >
 {p.apbNoCombo}
 </div>
 ) : (
 <ul className="space-y-4">
 {result.combinations.map((combo) => (
 <CombinationCard
 key={combo.id}
 combo={combo}
 locale={locale}
 p={p}
 onAdd={() => {
 trackAccaBuilderEvent("acca_builder_combination_viewed", {
 locale,
 properties: { label: combo.label, legs: combo.legCount },
 });
 if (!acca) {
 setErrorMessage(p.apbAccasUnavailable);
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
 className="px-3 py-2 text-[11px]"
 style={{
 border: "1px solid var(--line)",
 background: "var(--surface)",
 borderRadius: 6,
 color: "var(--muted)",
 }}
 aria-label={p.apbWarningsAria}
 >
 <ul className="list-disc space-y-1 pl-4">
 {result.warnings.map((w) => (
 <li key={w}>{w}</li>
 ))}
 </ul>
 </aside>
 ) : null}

 {requestId ? (
 <p className="font-mono text-[11px]" style={{ color: "var(--muted)" }}>
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
 <div
 className="w-full max-w-md p-5"
 style={{
 border: "1px solid var(--line)",
 background: "var(--surface)",
 borderRadius: 6,
 }}
 >
 <h3 id="transfer-title" className="rw3-title">
 {p.apbAddOne}
 </h3>
 <p className="mt-2 text-[13px]" style={{ color: "var(--muted)" }}>
 Your Studio already has {acca.slip.selections.length} selection
 {acca.slip.selections.length === 1 ? "" : "s"}. Merge keeps existing
 legs (fixture conflicts replace), or replace the whole Acca.
 </p>
 <div className="mt-4 flex flex-wrap gap-2">
 <button
 type="button"
 className="rw3-ghost min-h-11 justify-center px-4"
 onClick={() => confirmTransfer("merge")}
 >
 Merge
 </button>
 <button
 type="button"
 className="rw3-ghost min-h-11 px-3"
 onClick={() => confirmTransfer("replace")}
 >
 {p.apbReplace}
 </button>
 <button
 type="button"
 className="rw3-hoverable inline-flex min-h-11 items-center px-3 text-[13px]"
 style={{ color: "var(--muted)", borderRadius: 6 }}
 onClick={() => setTransferCombo(null)}
 >
 {p.apbCancel}
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
 <ul className="flex flex-wrap gap-2 text-[11px]" aria-label="Provider availability">
 {items.map(([label, value]) => (
 <li
 key={label}
 className="px-2 py-1"
 style={{
 border: "1px solid var(--line)",
 borderRadius: 6,
 color: "var(--muted)",
 }}
 >
 <span className="font-medium" style={{ color: "var(--text)" }}>{label}</span>: {value}
 </li>
 ))}
 </ul>
 );
}

function CombinationCard({
 combo,
 locale,
 p,
 onAdd,
 onEvidence,
}: {
 combo: AccaBuilderCombination;
 locale: string;
 p: PredictionStrings;
 onAdd: () => void;
 onEvidence: () => void;
}) {
 const label =
 combo.label === "recommended"
 ? p.apbRecommended
 : combo.label === "safer"
 ? p.apbSafer
 : p.apbHigherRisk;

 return (
 <li
 className="p-4"
 style={{
 border: "1px solid var(--line)",
 background: "var(--surface)",
 borderRadius: 6,
 }}
 >
 <div className="flex flex-wrap items-start justify-between gap-3">
 <div>
 <p className="rw3-label">
 {label}
 </p>
 <p className="mt-1 text-[12px]" style={{ color: "var(--muted)" }}>
 {combo.legCount} legs · risk {combo.riskMode}
 {combo.averageConfidence != null
 ? ` · avg confidence ${combo.averageConfidence}%`
 : ""}
 {` · evidence ${combo.evidenceCompleteness}%`}
 </p>
 <p className="mt-2 text-[16px] font-semibold tabular-nums">
 {combo.combinedOdds != null && combo.oddsComplete
 ? combo.combinedOdds.toFixed(2)
 : p.apbOddsUnavailable}
 </p>
 <p className="text-[11px]" style={{ color: "var(--muted)" }}>{combo.freshnessSummary}</p>
 </div>
 <button
 type="button"
 onClick={onAdd}
 className="rw3-ghost min-h-11 justify-center px-4"
 >
 {p.apbAddAll}
 </button>
 </div>

 <ol className="mt-4 space-y-2">
 {combo.legs.map((leg, idx) => (
 <li
 key={leg.id}
 className="px-3 py-2"
 style={{
 border: "1px solid var(--line)",
 background: "var(--bg)",
 borderRadius: 6,
 }}
 >
 <div className="flex flex-wrap items-baseline justify-between gap-2">
 <p className="text-[13px] font-semibold">
 {idx + 1}. {leg.homeTeam} vs {leg.awayTeam}
 </p>
 <p className="text-[11px] tabular-nums" style={{ color: "var(--muted)" }}>
 {leg.odds != null ? `@ ${leg.odds.toFixed(2)}` : "odds n/a"} ·{" "}
 {leg.confidence}%
 </p>
 </div>
 <p className="mt-0.5 text-[11px]" style={{ color: "var(--muted)" }}>
 {leg.marketLabel} · {leg.competition}
 </p>
 <details
 className="mt-2 text-[11px]"
 onToggle={(e) => {
 if ((e.target as HTMLDetailsElement).open) onEvidence();
 }}
 >
 <summary className="cursor-pointer font-medium" style={{ color: "var(--text)" }}>
 {p.apbWhyLeg}
 </summary>
 <ul className="mt-1 list-disc space-y-0.5 pl-4" style={{ color: "var(--muted)" }}>
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
 className="mt-1 inline-block text-[11px] font-medium hover:underline"
 style={{ color: "var(--text)" }}
 >
 {p.appMatchDetail}
 </Link>
 </li>
 ))}
 </ol>

 {(combo.correlationWarnings.length > 0 ||
 combo.limitations.length > 0) && (
 <ul className="mt-3 list-disc space-y-1 pl-4 text-[11px]" style={{ color: "var(--muted)" }}>
 {[...combo.correlationWarnings, ...combo.limitations].map((w) => (
 <li key={w}>{w}</li>
 ))}
 </ul>
 )}
 </li>
 );
}
