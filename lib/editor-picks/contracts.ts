import { findClaimViolations, type ClaimViolation } from "@/lib/trust/claims";

/* ============================================================================
   EDITOR PICKS — contracts and validation (Bible V3, block F).

   Pure data and pure functions: no I/O, no React, no server-only imports —
   the admin client runs the SAME validation the write endpoint enforces, so
   the compliance panel and the save gate can never disagree.

   The manual pick carries only what an editor genuinely authors: the
   fixture, one sentence (≤110 chars — the card's claim), an optional long
   note (the fixture page's editor-note block), and a visibility window.
   Every NUMBER on the rendered card still comes from the signal engine —
   an editor authors words, never rates (no fake precision).
   ========================================================================== */

export const SENTENCE_MAX = 110;
export const MAX_PICKS = 8;

export type EditorPickRecord = {
  id: string;
  matchId: number;
  /** ≤110 chars — the band card's sentence, replacing the engine's. */
  sentence: string;
  /** Optional. Renders as the editor-note block under L1 on the fixture page. */
  longNote: string | null;
  /** ISO instant; null = visible immediately. */
  startsAt: string | null;
  /** ISO instant; null = visible until the fixture leaves the board. */
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EditorPicksDocument = {
  version: 1;
  /** Admin drag order — ids; the band renders in this order. */
  order: string[];
  picks: EditorPickRecord[];
  /** Offer-of-the-day pin; null = the ranked default. */
  pinnedOperatorSlug: string | null;
  updatedAt: string;
};

export function emptyEditorPicksDocument(): EditorPicksDocument {
  return {
    version: 1,
    order: [],
    picks: [],
    pinnedOperatorSlug: null,
    updatedAt: new Date(0).toISOString(),
  };
}

export type EditorPicksIssue = {
  /** null = document-level; otherwise the offending pick's id. */
  pickId: string | null;
  code:
    | "sentence_empty"
    | "sentence_too_long"
    | "window_inverted"
    | "duplicate_fixture"
    | "order_mismatch"
    | "too_many_picks"
    | "banned_claim";
  message: string;
  /** Present for banned_claim — the matched rule, for the compliance panel. */
  violation?: ClaimViolation;
};

/**
 * The one validator both sides run. Banned claims BLOCK the save — the
 * manifesto's language rules are enforced before storage, not after render.
 */
export function validateEditorPicksDocument(doc: EditorPicksDocument): EditorPicksIssue[] {
  const issues: EditorPicksIssue[] = [];
  if (doc.picks.length > MAX_PICKS) {
    issues.push({
      pickId: null,
      code: "too_many_picks",
      message: `At most ${MAX_PICKS} picks — the band renders 4; a longer queue is a backlog, not a selection.`,
    });
  }
  const ids = doc.picks.map((pick) => pick.id);
  if (
    doc.order.length !== ids.length ||
    [...doc.order].sort().join("|") !== [...ids].sort().join("|")
  ) {
    issues.push({
      pickId: null,
      code: "order_mismatch",
      message: "The order list must contain exactly the pick ids.",
    });
  }
  const seenFixtures = new Set<number>();
  for (const pick of doc.picks) {
    if (seenFixtures.has(pick.matchId)) {
      issues.push({
        pickId: pick.id,
        code: "duplicate_fixture",
        message: "One pick per fixture.",
      });
    }
    seenFixtures.add(pick.matchId);

    const sentence = pick.sentence.trim();
    if (!sentence) {
      issues.push({
        pickId: pick.id,
        code: "sentence_empty",
        message: "A pick without a sentence has nothing to say on the card.",
      });
    }
    if (sentence.length > SENTENCE_MAX) {
      issues.push({
        pickId: pick.id,
        code: "sentence_too_long",
        message: `The sentence is ${sentence.length} chars — the cap is ${SENTENCE_MAX} (two lines, never clipped).`,
      });
    }
    if (pick.startsAt && pick.endsAt && Date.parse(pick.startsAt) >= Date.parse(pick.endsAt)) {
      issues.push({
        pickId: pick.id,
        code: "window_inverted",
        message: "The window closes before it opens.",
      });
    }
    for (const text of [sentence, pick.longNote ?? ""]) {
      for (const violation of findClaimViolations(text)) {
        issues.push({
          pickId: pick.id,
          code: "banned_claim",
          message: `Banned claim: "${violation.match}" — ${violation.reason}`,
          violation,
        });
      }
    }
  }
  return issues;
}

/** The picks a reader may see right now, in admin order. */
export function activeManualPicks(
  doc: EditorPicksDocument,
  now: number
): EditorPickRecord[] {
  const byId = new Map(doc.picks.map((pick) => [pick.id, pick]));
  return doc.order
    .map((id) => byId.get(id))
    .filter((pick): pick is EditorPickRecord => {
      if (!pick) return false;
      if (pick.startsAt && Date.parse(pick.startsAt) > now) return false;
      if (pick.endsAt && Date.parse(pick.endsAt) <= now) return false;
      return true;
    });
}
