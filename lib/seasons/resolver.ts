import type { SeasonEntity } from "./types";

export function yearLabelToSlug(yearLabel: string): string {
  return yearLabel.trim().replace(/\//g, "-").replace(/\s+/g, "-").toLowerCase();
}

export function seasonEntityId(competitionSlug: string, seasonSlug: string): string {
  return `${competitionSlug}-${seasonSlug}`;
}

export type SeasonResolveInput = {
  providerSeasonId?: string | number | null;
  competitionSlug?: string | null;
  seasonSlug?: string | null;
  yearLabel?: string | null;
  activeOnly?: boolean;
};

export type SeasonResolveResult =
  | { status: "matched"; season: SeasonEntity; method: "provider" | "slug" | "active" }
  | { status: "ambiguous"; candidates: SeasonEntity[] }
  | { status: "unmatched" };

/**
 * Resolve a season. Ambiguous matches are never silently accepted.
 */
export function resolveSeason(
  seasons: readonly SeasonEntity[],
  input: SeasonResolveInput
): SeasonResolveResult {
  const pool = input.activeOnly === false ? seasons : seasons.filter((row) => row.active);

  if (input.providerSeasonId != null && input.providerSeasonId !== "") {
    const hits = pool.filter(
      (row) => String(row.providerSeasonId) === String(input.providerSeasonId)
    );
    if (hits.length === 1) return { status: "matched", season: hits[0], method: "provider" };
    if (hits.length > 1) return { status: "ambiguous", candidates: hits };
  }

  if (input.competitionSlug && input.seasonSlug) {
    const slug = yearLabelToSlug(input.seasonSlug);
    const hits = pool.filter(
      (row) => row.competitionSlug === input.competitionSlug && row.slug === slug
    );
    if (hits.length === 1) return { status: "matched", season: hits[0], method: "slug" };
    if (hits.length > 1) return { status: "ambiguous", candidates: hits };
  }

  if (input.competitionSlug && input.yearLabel) {
    const slug = yearLabelToSlug(input.yearLabel);
    const hits = pool.filter(
      (row) => row.competitionSlug === input.competitionSlug && row.slug === slug
    );
    if (hits.length === 1) return { status: "matched", season: hits[0], method: "slug" };
    if (hits.length > 1) return { status: "ambiguous", candidates: hits };
  }

  if (input.competitionSlug && !input.seasonSlug && !input.yearLabel) {
    const hits = pool.filter((row) => row.competitionSlug === input.competitionSlug && row.active);
    if (hits.length === 1) return { status: "matched", season: hits[0], method: "active" };
    if (hits.length > 1) return { status: "ambiguous", candidates: hits };
  }

  return { status: "unmatched" };
}

/** Approximate calendar bounds from year labels — not fabricated league results. */
export function seasonDateBounds(yearLabel: string): { startDate: string; endDate: string } {
  const slug = yearLabelToSlug(yearLabel);
  const split = slug.match(/^(\d{4})-(\d{2})$/);
  if (split) {
    const startYear = Number(split[1]);
    const endYearShort = Number(split[2]);
    const endYear = startYear - (startYear % 100) + endYearShort;
    return {
      startDate: `${startYear}-08-01`,
      endDate: `${endYear}-06-30`,
    };
  }
  const calendar = slug.match(/^(\d{4})$/);
  if (calendar) {
    return {
      startDate: `${calendar[1]}-01-01`,
      endDate: `${calendar[1]}-12-31`,
    };
  }
  const year = new Date().getUTCFullYear();
  return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
}
