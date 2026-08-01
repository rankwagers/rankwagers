"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ComboApiResponse,
  PublicEvidenceCombo,
  PublicOperatorMatch,
} from "@/lib/combo/apiTypes";
import { trackComboEvent } from "@/lib/combo/analytics";
import {
  generateComboRequest,
  removeComboRequest,
  replaceComboRequest,
  type ComboFormState,
} from "@/lib/combo/clientApi";
import { TARGET_PRESETS } from "@/lib/combo/config";
import type { ComboClientSnapshot } from "@/lib/combo/prepare";
import {
  loadComboPreferences,
  loadSessionCombo,
  saveComboPreferences,
  saveSessionCombo,
} from "@/lib/combo/persistence";
import type { ReplacementMode } from "@/lib/combo/types";
import { ComboEmptyState } from "./ComboEmptyState";
import { ComboErrorState } from "./ComboErrorState";
import { ComboForm } from "./ComboForm";
import {
  ComboGenerationProgress,
  COMBO_PROGRESS_STAGE_COUNT,
} from "./ComboGenerationProgress";
import { ComboHero } from "./ComboHero";
import { ComboOperatorSheet } from "./ComboOperatorSheet";
import { ComboResult } from "./ComboResult";
import { ComboStaleState } from "./ComboStaleState";
import { ComboStickyBar } from "./ComboStickyBar";

const ComboOperatorComparison = dynamic(
  () =>
    import("./ComboOperatorComparison").then((m) => m.ComboOperatorComparison),
  { ssr: false }
);

const DEFAULT_FORM: ComboFormState = {
  targetOddsMin: 2,
  targetOddsMax: 3,
  riskProfile: "balanced",
  marketPreferences: ["mixed"],
  maxSelections: 3,
  excludeSameCompetition: false,
  excludeSameCountry: false,
  limitSameKickoffWindow: true,
};

function mapFieldErrors(response: ComboApiResponse): Record<string, string> {
  if (response.status !== "invalid_request") return {};
  const out: Record<string, string> = {};
  for (const error of response.errors) {
    out[error.field] = error.message;
  }
  return out;
}

function copyText(combo: PublicEvidenceCombo): string {
  const lines = [
    "RankWagers Evidence Combo",
    "",
    ...combo.selections.map(
      (s) => `${s.homeTeam} vs ${s.awayTeam} — ${s.marketLabel} @ ${s.odds.toFixed(2)}`
    ),
    "",
    `Combined odds: ${combo.combinedOdds.toFixed(2)}`,
    `Generated: ${combo.generatedAt}`,
    "Odds may change.",
  ];
  return lines.join("\n");
}

export function ComboStudio({
  locale,
  country,
  snapshot,
  compact = false,
  initialTargetPreset,
}: {
  locale: string;
  country?: string;
  snapshot: ComboClientSnapshot;
  compact?: boolean;
  /** Query `target` preset id — preferences still win if stored. */
  initialTargetPreset?: string;
}) {
  const [form, setForm] = useState<ComboFormState>(() => {
    const preset = TARGET_PRESETS.find((p) => p.id === initialTargetPreset);
    if (!preset) return DEFAULT_FORM;
    return {
      ...DEFAULT_FORM,
      targetOddsMin: preset.min,
      targetOddsMax: preset.max,
    };
  });
  const [combo, setCombo] = useState<PublicEvidenceCombo | null>(null);
  const [alternatives, setAlternatives] = useState<PublicEvidenceCombo[]>([]);
  const [operators, setOperators] = useState<PublicOperatorMatch[]>([]);
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState("");
  const [errorTitle, setErrorTitle] = useState<string | null>(null);
  const [errorBody, setErrorBody] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const requestSeq = useRef(0);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    trackComboEvent("combo_studio_view", { locale, country });
    const prefs = loadComboPreferences();
    if (prefs) setForm((prev) => ({ ...prev, ...prefs }));
    else if (initialTargetPreset) {
      const preset = TARGET_PRESETS.find((p) => p.id === initialTargetPreset);
      if (preset) {
        setForm((prev) => ({
          ...prev,
          targetOddsMin: preset.min,
          targetOddsMax: preset.max,
        }));
      }
    }
    const session = loadSessionCombo();
    if (session) {
      setCombo(session);
      setStale(true);
    }
    // Canonicalize query variants to the base combo route without reload.
    if (typeof window !== "undefined" && window.location.search) {
      const url = new URL(window.location.href);
      if (url.searchParams.has("target") || url.searchParams.has("country")) {
        // keep country for personalization; drop only target from address bar display
        url.searchParams.delete("target");
        window.history.replaceState({}, "", url.pathname + (url.search || ""));
      }
    }
  }, [locale, country, initialTargetPreset]);

  useEffect(() => {
    saveComboPreferences(form);
  }, [form]);

  const stopProgress = () => {
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
  };

  const startProgress = () => {
    stopProgress();
    setProgress(0);
    progressTimer.current = setInterval(() => {
      setProgress((p) => Math.min(COMBO_PROGRESS_STAGE_COUNT - 1, p + 1));
    }, 350);
  };

  const applySuccess = useCallback((response: Extract<ComboApiResponse, { status: "success" }>) => {
    setCombo(response.combo);
    setAlternatives(response.alternatives);
    setOperators(response.operators);
    saveSessionCombo(response.combo);
    setStale(false);
    setErrorTitle(null);
    setErrorBody(null);
    setStatusMessage(
      `Combo ready at ${response.combo.combinedOdds.toFixed(2)} with ${response.combo.selections.length} selections.`
    );
    trackComboEvent("combo_generate_success", {
      locale,
      country,
      comboId: response.combo.id,
      actualOdds: response.combo.combinedOdds,
      selectionCount: response.combo.selections.length,
      evidenceStrength: response.combo.aggregateEvidenceStrength,
      averageCoverage: response.combo.averageCoverage,
      riskProfile: response.combo.request.riskProfile,
      targetOddsMin: response.combo.request.targetOddsMin,
      targetOddsMax: response.combo.request.targetOddsMax,
    });
    trackComboEvent("combo_result_view", {
      locale,
      country,
      comboId: response.combo.id,
      actualOdds: response.combo.combinedOdds,
    });
    trackComboEvent("combo_operator_section_view", {
      locale,
      country,
      comboId: response.combo.id,
    });
  }, [country, locale]);

  const onGenerate = async () => {
    if (pending) return;
    if (snapshot.empty) {
      setErrorTitle("No prepared fixtures");
      setErrorBody("No qualified fixtures are available in the current snapshot.");
      return;
    }
    if (!snapshot.oddsCount) {
      setErrorTitle("No odds available");
      setErrorBody(
        "Odds could not be attached to the prepared snapshot. Refresh later or try again."
      );
      return;
    }

    const seq = ++requestSeq.current;
    setPending(true);
    setFieldErrors({});
    setErrorTitle(null);
    setErrorBody(null);
    startProgress();
    trackComboEvent("combo_builder_start", { locale, country });
    trackComboEvent("combo_generate_start", {
      locale,
      country,
      targetOddsMin: form.targetOddsMin,
      targetOddsMax: form.targetOddsMax,
      riskProfile: form.riskProfile,
      selectionCount: form.maxSelections,
      marketTypes: form.marketPreferences,
    });

    try {
      const response = await generateComboRequest(form, snapshot, locale, country);
      if (seq !== requestSeq.current) return;
      stopProgress();
      setProgress(COMBO_PROGRESS_STAGE_COUNT);

      if (response.status === "success") {
        applySuccess(response);
        return;
      }
      if (response.status === "invalid_request") {
        setFieldErrors(mapFieldErrors(response));
        setErrorTitle("Check your inputs");
        setErrorBody(response.errors[0]?.message ?? "Request validation failed");
        trackComboEvent("combo_generate_failure", {
          locale,
          country,
          riskProfile: form.riskProfile,
        });
        return;
      }
      if (response.status === "rate_limited") {
        setErrorTitle("Too many requests");
        setErrorBody("Please wait a moment and try again.");
        return;
      }
      if (response.status === "no_qualified_combo") {
        setCombo(response.closestQualifiedOption?.combo ?? null);
        setOperators(response.operators ?? []);
        setAlternatives([]);
        setErrorTitle("No qualified combination in this range");
        setErrorBody(
          response.closestQualifiedOption
            ? `A qualified option is available at combined odds of ${response.closestQualifiedOption.combinedOdds.toFixed(2)}. ${response.suggestedRange ? `Suggested range: ${response.suggestedRange.min}–${response.suggestedRange.max}.` : ""}`
            : response.message
        );
        trackComboEvent("combo_generate_failure", {
          locale,
          country,
          riskProfile: form.riskProfile,
        });
        return;
      }
    } catch {
      if (seq !== requestSeq.current) return;
      setErrorTitle("Generation failed");
      setErrorBody("Something went wrong while building the combo. Please try again.");
    } finally {
      if (seq === requestSeq.current) {
        stopProgress();
        setPending(false);
      }
    }
  };

  const onReplace = async (
    selection: { matchId: number; marketId: string },
    mode: ReplacementMode
  ) => {
    if (!combo || pending) return;
    setPending(true);
    trackComboEvent("combo_selection_replace_start", {
      locale,
      country,
      comboId: combo.id,
    });
    try {
      const response = await replaceComboRequest({
        combo,
        comboId: combo.id,
        selection,
        mode,
        snapshot,
        locale,
        country,
      });
      if (response.status === "success") {
        applySuccess(response);
        setStatusMessage(response.explanation ?? "Selection replaced.");
        trackComboEvent("combo_selection_replace_success", {
          locale,
          country,
          comboId: response.combo.id,
        });
      } else if (response.status === "no_replacement") {
        setStatusMessage(response.message);
        trackComboEvent("combo_selection_replace_failure", {
          locale,
          country,
          comboId: combo.id,
        });
      } else if (response.status === "invalid_request") {
        setStatusMessage(response.errors[0]?.message ?? "Replace failed");
      }
    } finally {
      setPending(false);
    }
  };

  const onRemove = async (selection: { matchId: number; marketId: string }) => {
    if (!combo || pending) return;
    setPending(true);
    try {
      const response = await removeComboRequest({
        combo,
        comboId: combo.id,
        selection,
        snapshot,
        locale,
        country,
      });
      if (response.status === "success") {
        applySuccess(response);
        setStatusMessage(
          `Selection removed. ${
            response.combo.inTargetRange
              ? "Still inside target range."
              : "Now outside target range."
          }`
        );
        trackComboEvent("combo_selection_remove", {
          locale,
          country,
          comboId: response.combo.id,
          selectionCount: response.combo.selections.length,
        });
      } else if (response.status === "invalid_request") {
        setStatusMessage(response.errors[0]?.message ?? "Remove failed");
      }
    } finally {
      setPending(false);
    }
  };

  const onCopy = async () => {
    if (!combo) return;
    try {
      await navigator.clipboard.writeText(copyText(combo));
      setStatusMessage("Combo copied to clipboard.");
      trackComboEvent("combo_copy", {
        locale,
        country,
        comboId: combo.id,
        actualOdds: combo.combinedOdds,
      });
    } catch {
      setStatusMessage("Could not copy combo.");
    }
  };

  return (
    <div className={compact ? "space-y-6" : "space-y-10 pb-24 md:pb-10"}>
      {!compact ? <ComboHero /> : null}

      <div className="sr-only" aria-live="polite">
        {statusMessage}
      </div>

      {snapshot.empty ? (
        <ComboEmptyState
          title="No qualified fixtures"
          body="The prepared research snapshot has no upcoming qualified fixtures for this date."
        />
      ) : null}

      {stale && combo ? <ComboStaleState onRefresh={onGenerate} /> : null}

      <section
        aria-labelledby="combo-builder-heading"
        className="rounded-md border border-border bg-[var(--canvas-secondary)] px-4 py-6 md:px-6"
      >
        <h2 id="combo-builder-heading" className="font-display text-xl font-semibold">
          {compact ? "Evidence Combo Studio" : "Configure your combo"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Snapshot {snapshot.snapshotId} · {snapshot.fixtureCount} fixtures ·{" "}
          {snapshot.oddsCount} odds rows · freshness{" "}
          {snapshot.oddsFreshness.replace(/_/g, " ")}
        </p>
        <div className="mt-6">
          <ComboForm
            form={form}
            onChange={(next) => {
              setForm(next);
              trackComboEvent("combo_target_select", {
                locale,
                country,
                targetOddsMin: next.targetOddsMin,
                targetOddsMax: next.targetOddsMax,
              });
              trackComboEvent("combo_risk_profile_select", {
                locale,
                country,
                riskProfile: next.riskProfile,
              });
              trackComboEvent("combo_market_select", {
                locale,
                country,
                marketTypes: next.marketPreferences,
              });
              trackComboEvent("combo_selection_limit_set", {
                locale,
                country,
                selectionCount: next.maxSelections,
              });
            }}
            onSubmit={onGenerate}
            pending={pending}
            fieldErrors={fieldErrors}
          />
        </div>
        {pending ? (
          <div className="mt-6">
            <ComboGenerationProgress activeIndex={progress} />
          </div>
        ) : null}
      </section>

      {errorTitle && errorBody ? (
        <ComboErrorState title={errorTitle} body={errorBody} />
      ) : null}

      {combo ? (
        <ComboResult
          combo={combo}
          alternatives={alternatives}
          operators={operators}
          locale={locale}
          pendingAction={pending}
          onReplace={onReplace}
          onRemove={onRemove}
          onExpand={() =>
            trackComboEvent("combo_selection_expand", {
              locale,
              country,
              comboId: combo.id,
            })
          }
          onSelectAlternative={(alt, index) => {
            setCombo(alt);
            saveSessionCombo(alt);
            trackComboEvent("combo_alternative_view", {
              locale,
              country,
              comboId: alt.id,
            });
            trackComboEvent("combo_alternative_select", {
              locale,
              country,
              comboId: alt.id,
              actualOdds: alt.combinedOdds,
              placement: String(index),
            });
            setStatusMessage(`Switched to alternative at ${alt.combinedOdds.toFixed(2)}.`);
          }}
          onCompare={() => {
            setCompareOpen(true);
            trackComboEvent("combo_operator_compare_open", {
              locale,
              country,
              comboId: combo.id,
            });
          }}
          onOperatorView={(op) =>
            trackComboEvent("combo_operator_card_view", {
              locale,
              country,
              comboId: combo.id,
              operatorId: op.slug,
              operatorRank: op.rank,
              operatorAvailability: op.availability,
            })
          }
          onOperatorClick={(op) => {
            trackComboEvent("combo_operator_click", {
              locale,
              country,
              comboId: combo.id,
              operatorId: op.slug,
              operatorRank: op.rank,
              operatorAvailability: op.availability,
              deeplinkType: op.deeplinkType,
            });
            trackComboEvent("combo_deeplink_click", {
              locale,
              country,
              comboId: combo.id,
              operatorId: op.slug,
              deeplinkType: op.deeplinkType,
            });
          }}
          onCopy={onCopy}
          onFindReplacement={() => {
            const first = combo.selections[0];
            if (first) onReplace(
              { matchId: first.matchId, marketId: first.marketId },
              "stronger_evidence"
            );
          }}
        />
      ) : null}

      {combo ? (
        <ComboStickyBar
          selectionCount={combo.selections.length}
          combinedOdds={combo.combinedOdds}
          onOpenOperators={() => setSheetOpen(true)}
        />
      ) : null}

      <ComboOperatorSheet
        open={sheetOpen}
        operators={operators}
        locale={locale}
        onClose={() => setSheetOpen(false)}
        onCompare={() => {
          setSheetOpen(false);
          setCompareOpen(true);
        }}
        onOperatorClick={(op) => {
          trackComboEvent("combo_operator_click", {
            locale,
            country,
            comboId: combo?.id,
            operatorId: op.slug,
            deeplinkType: op.deeplinkType,
          });
        }}
      />

      <ComboOperatorComparison
        open={compareOpen}
        operators={operators}
        locale={locale}
        onClose={() => setCompareOpen(false)}
        onOperatorClick={(op) => {
          trackComboEvent("combo_operator_click", {
            locale,
            country,
            comboId: combo?.id,
            operatorId: op.slug,
            deeplinkType: op.deeplinkType,
          });
        }}
      />
    </div>
  );
}
