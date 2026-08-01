import type { AccaRecord } from "./contracts";
import { accaFreshness, type AccaFreshness } from "./freshness";
import { ABSENT, displayOdds, isoUtc, textOrAbsent } from "./presentation";
import { publicAccaCanonicalUrl, publicAccaPath } from "./paths";

/**
 * The public projection of a published Acca (Sprint 24).
 *
 * THIS MODULE IS THE PUBLIC/PRIVATE FIELD BOUNDARY.
 *
 * `lib/acca-publication/public.ts` decides WHICH records a reader may see. This decides WHICH
 * FIELDS of a visible record a reader may see. The two are separate concerns and were previously
 * only the first: every public component took an `AccaRecord` directly, which meant the guarantee
 * that internal identifiers stay off a public page rested on each component remembering not to
 * render them.
 *
 * Projection is EXPLICIT and field-by-field. The record is never spread, so a field added to
 * `AccaRecord` in a later sprint cannot appear on a public page by default — it appears only if
 * someone deliberately projects it here and decides it is publishable.
 *
 * WHAT IS DELIBERATELY DROPPED, and why:
 *
 *   accaId, sourceCandidateId   internal storage identifiers; the slug is the public identity
 *   sourceReferences            candidate id, request id, snapshot id, payload checksum — the
 *                               provenance chain is real but it is operational, not editorial
 *   version, updatedAt          lifecycle bookkeeping
 *   createdBy/publishedBy/…     always the coarse "admin"; publishing it would imply attribution
 *                               to a person that does not exist
 *   status                      replaced by the derived availability state, which is what a
 *                               reader actually needs; DRAFT and ARCHIVED never reach here anyway
 *
 * NOTHING IS INVENTED. Every value below is copied from the immutable snapshot or derived from it
 * plus the caller's clock. Where the snapshot is silent, the projection says so explicitly rather
 * than substituting a plausible default.
 */

/* ------------------------------------------------------------------ *
 * The boundary, declared as data so a test can assert it mechanically
 * ------------------------------------------------------------------ */

/** Record fields that must never appear in a public projection or in public markup. */
export const PUBLIC_ACCA_REDACTED_FIELDS: readonly (keyof AccaRecord)[] = [
  "accaId",
  "sourceCandidateId",
  "sourceReferences",
  "version",
  "createdBy",
  "publishedBy",
  "archivedBy",
  "updatedAt",
  "archivedAt",
  "schemaVersion",
  "status",
];

/* ------------------------------------------------------------------ *
 * Evidence strength
 * ------------------------------------------------------------------ */

/**
 * How much explanatory material a single selection actually carries.
 *
 * Three honest buckets, not a score. A numeric "evidence strength out of 10" would be a
 * manufactured precision: the underlying record carries a list of lines and an optional
 * completeness figure, and nothing that supports ranking one selection's evidence against
 * another's.
 */
export type AccaEvidenceStrength = "RECORDED" | "PARTIAL" | "NOT_RECORDED";

export function legEvidenceStrength(leg: {
  evidenceSummary?: string[];
  evidenceCompleteness?: number;
  confidence?: number;
}): AccaEvidenceStrength {
  if ((leg.evidenceSummary?.length ?? 0) > 0) return "RECORDED";
  if (
    typeof leg.evidenceCompleteness === "number" ||
    typeof leg.confidence === "number"
  ) {
    return "PARTIAL";
  }
  return "NOT_RECORDED";
}

export function evidenceStrengthLabel(strength: AccaEvidenceStrength): {
  label: string;
  detail: string;
} {
  switch (strength) {
    case "RECORDED":
      return {
        label: "Reasons recorded",
        detail: "The Builder recorded written reasons for this selection at generation time.",
      };
    case "PARTIAL":
      return {
        label: "Signals only",
        detail:
          "No written reasons were recorded for this selection — only a model confidence or completeness figure.",
      };
    case "NOT_RECORDED":
    default:
      return {
        label: "Nothing recorded",
        detail:
          "No reasons, confidence or completeness figure were recorded for this selection. That is a gap in the record, not a judgement about the selection.",
      };
  }
}

/* ------------------------------------------------------------------ *
 * Odds band
 * ------------------------------------------------------------------ */

/**
 * Coarse bucket for the calculated combined price.
 *
 * NOTE ON NAMING. This is `oddsBand`, not `targetOddsBand`. The Builder's target odds range is
 * generation configuration and is NOT copied onto the published snapshot, so a field called
 * "target" would assert something no stored record supports. This band is derived from the price
 * the server calculated and published, which is a fact.
 */
export type AccaOddsBand = "under_3" | "3_to_6" | "6_to_12" | "12_to_25" | "25_plus" | "unknown";

export function accaOddsBand(combinedOdds: number): AccaOddsBand {
  if (!Number.isFinite(combinedOdds) || combinedOdds <= 0) return "unknown";
  if (combinedOdds < 3) return "under_3";
  if (combinedOdds < 6) return "3_to_6";
  if (combinedOdds < 12) return "6_to_12";
  if (combinedOdds < 25) return "12_to_25";
  return "25_plus";
}

export function oddsBandLabel(band: AccaOddsBand): string {
  switch (band) {
    case "under_3":
      return "Under 3.00";
    case "3_to_6":
      return "3.00 to 6.00";
    case "6_to_12":
      return "6.00 to 12.00";
    case "12_to_25":
      return "12.00 to 25.00";
    case "25_plus":
      return "25.00 and above";
    case "unknown":
    default:
      return ABSENT.unknown;
  }
}

/* ------------------------------------------------------------------ *
 * Projection
 * ------------------------------------------------------------------ */

export type PublicAccaLegView = {
  /** 1-based position in the published order. Never re-sorted. */
  position: number;
  homeTeam: string;
  awayTeam: string;
  /** "Home v Away", pre-composed so every surface renders the fixture identically. */
  fixture: string;
  competition: string;
  kickoffAt: { display: string; machine: string | null };
  /** True when this fixture had kicked off at the caller's `now`. */
  started: boolean;
  marketKey: string;
  market: string;
  selection: string;
  capturedOdds: string;
  /** Model confidence as recorded, or an explicit absence label. */
  confidence: string;
  evidenceStrength: AccaEvidenceStrength;
  /** Written reasons recorded for this selection. Empty when none were. */
  reasons: string[];
  /** Whether this selection passed the Builder's qualification gates. Always true by
   *  construction — an unqualified selection is never in a candidate combination. */
  qualified: boolean;
  /** Where the values above came from. */
  provenance: { capturedAt: string; basis: string };
};

export type PublicAccaView = {
  /** The public identity. The slug, never the storage id. */
  publicId: string;
  locale: string;
  title: string;
  summary: string | null;
  /** Builder risk mode carried on the snapshot, or null when none was recorded. */
  profile: string | null;
  legCount: number;
  combinedOdds: { value: number; display: string };
  oddsBand: AccaOddsBand;
  /** When the Builder produced the combination and the snapshot was taken. */
  generatedAt: { display: string; machine: string | null };
  publishedAt: { display: string; machine: string | null };
  freshness: AccaFreshness;
  evidence: {
    summary: string[];
    warnings: string[];
    completeness: number | null;
    averageConfidence: number | null;
    legsWithConfidence: number;
    legsWithReasons: number;
  };
  legs: PublicAccaLegView[];
  /** Version of the publication FORMAT — not of the generation methodology. */
  publicationFormatVersion: string;
  /** Locale-aware canonical path. Single source for links and the sitemap. */
  canonicalPath: string;
  /**
   * Absolute canonical URL.
   *
   * Projected server-side so a share control never has to build one — and, more importantly,
   * never reads `window.location`. A link shared from a page reached with a stray query string
   * or a tracking parameter still points at the canonical address.
   */
  shareUrl: string;
};

const PROVENANCE_BASIS =
  "Copied from the approved Builder candidate when this Acca was published. Never re-fetched.";

/**
 * Project a stored record into its public view.
 *
 * The caller supplies `now` because freshness depends on it; see `freshness.ts` for why no
 * default clock exists.
 */
export function toPublicAccaView(acca: AccaRecord, now: string | Date): PublicAccaView {
  const freshness = accaFreshness(acca, now);
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now);

  const legs: PublicAccaLegView[] = acca.legs.map((leg, index) => {
    const kickoffMs = Date.parse(leg.kickoffAt);
    return {
      position: index + 1,
      homeTeam: leg.homeTeam,
      awayTeam: leg.awayTeam,
      fixture: `${textOrAbsent(leg.homeTeam, ABSENT.unknown)} v ${textOrAbsent(leg.awayTeam, ABSENT.unknown)}`,
      competition: textOrAbsent(leg.competition),
      kickoffAt: isoUtc(leg.kickoffAt),
      started:
        Number.isFinite(kickoffMs) && Number.isFinite(nowMs) ? kickoffMs <= nowMs : false,
      marketKey: leg.marketKey,
      market:
        leg.marketLabel && leg.marketLabel.trim() !== ""
          ? leg.marketLabel
          : textOrAbsent(leg.marketKey, ABSENT.unknown),
      selection: textOrAbsent(leg.selectionLabel ?? leg.selectionKey),
      capturedOdds: displayOdds(leg.capturedOdds),
      confidence:
        typeof leg.confidence === "number" && Number.isFinite(leg.confidence)
          ? String(leg.confidence)
          : ABSENT.notProvided,
      evidenceStrength: legEvidenceStrength(leg),
      reasons: [...(leg.evidenceSummary ?? [])],
      qualified: true,
      provenance: { capturedAt: acca.createdAt, basis: PROVENANCE_BASIS },
    };
  });

  return {
    publicId: acca.slug,
    locale: acca.locale,
    title: acca.title,
    summary: acca.summary,
    profile: acca.qualificationSnapshot.riskMode ?? null,
    legCount: acca.legs.length,
    combinedOdds: { value: acca.combinedOdds, display: displayOdds(acca.combinedOdds) },
    oddsBand: accaOddsBand(acca.combinedOdds),
    generatedAt: isoUtc(acca.createdAt),
    publishedAt: isoUtc(acca.publishedAt),
    freshness,
    evidence: {
      summary: [...(acca.evidenceSnapshot.summary ?? [])],
      warnings: [...(acca.evidenceSnapshot.warnings ?? [])],
      completeness:
        typeof acca.evidenceSnapshot.completeness === "number"
          ? acca.evidenceSnapshot.completeness
          : null,
      averageConfidence:
        typeof acca.qualificationSnapshot.averageConfidence === "number"
          ? acca.qualificationSnapshot.averageConfidence
          : null,
      legsWithConfidence: acca.legs.filter((leg) => typeof leg.confidence === "number").length,
      legsWithReasons: acca.legs.filter((leg) => (leg.evidenceSummary?.length ?? 0) > 0).length,
    },
    legs,
    publicationFormatVersion: acca.schemaVersion,
    canonicalPath: publicAccaPath(acca.locale, acca.slug),
    shareUrl: publicAccaCanonicalUrl(acca.locale, acca.slug),
  };
}

/** Distinct competitions in published order, for the index facet and for summaries. */
export function competitionsIn(view: PublicAccaView): string[] {
  const seen: string[] = [];
  for (const leg of view.legs) {
    if (leg.competition && !seen.includes(leg.competition)) seen.push(leg.competition);
  }
  return seen;
}
