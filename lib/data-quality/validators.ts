import { listCompetitions } from "@/lib/competitions/registry";
import { listMarkets } from "@/lib/markets/registry";
import { listOperators } from "@/lib/operators/registry";
import { COUNTRY_PROFILES } from "@/lib/personalization/countries";
import { listSeasons } from "@/lib/seasons/registry";
import { listTeams } from "@/lib/teams/registry";
import { normalizeTeamName } from "@/lib/teams/resolver";
import type { DataQualityFinding } from "./types";

function pass(
  category: DataQualityFinding["category"],
  id: string,
  message: string,
  entityType?: string,
  entityId?: string
): DataQualityFinding {
  return { id, category, severity: "pass", message, entityType, entityId };
}

function warn(
  category: DataQualityFinding["category"],
  id: string,
  message: string,
  entityType?: string,
  entityId?: string
): DataQualityFinding {
  return { id, category, severity: "warning", message, entityType, entityId };
}

function error(
  category: DataQualityFinding["category"],
  id: string,
  message: string,
  entityType?: string,
  entityId?: string
): DataQualityFinding {
  return { id, category, severity: "error", message, entityType, entityId };
}

export function validateCompetitions(): DataQualityFinding[] {
  const findings: DataQualityFinding[] = [];
  const slugs = new Set<string>();
  for (const competition of listCompetitions()) {
    if (!competition.slug || !competition.id || !competition.name) {
      findings.push(
        error("registry", `competition-fields-${competition.slug || "unknown"}`, "Competition missing canonical fields", "competition", competition.slug)
      );
      continue;
    }
    if (slugs.has(competition.slug)) {
      findings.push(
        error("registry", `competition-dupe-${competition.slug}`, "Duplicate competition slug", "competition", competition.slug)
      );
    }
    slugs.add(competition.slug);
    if (!competition.season) {
      findings.push(
        error("registry", `competition-season-${competition.slug}`, "Competition missing season label", "competition", competition.slug)
      );
    } else {
      findings.push(
        pass("registry", `competition-ok-${competition.slug}`, "Competition canonical fields valid", "competition", competition.slug)
      );
    }
    for (const marketSlug of competition.relatedMarketSlugs) {
      if (!listMarkets().some((market) => market.slug === marketSlug)) {
        findings.push(
          error("relationships", `competition-market-${competition.slug}-${marketSlug}`, `Unknown related market ${marketSlug}`, "competition", competition.slug)
        );
      }
    }
    for (const operatorSlug of competition.relatedOperatorSlugs) {
      if (!listOperators().some((operator) => operator.slug === operatorSlug)) {
        findings.push(
          error("relationships", `competition-operator-${competition.slug}-${operatorSlug}`, `Unknown related operator ${operatorSlug}`, "competition", competition.slug)
        );
      }
    }
  }
  return findings;
}

export function validateSeasons(): DataQualityFinding[] {
  const findings: DataQualityFinding[] = [];
  const ids = new Set<string>();
  for (const season of listSeasons()) {
    if (ids.has(season.id)) {
      findings.push(error("registry", `season-dupe-${season.id}`, "Duplicate season id", "season", season.id));
    }
    ids.add(season.id);
    if (!listCompetitions().some((row) => row.slug === season.competitionSlug)) {
      findings.push(
        error("relationships", `season-parent-${season.id}`, "Season references unknown competition", "season", season.id)
      );
    } else if (!season.slug || !season.yearLabel) {
      findings.push(error("registry", `season-fields-${season.id}`, "Season missing slug/yearLabel", "season", season.id));
    } else {
      findings.push(pass("registry", `season-ok-${season.id}`, "Season canonical fields valid", "season", season.id));
    }
  }
  return findings;
}

export function validateTeams(): DataQualityFinding[] {
  const findings: DataQualityFinding[] = [];
  const slugs = new Set<string>();
  const aliasMap = new Map<string, string>();

  for (const team of listTeams()) {
    if (slugs.has(team.slug)) {
      findings.push(error("registry", `team-dupe-${team.slug}`, "Duplicate team slug", "team", team.slug));
    }
    slugs.add(team.slug);

    if (!team.name || !team.competitionSlugs.length) {
      findings.push(error("registry", `team-fields-${team.slug}`, "Team missing name or competitions", "team", team.slug));
    } else {
      findings.push(pass("registry", `team-ok-${team.slug}`, "Team canonical fields valid", "team", team.slug));
    }

    for (const competitionSlug of team.competitionSlugs) {
      if (!listCompetitions().some((row) => row.slug === competitionSlug)) {
        findings.push(
          error("relationships", `team-comp-${team.slug}-${competitionSlug}`, `Team references unknown competition ${competitionSlug}`, "team", team.slug)
        );
      }
    }

    for (const alias of team.aliases ?? []) {
      const key = normalizeTeamName(alias);
      const existing = aliasMap.get(key);
      if (existing && existing !== team.slug) {
        findings.push(
          error("resolvers", `team-alias-${key}`, `Alias collision "${alias}" between ${existing} and ${team.slug}`, "team", team.slug)
        );
      } else {
        aliasMap.set(key, team.slug);
      }
    }

    if (team.providerIds?.footyStats != null || team.providerIds?.apiFootball != null) {
      findings.push(
        pass("provider", `team-provider-${team.slug}`, "Team has optional provider mapping", "team", team.slug)
      );
    }
  }
  return findings;
}

export function validateMarkets(): DataQualityFinding[] {
  const findings: DataQualityFinding[] = [];
  const slugs = new Set<string>();
  for (const market of listMarkets()) {
    if (slugs.has(market.slug)) {
      findings.push(error("registry", `market-dupe-${market.slug}`, "Duplicate market slug", "market", market.slug));
    }
    slugs.add(market.slug);
    if (!market.name || !market.seo?.titleTemplate || !market.seo?.description) {
      findings.push(error("seo", `market-seo-${market.slug}`, "Market missing SEO fields", "market", market.slug));
    } else {
      findings.push(pass("registry", `market-ok-${market.slug}`, "Market canonical fields valid", "market", market.slug));
      findings.push(pass("seo", `market-seo-ok-${market.slug}`, "Market SEO fields present", "market", market.slug));
    }
    for (const related of market.relatedMarketSlugs) {
      if (!listMarkets().some((row) => row.slug === related)) {
        findings.push(
          error("relationships", `market-related-${market.slug}-${related}`, `Unknown related market ${related}`, "market", market.slug)
        );
      }
    }
  }
  return findings;
}

export function validateOperators(): DataQualityFinding[] {
  const findings: DataQualityFinding[] = [];
  const slugs = new Set<string>();
  for (const operator of listOperators()) {
    if (slugs.has(operator.slug)) {
      findings.push(error("registry", `operator-dupe-${operator.slug}`, "Duplicate operator slug", "operator", operator.slug));
    }
    slugs.add(operator.slug);
    if (!operator.name) {
      findings.push(error("registry", `operator-name-${operator.slug}`, "Operator missing name", "operator", operator.slug));
    } else {
      findings.push(pass("registry", `operator-ok-${operator.slug}`, "Operator canonical fields valid", "operator", operator.slug));
    }
    if (!operator.affiliateEnabled) {
      findings.push(
        warn("coverage", `operator-affiliate-${operator.slug}`, "Operator affiliate disabled", "operator", operator.slug)
      );
    }
  }
  return findings;
}

export function validateCountries(): DataQualityFinding[] {
  const findings: DataQualityFinding[] = [];
  for (const code of Object.keys(COUNTRY_PROFILES)) {
    const profile = COUNTRY_PROFILES[code];
    if (!profile.supportedPartners.length || !profile.topLeagues.length) {
      findings.push(
        warn("coverage", `country-thin-${code}`, "Country profile has thin partner/league coverage", "country", code)
      );
    } else {
      findings.push(pass("registry", `country-ok-${code}`, "Country profile present", "country", code));
    }
    for (const partner of profile.supportedPartners) {
      if (!listOperators().some((operator) => operator.slug === partner)) {
        findings.push(
          error("provider", `country-partner-${code}-${partner}`, `Country maps unknown partner ${partner}`, "country", code)
        );
      }
    }
  }
  return findings;
}

export function validateAllEntities(): DataQualityFinding[] {
  return [
    ...validateCompetitions(),
    ...validateSeasons(),
    ...validateTeams(),
    ...validateMarkets(),
    ...validateOperators(),
    ...validateCountries(),
  ];
}
