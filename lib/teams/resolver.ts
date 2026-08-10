import type { TeamEntity } from "./types";

const SUFFIX_RE =
  /\b(fc|afc|cf|sc|ac|as|ss|sd|cd|ud|rcd|fk|sk|nk|bk|if|ff|sv|vfl|vfb|tsv|sc)\b/gi;

export function normalizeTeamName(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(SUFFIX_RE, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugifyTeamName(input: string): string {
  return normalizeTeamName(input).replace(/\s+/g, "-");
}

export type TeamResolveInput = {
  name?: string | null;
  providerIds?: {
    footyStats?: number | string | null;
    apiFootball?: number | string | null;
  };
  competitionSlug?: string | null;
};

export type TeamResolveResult =
  | { status: "matched"; team: TeamEntity; method: "provider" | "exact" | "alias" | "fuzzy" }
  | { status: "ambiguous"; candidates: TeamEntity[] }
  | { status: "unmatched" };

function providerMatch(
  teams: readonly TeamEntity[],
  providerIds: TeamResolveInput["providerIds"]
): TeamEntity | undefined {
  if (!providerIds) return undefined;
  const fs = providerIds.footyStats;
  const af = providerIds.apiFootball;
  if (fs != null && fs !== "") {
    const hit = teams.find((team) => String(team.providerIds?.footyStats) === String(fs));
    if (hit) return hit;
  }
  if (af != null && af !== "") {
    const hit = teams.find((team) => String(team.providerIds?.apiFootball) === String(af));
    if (hit) return hit;
  }
  return undefined;
}

/*
 * THE WRONG-TEAM BUG — the fuzzy tier used raw bidirectional substring tests, so a
 * SHORT alias could hide inside an unrelated name: "molde ii" contains "ol" (inside
 * "m-ol-de"), Lyon's alias, and a live fixture's "Molde II" link landed on /teams/lyon.
 * Fuzzy now matches on WHOLE TOKENS only, and never across an identity-bearing token:
 * "Molde II" is a different team from "Molde" — a reserve side must not inherit the
 * first team's page, in either direction.
 */
const IDENTITY_TOKENS = new Set([
  "ii", "iii", "iv", "b", "2", "u17", "u18", "u19", "u20", "u21", "u23",
  "w", "women", "reserve", "reserves", "amateure", "academy", "youth",
]);

function fuzzyTokenMatch(a: string, b: string): boolean {
  const ta = a.split(" ").filter(Boolean);
  const tb = b.split(" ").filter(Boolean);
  if (!ta.length || !tb.length) return false;
  const [shorter, longer] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  // every token of the shorter name must appear as a whole token of the longer —
  // no substring bleed ("ol" never lives inside "molde").
  if (!shorter.every((token) => longer.includes(token))) return false;
  // the longer name must not carry an identity token the shorter lacks:
  // "molde ii" ⊅ "molde" as the same club.
  const shortSet = new Set(shorter);
  if (longer.some((token) => IDENTITY_TOKENS.has(token) && !shortSet.has(token))) return false;
  // a single very short token ("ol", "om") is not evidence of identity on its own.
  if (shorter.length === 1 && shorter[0].length < 4) return false;
  return true;
}

/**
 * Resolve a team from provider IDs, exact/alias names, or competition-scoped fuzzy match.
 * Ambiguous fuzzy hits are never silently accepted.
 */
export function resolveTeam(
  teams: readonly TeamEntity[],
  input: TeamResolveInput
): TeamResolveResult {
  const byProvider = providerMatch(teams, input.providerIds);
  if (byProvider) return { status: "matched", team: byProvider, method: "provider" };

  const raw = input.name?.trim();
  if (!raw) return { status: "unmatched" };
  const normalized = normalizeTeamName(raw);
  if (!normalized) return { status: "unmatched" };

  const exact = teams.filter(
    (team) =>
      normalizeTeamName(team.name) === normalized ||
      (team.shortName && normalizeTeamName(team.shortName) === normalized)
  );
  if (exact.length === 1) return { status: "matched", team: exact[0], method: "exact" };
  if (exact.length > 1) return { status: "ambiguous", candidates: exact };

  const aliasHits = teams.filter((team) =>
    (team.aliases ?? []).some((alias) => normalizeTeamName(alias) === normalized)
  );
  if (aliasHits.length === 1) return { status: "matched", team: aliasHits[0], method: "alias" };
  if (aliasHits.length > 1) return { status: "ambiguous", candidates: aliasHits };

  const pool = input.competitionSlug
    ? teams.filter((team) => team.competitionSlugs.includes(input.competitionSlug!))
    : teams;

  const fuzzy = pool.filter((team) => {
    const names = [team.name, team.shortName, ...(team.aliases ?? [])].filter(Boolean) as string[];
    return names.some((name) => fuzzyTokenMatch(normalizeTeamName(name), normalized));
  });

  if (fuzzy.length === 1) return { status: "matched", team: fuzzy[0], method: "fuzzy" };
  if (fuzzy.length > 1) return { status: "ambiguous", candidates: fuzzy };
  return { status: "unmatched" };
}
