/**
 * Operator ordering transparency (Sprint 28).
 *
 * THE DEFECT THIS EXISTS TO FIX
 *
 * Every operator list rendered a `rank` that was computed as `i + 1` — the position of the brand
 * in a hand-written array. A reader shown "#1" reasonably understands it as a finding: this
 * operator came first for a reason. It did not. Nothing was measured, compared or scored; the
 * number restated the array index and nothing else.
 *
 * That is the same class of claim as the crypto FAQ's "our top-rated site" (Sprint 27, P1-09) —
 * marketing wearing the clothes of evidence — and it violated the manifesto directly:
 * "Everything shown on the platform must be explainable through data."
 *
 * WHAT THE DATA ACTUALLY SHOWS
 *
 * All 13 brands carry complete scores, and the curated array order already matches composite
 * score descending (9.26, 8.90, 8.70, 8.70, 8.50 … 7.70). So the ordering was never arbitrary —
 * it was simply unverified and undisclosed. Nothing linked the displayed position to the scores,
 * nothing checked that the two agreed, and no criteria were published for a reader to consult.
 *
 * WHY THE ORDER IS NOT CHANGED
 *
 * Because it does not need to be. The order is already score-consistent, so this fix is purely
 * about making a true statement verifiable instead of assumed. Reordering would also silently
 * redistribute affiliate placement, which a correctness fix has no business doing.
 *
 * WHY THE BASIS IS VERIFIED RATHER THAN ASSUMED
 *
 * `deriveOrderingBasis` requires both complete scores AND that the displayed order actually
 * follows them. Score data merely existing proves nothing about the order it is shown in. If
 * anyone reorders the list without updating the scores, the basis drops to "editorial" by itself
 * and the reader-facing disclosure changes with it, rather than the product continuing to claim
 * a ranking it no longer performs.
 */

/** How a given list's order was actually decided. */
export type OrderingBasis =
  /** Curated editorial placement. Not measured, and not presented as a ranking. */
  | "editorial"
  /** Every operator in the list carried complete scores and the order reflects them. */
  | "scored";

/**
 * The score dimensions a brand may declare. Listed here so the published criteria and the data
 * model cannot drift apart.
 */
export const SCORE_DIMENSIONS = ["bonus", "odds", "payments", "app", "support"] as const;
export type ScoreDimension = (typeof SCORE_DIMENSIONS)[number];

export type OperatorScores = Partial<Record<ScoreDimension, number>>;

/** A brand is scoreable only when every declared dimension carries a finite number. */
export function hasCompleteScores(scores: OperatorScores | undefined | null): boolean {
  if (!scores) return false;
  return SCORE_DIMENSIONS.every(
    (d) => typeof scores[d] === "number" && Number.isFinite(scores[d] as number),
  );
}

/**
 * Composite score: the unweighted mean of the declared dimensions.
 *
 * Unweighted on purpose. Any weighting is an editorial judgement, and a weighted number that
 * looks objective is exactly the kind of false precision this module exists to prevent. Returns
 * null when the operator is not fully scored — never a partial average, which would silently
 * reward operators with missing data.
 */
export function compositeScore(scores: OperatorScores | undefined | null): number | null {
  if (!hasCompleteScores(scores)) return null;
  const s = scores as Record<ScoreDimension, number>;
  return SCORE_DIMENSIONS.reduce((sum, d) => sum + s[d], 0) / SCORE_DIMENSIONS.length;
}

/**
 * Is the list actually in non-increasing composite-score order?
 *
 * This is the check that turns "scored" from an assumption into a verified statement. Score data
 * merely EXISTING proves nothing about the order it is displayed in — the two could drift apart
 * the moment someone reorders the array, and nothing would notice.
 */
export function isOrderedByScore(
  brands: ReadonlyArray<{ scores?: OperatorScores }>,
): boolean {
  const composites = brands.map((b) => compositeScore(b.scores));
  if (composites.some((c) => c === null)) return false;
  for (let i = 1; i < composites.length; i++) {
    // Tolerance for floating-point mean arithmetic; ties are legitimate and stay in place.
    if ((composites[i] as number) > (composites[i - 1] as number) + 1e-9) return false;
  }
  return true;
}

/**
 * Decide the basis for a whole list.
 *
 * Requires BOTH conditions, and says "scored" only when both hold:
 *
 *  1. every operator carries complete scores — a list where some are scored and others are not
 *     cannot honestly be called scored, because the unscored ones would be positioned by
 *     something else while wearing the same presentation; and
 *  2. the displayed order actually follows those scores.
 *
 * The second condition is what makes this self-correcting. If anyone reorders the list without
 * updating the underlying scores, the basis drops to "editorial" on its own and the reader-facing
 * disclosure changes with it — instead of the product continuing to claim a ranking it no longer
 * performs.
 */
export function deriveOrderingBasis(
  brands: ReadonlyArray<{ scores?: OperatorScores }>,
): OrderingBasis {
  if (brands.length === 0) return "editorial";
  if (!brands.every((b) => hasCompleteScores(b.scores))) return "editorial";
  return isOrderedByScore(brands) ? "scored" : "editorial";
}

/**
 * Reader-facing disclosure for a list, matched to its real basis.
 *
 * There is no variant that describes an unmeasured order as a ranking.
 */
export function orderingDisclosure(basis: OrderingBasis): string {
  return basis === "scored"
    ? "Ordered by our published criteria: bonus terms, odds competitiveness, payment options, app quality and support."
    : "Listed in our editorial order, not ranked by score. Placement does not indicate that one operator is better than another — compare the details and decide for yourself.";
}

/**
 * The published criteria, stated once.
 *
 * These are the dimensions the product WOULD rank on, and the ones an operator review discusses.
 * They are exposed so a comparison surface can show its working instead of asserting a verdict.
 */
export const RANKING_CRITERIA: ReadonlyArray<{ dimension: ScoreDimension; label: string; describes: string }> = [
  { dimension: "bonus", label: "Bonus terms", describes: "Headline value weighed against wagering requirements and expiry." },
  { dimension: "odds", label: "Odds competitiveness", describes: "How prices compare on the markets we track." },
  { dimension: "payments", label: "Payments", describes: "Deposit and withdrawal methods, limits and typical settlement time." },
  { dimension: "app", label: "App and site quality", describes: "Usability of the mobile and desktop experience." },
  { dimension: "support", label: "Support", describes: "Availability and responsiveness of customer support." },
];

/**
 * The commercial relationship, named separately so it can be placed first.
 *
 * It is still a member of {@link RANKING_LIMITATIONS} — the list below references this constant
 * rather than repeating the sentence, so the two can never drift. It is exported on its own because
 * of WHERE it has to appear: a reader cannot calibrate the criteria, the ordering, or anything else
 * on the page until they know what we earn from it. That makes it the first thing shown, not the
 * fourth item inside a collapsed block.
 */
export const COMMISSION_DISCLOSURE =
  "We earn commission from some operators. That does not change the criteria, but you should know it.";

/**
 * What we do NOT assess, stated as plainly as what we do.
 *
 * A criteria list that only says what is covered implies the rest was checked. It was not.
 */
export const RANKING_LIMITATIONS: readonly string[] = [
  "We do not audit an operator's solvency, licensing status or payout behaviour.",
  "We do not verify bonus terms against the operator's current site on every visit.",
  "Availability and terms vary by country and can change without notice.",
  COMMISSION_DISCLOSURE,
];

/**
 * Position in a list is a POSITION, not a rank.
 *
 * Kept as a distinct concept so analytics and affiliate attribution can continue to record where
 * a click came from, without any surface treating that number as a verdict. Attribution needs to
 * know "third card in the list"; a reader must not be told "third best".
 */
export function listPosition(index: number): number {
  return index + 1;
}
