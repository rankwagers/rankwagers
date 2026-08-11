"use client";

import { useState } from "react";
import Link from "next/link";
import { useAcca } from "./AccaProvider";
import { AccaOperators } from "./AccaOperators";
import { formatAccaText } from "@/lib/acca/exportText";
import { trackAccaEvent } from "@/lib/acca/analytics";
import { accaSharePath, encodeSharePayload } from "@/lib/acca/share";
import { RISK_TONE_CLASS } from "@/lib/ui/tokens";
import { X } from "lucide-react";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";

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
      <header className="flex items-start justify-between gap-3 border-b border-border pb-3">
        <div>
          <p className="text-metadata font-medium uppercase tracking-label text-[var(--hero-ink)]">
            Accumulators
          </p>
          <h2 id="acca-panel-title" className="rw-display text-lg font-semibold text-foreground">
            Your Acca
          </h2>
          <p className="mt-1 text-xs text-[var(--hero-ink-2)]">
            {slip.selections.length} selection{slip.selections.length === 1 ? "" : "s"} · research
            slip only
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-border text-sm"
            aria-label="Close Acca panel"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </header>

      {(lastError || status) && (
        <div
          className={`mt-3 rounded-md border px-3 py-2 text-xs ${
            lastError
              ? "border-[var(--amber-border)] bg-[var(--amber-surface)] text-[var(--amber-primary)]"
              : "border-[var(--green-primary)]/20 bg-[var(--green-surface)] text-[var(--green-deep)]"
          }`}
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
              Dismiss
            </button>
          ) : null}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canUndo}
          onClick={undo}
          className="inline-flex min-h-9 items-center rounded-md border border-border px-2.5 text-xs font-medium disabled:opacity-[var(--opacity-disabled)]"
        >
          Undo
        </button>
        <button
          type="button"
          disabled={!slip.selections.length}
          onClick={() => {
            clear();
            setStatus("Acca cleared.");
          }}
          className="inline-flex min-h-9 items-center rounded-md border border-border px-2.5 text-xs font-medium disabled:opacity-[var(--opacity-disabled)]"
        >
          Clear all
        </button>
        <Link
          href={`/${locale}/acca`}
          className="inline-flex min-h-9 items-center rounded-md border border-brand/30 px-2.5 text-xs font-semibold text-[var(--hero-ink)]"
          onClick={onClose}
        >
          Open studio
        </Link>
        <Link
          href={`/${locale}/acca/builder`}
          className="inline-flex min-h-9 items-center rounded-md border border-border px-2.5 text-xs font-semibold"
          onClick={onClose}
        >
          Acca Builder
        </Link>
      </div>

      <ul className="mt-4 flex-1 space-y-2 overflow-auto pr-1">
        {!slip.selections.length ? (
          <li className="rounded-md border border-dashed border-border px-3 py-6 text-sm text-[var(--hero-ink-2)]">
            Add selections from match pages, ranked markets, or the fixture explorer. Only
            settlement-supported markets are available.
          </li>
        ) : (
          slip.selections.map((s) => (
            <li
              key={s.id}
              className="rounded-md border border-border bg-[var(--canvas-secondary)] px-3 py-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {s.homeTeam} vs {s.awayTeam}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--hero-ink-2)]">
                    {s.marketLabel} · {s.selectionLabel}
                    {s.odds != null ? ` · @ ${s.odds.toFixed(2)}` : " · odds unavailable"}
                    {/*
                      FootyStats' market potential, carried through from the fixture that
                      produced this leg. It rendered as a bare percentage with no label at all,
                      which read as a confidence the figure has no claim to and no sample for.
                    */}
                    {s.confidence != null
                      ? ` · provider potential ${s.confidence}% (no sample)`
                      : ""}
                  </p>
                  <p className="mt-0.5 text-metadata text-[var(--hero-ink-2)]">
                    {s.competition}
                    {s.status !== "pending" && s.status !== "unknown"
                      ? ` · ${s.status}`
                      : ""}
                  </p>
                  {s.evidenceSummary[0] ? (
                    <p className="mt-1 text-metadata text-[var(--ink-secondary)]">
                      {s.evidenceSummary[0]}
                    </p>
                  ) : null}
                  <Link
                    href={s.matchHref}
                    className="mt-1 inline-block text-metadata font-medium text-[var(--hero-ink)] hover:underline"
                    onClick={onClose}
                  >
                    Match detail
                  </Link>
                </div>
                <button
                  type="button"
                  className="text-xs text-[var(--hero-ink-2)] hover:text-foreground"
                  aria-label={`Remove ${s.homeTeam} vs ${s.awayTeam}`}
                  onClick={() => remove(s.id)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))
        )}
      </ul>

      <section className="mt-4 space-y-3 border-t border-border pt-4" aria-label="Acca summary">
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-metadata uppercase tracking-label text-[var(--hero-ink-2)]">
              Combined odds
            </dt>
            <dd className="font-mono font-semibold">
              {stake.combinedOdds != null ? stake.combinedOdds.toFixed(2) : "—"}
              {!stake.oddsComplete && stake.missingOddsCount > 0 ? (
                <span className="ml-1 text-metadata font-normal text-[var(--hero-ink-2)]">
                  incomplete
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-metadata uppercase tracking-label text-[var(--hero-ink-2)]">
              Risk class
            </dt>
            <dd>
              <span
                className={`inline-flex rounded-sm px-2 py-0.5 text-xs font-semibold ${RISK_TONE_CLASS[risk.class]}`}
              >
                {risk.label}
              </span>
            </dd>
          </div>
        </dl>
        <ul className="list-disc space-y-0.5 pl-4 text-metadata text-[var(--hero-ink-2)]">
          {risk.reasons.slice(0, 3).map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>

        <label className="block text-sm">
          <span className="text-metadata uppercase tracking-label text-[var(--hero-ink-2)]">
            Stake (units)
          </span>
          <input
            type="number"
            min={0}
            step={1}
            value={Number.isFinite(slip.stake) ? slip.stake : 0}
            onChange={(e) => updateStake(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 font-mono text-sm"
          />
        </label>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-metadata uppercase tracking-label text-[var(--hero-ink-2)]">
              Potential return
            </dt>
            <dd className="font-mono">
              {stake.potentialReturn != null ? stake.potentialReturn.toFixed(2) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-metadata uppercase tracking-label text-[var(--hero-ink-2)]">
              Potential profit
            </dt>
            <dd className="font-mono">
              {stake.potentialProfit != null ? stake.potentialProfit.toFixed(2) : "—"}
            </dd>
          </div>
        </dl>
        <p className="text-metadata text-[var(--hero-ink-2)]">
          Units are currency-neutral research figures — not a wallet and not a placed bet.
        </p>
      </section>

      <AccaOperators locale={locale} p={p} />

      <section className="mt-5 space-y-2 border-t border-border pt-4" aria-label="Save and share">
        <label className="block text-sm">
          <span className="text-metadata uppercase tracking-label text-[var(--hero-ink-2)]">
            Name this Acca
          </span>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={() => rename(nameInput || null)}
            maxLength={80}
            className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
            placeholder="e.g. Saturday overs"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!nameInput.trim() || !slip.selections.length}
            className="inline-flex min-h-9 items-center rounded-md border border-border px-2.5 text-xs font-medium disabled:opacity-[var(--opacity-disabled)]"
            onClick={() => {
              saveNamed(nameInput);
              setStatus("Saved locally.");
            }}
          >
            Save named Acca
          </button>
          <button
            type="button"
            disabled={!slip.selections.length}
            className="inline-flex min-h-9 items-center rounded-md border border-border px-2.5 text-xs font-medium disabled:opacity-[var(--opacity-disabled)]"
            onClick={async () => {
              const text = formatAccaText(slip);
              try {
                await navigator.clipboard.writeText(text);
                trackAccaEvent("acca_copy_clicked", { locale, slip });
                setStatus("Copied as text.");
              } catch {
                setStatus("Clipboard unavailable.");
              }
            }}
          >
            Copy
          </button>
          <button
            type="button"
            disabled={!slip.selections.length}
            className="inline-flex min-h-9 items-center rounded-md border border-border px-2.5 text-xs font-medium disabled:opacity-[var(--opacity-disabled)]"
            onClick={async () => {
              const text = formatAccaText(slip, { telegram: true });
              try {
                await navigator.clipboard.writeText(text);
                trackAccaEvent("acca_telegram_export", { locale, slip });
                setStatus("Telegram-friendly text copied.");
              } catch {
                setStatus("Clipboard unavailable.");
              }
            }}
          >
            Telegram text
          </button>
          <button
            type="button"
            disabled={!slip.selections.length}
            className="inline-flex min-h-9 items-center rounded-md border border-border px-2.5 text-xs font-medium disabled:opacity-[var(--opacity-disabled)]"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(shareUrl);
                trackAccaEvent("acca_share_clicked", { locale, slip });
                setStatus("Share URL copied (noindex restore link).");
              } catch {
                setStatus("Clipboard unavailable.");
              }
            }}
          >
            Share URL
          </button>
        </div>
        {named.length ? (
          <div className="mt-2">
            <p className="text-metadata uppercase tracking-label text-[var(--hero-ink-2)]">
              Saved Accas
            </p>
            <ul className="mt-1 space-y-1">
              {named.slice(0, 6).map((n) => (
                <li key={n.id} className="flex items-center justify-between gap-2 text-xs">
                  <button
                    type="button"
                    className="text-left font-medium text-[var(--hero-ink)] hover:underline"
                    onClick={() => loadNamed(n.id)}
                  >
                    {n.name}
                  </button>
                  <button
                    type="button"
                    className="text-[var(--hero-ink-2)]"
                    aria-label={`Delete ${n.name}`}
                    onClick={() => deleteNamed(n.id)}
                  >
                    Delete
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
