"use client";

import { useState } from "react";
import Link from "next/link";
import { useAcca } from "./AccaProvider";
import { AccaOperators } from "./AccaOperators";
import { formatAccaText } from "@/lib/acca/exportText";
import { trackAccaEvent } from "@/lib/acca/analytics";
import { accaSharePath, encodeSharePayload } from "@/lib/acca/share";
import type { RiskTone } from "@/lib/ui/tokens";
import { Icon } from "@/components/v3/Icon";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";
import { formatDict } from "@/lib/formatDict";

/* Risk tone under the rw3 language: one pill, tone carried by ink alone —
 * calm for low risk, the loss red as the class climbs. No tinted surfaces. */
const RISK_TONE_INK: Record<RiskTone, string> = {
  low_risk: "var(--win)",
  balanced: "var(--text)",
  aggressive: "var(--loss)",
  very_aggressive: "var(--loss)",
};

const INPUT_STYLE = {
  background: "var(--bg)",
  border: "1px solid var(--line)",
  borderRadius: 6,
  color: "var(--text)",
} as const;

export function AccaPanelBody({
  locale,
  p,
  onClose,
}: {
  locale: string;
  p: PredictionStrings;
  onClose?: () => void;
}) {
  const {
    slip,
    stake,
    risk,
    remove,
    clear,
    undo,
    canUndo,
    updateStake,
    rename,
    saveNamed,
    named,
    loadNamed,
    deleteNamed,
    lastError,
    clearError,
  } = useAcca();
  const [nameInput, setNameInput] = useState(slip.name ?? "");
  const [status, setStatus] = useState<string | null>(null);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${accaSharePath(locale, encodeSharePayload(slip))}`
      : accaSharePath(locale, encodeSharePayload(slip));

  return (
    <div className="flex h-full flex-col">
      <header
        className="flex items-start justify-between gap-3 pb-3"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <div>
          <p className="rw3-label">{p.nvAccas}</p>
          <h2 id="acca-panel-title" className="rw3-title">
            {p.appTitle}
          </h2>
          <p className="rw3-meta mt-1">
            {formatDict(p.appCountLine, { n: String(slip.selections.length) })}
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rw3-hoverable inline-flex min-h-9 min-w-9 items-center justify-center"
            style={{ border: "1px solid var(--line)", borderRadius: 6, color: "var(--muted)" }}
            aria-label={p.appCloseAria}
          >
            <Icon name="close" size={14} />
          </button>
        ) : null}
      </header>

      {(lastError || status) && (
        <div
          className="mt-3 px-3 py-2 text-[12px]"
          style={{
            border: "1px solid var(--line)",
            borderRadius: 6,
            background: "var(--surface)",
            color: lastError ? "var(--loss)" : "var(--win)",
          }}
          role="status"
          aria-live="polite"
        >
          {lastError ?? status}
          {lastError ? (
            <button
              type="button"
              className="ml-2 font-semibold underline"
              onClick={clearError}
            >
              {p.appDismiss}
            </button>
          ) : null}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canUndo}
          onClick={undo}
          className="rw3-ghost min-h-9 disabled:opacity-40"
        >
          {p.appUndo}
        </button>
        <button
          type="button"
          disabled={!slip.selections.length}
          onClick={() => {
            clear();
            setStatus(p.appCleared);
          }}
          className="rw3-ghost min-h-9 disabled:opacity-40"
        >
          {p.appClearAll}
        </button>
        <Link href={`/${locale}/acca`} className="rw3-ghost min-h-9" onClick={onClose}>
          {p.appOpenStudio}
        </Link>
        <Link href={`/${locale}/acca/builder`} className="rw3-ghost min-h-9" onClick={onClose}>
          {p.acBuilderTitle}
        </Link>
      </div>

      <ul className="mt-4 flex-1 space-y-2 overflow-auto pr-1">
        {!slip.selections.length ? (
          <li
            className="px-3 py-6 text-[13px]"
            style={{ border: "1px dashed var(--line)", borderRadius: 6, color: "var(--muted)" }}
          >
            {p.appEmptySlip}
          </li>
        ) : (
          slip.selections.map((s) => (
            <li
              key={s.id}
              className="px-3 py-2"
              style={{
                border: "1px solid var(--line)",
                borderRadius: 6,
                background: "var(--surface)",
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[14px] font-semibold">
                    {s.homeTeam} vs {s.awayTeam}
                  </p>
                  <p className="rw3-meta mt-0.5">
                    {s.marketLabel} · {s.selectionLabel}
                    {s.odds != null ? ` · @ ${s.odds.toFixed(2)}` : ` · ${p.appOddsUnavailable}`}
                    {/*
                      FootyStats' market potential, carried through from the fixture that
                      produced this leg. It rendered as a bare percentage with no label at all,
                      which read as a confidence the figure has no claim to and no sample for.
                    */}
                    {s.confidence != null
                      ? ` · ${formatDict(p.appProviderPotential, { pct: String(s.confidence) })}`
                      : ""}
                  </p>
                  <p className="rw3-meta mt-0.5">
                    {s.competition}
                    {s.status !== "pending" && s.status !== "unknown"
                      ? ` · ${s.status}`
                      : ""}
                  </p>
                  {s.evidenceSummary[0] ? (
                    <p className="rw3-meta mt-1">{s.evidenceSummary[0]}</p>
                  ) : null}
                  <Link
                    href={s.matchHref}
                    className="mt-1 inline-block hover:underline"
                    style={{ fontSize: 12, fontWeight: 500, color: "var(--text)" }}
                    onClick={onClose}
                  >
                    {p.appMatchDetail}
                  </Link>
                </div>
                <button
                  type="button"
                  className="text-[12px] hover:underline"
                  style={{ color: "var(--muted)" }}
                  aria-label={formatDict(p.appRemoveAria, { home: s.homeTeam, away: s.awayTeam })}
                  onClick={() => remove(s.id)}
                >
                  {p.appRemove}
                </button>
              </div>
            </li>
          ))
        )}
      </ul>

      <section
        className="mt-4 space-y-3 pt-4"
        style={{ borderTop: "1px solid var(--line)" }}
        aria-label="Acca summary"
      >
        <dl className="grid grid-cols-2 gap-2 text-[13px]">
          <div>
            <dt className="rw3-label">{p.appCombinedOdds}</dt>
            <dd className="font-semibold">
              {stake.combinedOdds != null ? stake.combinedOdds.toFixed(2) : "—"}
              {!stake.oddsComplete && stake.missingOddsCount > 0 ? (
                <span className="ml-1 font-normal" style={{ fontSize: 11, color: "var(--muted)" }}>
                  {p.appIncomplete}
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="rw3-label">{p.appRiskClass}</dt>
            <dd>
              <span className="rw3-pill" style={{ color: RISK_TONE_INK[risk.class] }}>
                {risk.label}
              </span>
            </dd>
          </div>
        </dl>
        <ul className="rw3-meta list-disc space-y-0.5 pl-4">
          {risk.reasons.slice(0, 3).map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>

        <label className="block text-[13px]">
          <span className="rw3-label">{p.appStakeUnits}</span>
          <input
            type="number"
            min={0}
            step={1}
            value={Number.isFinite(slip.stake) ? slip.stake : 0}
            onChange={(e) => updateStake(Number(e.target.value))}
            className="mt-1 w-full px-3 py-2 text-[13px]"
            style={INPUT_STYLE}
          />
        </label>
        <dl className="grid grid-cols-2 gap-2 text-[13px]">
          <div>
            <dt className="rw3-label">{p.appPotentialReturn}</dt>
            <dd>{stake.potentialReturn != null ? stake.potentialReturn.toFixed(2) : "—"}</dd>
          </div>
          <div>
            <dt className="rw3-label">{p.appPotentialProfit}</dt>
            <dd>{stake.potentialProfit != null ? stake.potentialProfit.toFixed(2) : "—"}</dd>
          </div>
        </dl>
        <p className="rw3-meta">{p.appUnitsNote}</p>
      </section>

      <AccaOperators locale={locale} p={p} />

      <section
        className="mt-5 space-y-2 pt-4"
        style={{ borderTop: "1px solid var(--line)" }}
        aria-label="Save and share"
      >
        <label className="block text-[13px]">
          <span className="rw3-label">{p.appNameLabel}</span>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={() => rename(nameInput || null)}
            maxLength={80}
            className="mt-1 w-full px-3 py-2 text-[13px]"
            style={INPUT_STYLE}
            placeholder={p.appNamePlaceholder}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!nameInput.trim() || !slip.selections.length}
            className="rw3-ghost min-h-9 disabled:opacity-40"
            onClick={() => {
              saveNamed(nameInput);
              setStatus(p.appSavedLocally);
            }}
          >
            {p.appSaveNamed}
          </button>
          <button
            type="button"
            disabled={!slip.selections.length}
            className="rw3-ghost min-h-9 disabled:opacity-40"
            onClick={async () => {
              const text = formatAccaText(slip);
              try {
                await navigator.clipboard.writeText(text);
                trackAccaEvent("acca_copy_clicked", { locale, slip });
                setStatus(p.appCopied);
              } catch {
                setStatus(p.appClipboardUnavailable);
              }
            }}
          >
            {p.appCopy}
          </button>
          <button
            type="button"
            disabled={!slip.selections.length}
            className="rw3-ghost min-h-9 disabled:opacity-40"
            onClick={async () => {
              const text = formatAccaText(slip, { telegram: true });
              try {
                await navigator.clipboard.writeText(text);
                trackAccaEvent("acca_telegram_export", { locale, slip });
                setStatus(p.appTelegramCopied);
              } catch {
                setStatus(p.appClipboardUnavailable);
              }
            }}
          >
            {p.appTelegramText}
          </button>
          <button
            type="button"
            disabled={!slip.selections.length}
            className="rw3-ghost min-h-9 disabled:opacity-40"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(shareUrl);
                trackAccaEvent("acca_share_clicked", { locale, slip });
                setStatus(p.appShareCopied);
              } catch {
                setStatus(p.appClipboardUnavailable);
              }
            }}
          >
            {p.appShareUrl}
          </button>
        </div>
        {named.length ? (
          <div className="mt-2">
            <p className="rw3-label">{p.appSavedAccas}</p>
            <ul className="mt-1 space-y-1">
              {named.slice(0, 6).map((n) => (
                <li key={n.id} className="flex items-center justify-between gap-2 text-[12px]">
                  <button
                    type="button"
                    className="text-left font-medium hover:underline"
                    style={{ color: "var(--text)" }}
                    onClick={() => loadNamed(n.id)}
                  >
                    {n.name}
                  </button>
                  <button
                    type="button"
                    style={{ color: "var(--muted)" }}
                    aria-label={formatDict(p.appDeleteAria, { name: n.name })}
                    onClick={() => deleteNamed(n.id)}
                  >
                    {p.appDelete}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
