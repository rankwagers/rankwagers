import { listCompetitions } from "@/lib/competitions/registry";
import { listMarkets, marketSlugForListKind } from "@/lib/markets/registry";
import { listOperators } from "@/lib/operators/registry";
import { COUNTRY_PROFILES, DEFAULT_COUNTRY_CODE } from "@/lib/personalization/countries";
import { listSeasons } from "@/lib/seasons/registry";
import { listTeams } from "@/lib/teams/registry";
import { entityId, type GraphEdge, type GraphEntity } from "./entity";
import { edge } from "./relationships";

export type GraphSnapshot = {
  entities: GraphEntity[];
  edges: GraphEdge[];
};

function ensureCountryEntity(
  entities: GraphEntity[],
  code: string,
  description?: string
): void {
  const id = entityId("country", code);
  if (entities.some((entity) => entity.id === id)) return;
  entities.push({
    id,
    type: "country",
    slug: code,
    title: code,
    path: `/countries/${code.toLowerCase()}`,
    description: description ?? `Country research hub (${code}).`,
  });
}

function hubEntities(): GraphEntity[] {
  return [
    {
      id: entityId("evidence", "methodology"),
      type: "evidence",
      slug: "methodology",
      title: "Evidence & methodology",
      path: "/methodology",
      description: "Research methodology and evidence standards.",
    },
    {
      id: entityId("evidence", "prediction-archive"),
      type: "evidence",
      slug: "prediction-archive",
      title: "Prediction archive",
      path: "/archive",
      description: "Transparent settled prediction history.",
    },
    {
      id: entityId("odds", "intelligence"),
      type: "odds",
      slug: "intelligence",
      title: "Odds intelligence",
      path: "/#fixtures",
      description: "Observed odds history and CLV research surfaces.",
    },
    {
      id: entityId("fixture", "research-queue"),
      type: "fixture",
      slug: "research-queue",
      title: "Qualified fixtures",
      path: "/#fixtures",
      description: "Daily qualified fixture research queue.",
    },
  ];
}

/**
 * Build the factual knowledge graph from existing registries.
 * UI-independent; safe to call from server or tests.
 */
export function buildKnowledgeGraph(): GraphSnapshot {
  const entities: GraphEntity[] = [...hubEntities()];
  const edges: GraphEdge[] = [];

  const evidenceId = entityId("evidence", "methodology");
  const oddsId = entityId("odds", "intelligence");
  const fixturesId = entityId("fixture", "research-queue");

  for (const competition of listCompetitions()) {
    const id = entityId("competition", competition.slug);
    entities.push({
      id,
      type: "competition",
      slug: competition.slug,
      title: competition.name,
      path: `/competitions/${competition.slug}`,
      description: competition.description,
    });

    edges.push(edge(id, fixturesId, "hosts"));
    edges.push(edge(id, evidenceId, "evidenced_by"));
    edges.push(edge(id, oddsId, "priced_by"));

    if (competition.country) {
      const countryKey = competition.country.toUpperCase();
      ensureCountryEntity(entities, countryKey);
      edges.push(edge(id, entityId("country", countryKey), "available_in"));
    }

    for (const marketSlug of competition.relatedMarketSlugs) {
      edges.push(edge(id, entityId("market", marketSlug), "has_market"));
    }
    for (const operatorSlug of competition.relatedOperatorSlugs) {
      edges.push(edge(id, entityId("operator", operatorSlug), "supported_by"));
    }
    for (const related of competition.relatedCompetitionSlugs) {
      edges.push(edge(id, entityId("competition", related), "related"));
    }
  }

  for (const season of listSeasons()) {
    const id = entityId("season", season.id);
    entities.push({
      id,
      type: "season",
      slug: season.id,
      title: season.displayName,
      path: `/competitions/${season.competitionSlug}/seasons/${season.slug}`,
      description: `Season research entity for ${season.displayName}.`,
    });
    edges.push(edge(id, entityId("competition", season.competitionSlug), "part_of"));
    edges.push(edge(entityId("competition", season.competitionSlug), id, "hosts"));
    edges.push(edge(id, fixturesId, "hosts"));
    edges.push(edge(id, evidenceId, "evidenced_by"));
    edges.push(edge(id, oddsId, "priced_by"));

    if (season.countryCode) {
      const countryKey = season.countryCode.toUpperCase();
      ensureCountryEntity(entities, countryKey);
      edges.push(edge(id, entityId("country", countryKey), "available_in"));
    }

    const competition = listCompetitions().find(
      (row) => row.slug === season.competitionSlug
    );
    if (competition) {
      for (const marketSlug of competition.relatedMarketSlugs) {
        edges.push(edge(id, entityId("market", marketSlug), "has_market"));
      }
      for (const operatorSlug of competition.relatedOperatorSlugs) {
        edges.push(edge(id, entityId("operator", operatorSlug), "supported_by"));
      }
    }

    for (const team of listTeams().filter((row) =>
      row.competitionSlugs.includes(season.competitionSlug)
    )) {
      edges.push(edge(id, entityId("team", team.slug), "related"));
    }
  }

  for (const market of listMarkets()) {
    const id = entityId("market", market.slug);
    entities.push({
      id,
      type: "market",
      slug: market.slug,
      title: market.name,
      path: `/markets/${market.slug}`,
      description: market.shortDescription,
    });
    edges.push(edge(id, fixturesId, "hosts"));
    edges.push(edge(id, evidenceId, "evidenced_by"));
    edges.push(edge(id, oddsId, "priced_by"));

    for (const related of market.relatedMarketSlugs) {
      edges.push(edge(id, entityId("market", related), "related"));
    }
    for (const league of market.relatedLeagues) {
      const competition = listCompetitions().find((row) =>
        row.aliases.some((alias) =>
          league.toLowerCase().includes(alias.toLowerCase()) ||
          alias.toLowerCase().includes(league.toLowerCase())
        )
      );
      if (competition) {
        edges.push(edge(id, entityId("competition", competition.slug), "part_of"));
      }
    }
  }

  for (const operator of listOperators()) {
    const id = entityId("operator", operator.slug);
    entities.push({
      id,
      type: "operator",
      slug: operator.slug,
      title: operator.name,
      path: `/operators/${operator.slug}`,
      description: operator.description,
    });
    edges.push(edge(id, evidenceId, "evidenced_by"));
    edges.push(edge(id, oddsId, "priced_by"));
    edges.push(edge(id, fixturesId, "hosts"));

    for (const marketKey of operator.supportedMarkets) {
      const marketSlug = marketSlugForListKind(marketKey);
      if (marketSlug) edges.push(edge(id, entityId("market", marketSlug), "has_market"));
    }
    for (const country of operator.supportedCountries) {
      const countryKey = country.toUpperCase();
      ensureCountryEntity(entities, countryKey);
      edges.push(edge(id, entityId("country", countryKey), "available_in"));
    }
  }

  for (const code of Object.keys(COUNTRY_PROFILES)) {
    const profile = COUNTRY_PROFILES[code];
    ensureCountryEntity(entities, code, `Country personalization profile (${profile.currency}).`);
    const id = entityId("country", code);
    for (const partner of profile.supportedPartners) {
      edges.push(edge(id, entityId("operator", partner), "supported_by"));
    }
    for (const league of profile.topLeagues) {
      const competition = listCompetitions().find((row) =>
        row.aliases.some((alias) =>
          league.toLowerCase().includes(alias.toLowerCase()) ||
          alias.toLowerCase().includes(league.toLowerCase())
        )
      );
      if (competition) {
        edges.push(edge(id, entityId("competition", competition.slug), "related"));
      }
    }
  }

  ensureCountryEntity(entities, DEFAULT_COUNTRY_CODE);

  for (const team of listTeams()) {
    const id = entityId("team", team.slug);
    entities.push({
      id,
      type: "team",
      slug: team.slug,
      title: team.name,
      path: `/teams/${team.slug}`,
      description: `${team.name} research entity on RankWagers.`,
    });
    edges.push(edge(id, fixturesId, "hosts"));
    edges.push(edge(id, evidenceId, "evidenced_by"));
    edges.push(edge(id, oddsId, "priced_by"));

    if (team.countryCode) {
      const countryKey = team.countryCode.toUpperCase();
      ensureCountryEntity(entities, countryKey);
      edges.push(edge(id, entityId("country", countryKey), "available_in"));
    }

    for (const competitionSlug of team.competitionSlugs) {
      edges.push(edge(id, entityId("competition", competitionSlug), "part_of"));
    }
    for (const marketSlug of team.relatedMarketSlugs) {
      edges.push(edge(id, entityId("market", marketSlug), "has_market"));
    }
    for (const operatorSlug of team.relatedOperatorSlugs) {
      edges.push(edge(id, entityId("operator", operatorSlug), "supported_by"));
    }
    for (const relatedSlug of team.relatedTeamSlugs) {
      edges.push(edge(id, entityId("team", relatedSlug), "related"));
    }
  }

  // Deduplicate entities by id.
  const entityMap = new Map(entities.map((entity) => [entity.id, entity]));
  // Drop edges that point to missing entities (except we keep all we created).
  const entityIds = new Set(entityMap.keys());
  const filteredEdges = edges.filter(
    (item) => entityIds.has(item.from) && entityIds.has(item.to)
  );

  return {
    entities: [...entityMap.values()],
    edges: filteredEdges,
  };
}
