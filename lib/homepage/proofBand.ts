/**
 * S2 PROOF BAND — which figures the settled record can actually state.
 *
 * The band's composition comes from the approved design; its figures do not. This module is the
 * one place that decides what appears, so the rule can be tested rather than reviewed: every
 * figure below is backed by a field on `HomepageVerifiedPerformance`, and a field the record does
 * not carry produces no figure at all.
 *
 * What is deliberately absent, and why:
 *
 *   ROI, average odds        no field exists. `sampleNote` has always said so — they are omitted
 *                            when publication odds are not durably archived (rwbible §3.2).
 *   "since 2020"             asserts an archive depth the product does not compute.
 *   "rolling 12 months"      asserts a window the product does not compute. The real window is
 *                            `windowLabel`, and it is stated as the hit rate's own note.
 *   closing price, worst
 *   month, competition split  no field, and no series to derive them from.
 */

import { formatDict } from "@/lib/dictionaryExtras";
import type { HomepageVerifiedPerformance } from "./types";

export type ProofFigureKey = "published" | "settled" | "hitRate" | "open";

export type ProofFigureModel = {
  key: ProofFigureKey;
  label: string;
  value: string;
  /** A sourced sentence, always visible. */
  note?: string;
  /** A second sourced sentence, cross-faded into the same space on approach. */
  audit?: string;
};

export type ProofBandCopy = {
  published: string;
  settled: string;
  hitRate: string;
  open: string;
  /** Template carrying `{won}` and `{lost}`. */
  wonLost: string;
  /** Template carrying `{count}`. */
  stillOpen: string;
};

export function buildProofBandFigures(
  verified: HomepageVerifiedPerformance,
  copy: ProofBandCopy
): ProofFigureModel[] {
  const figures: ProofFigureModel[] = [
    {
      key: "published",
      label: copy.published,
      value: String(verified.totalPredictions),
    },
    {
      key: "settled",
      label: copy.settled,
      value: String(verified.settledPredictions),
      /*
       * The loss is stated here, always visible, in the same ink and at the same size as the win.
       * It is never the hover reveal — a record that discloses its losses only to a pointer has
       * not disclosed them.
       */
      note: formatDict(copy.wonLost, {
        won: String(verified.won),
        lost: String(verified.lost),
      }),
      /*
       * Safe as the reveal because the same number is its own figure below. Nothing on this band
       * is reachable only by hovering.
       */
      audit: formatDict(copy.stillOpen, {
        count: String(verified.pendingPredictions),
      }),
    },
  ];

  /*
   * `hitRatePct` is null on an empty settled sample, and the figure is then OMITTED.
   *
   * Not zero — that asserts a measured rate of nought. Not a dash — that renders the absence as
   * though it were a reading. An omitted figure is the honest shape of a record that has settled
   * nothing yet, and it is the same rule the hero funnel follows for an unobserved stage.
   *
   * `windowLabel` travels with it, because it exists to qualify this rate.
   */
  if (verified.hitRatePct !== null) {
    figures.push({
      key: "hitRate",
      label: copy.hitRate,
      value: `${verified.hitRatePct}%`,
      note: verified.windowLabel,
    });
  }

  figures.push({
    key: "open",
    label: copy.open,
    value: String(verified.pendingPredictions),
  });

  return figures;
}
