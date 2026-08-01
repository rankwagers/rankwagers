import type { CompetitionDefinition } from "./types";

const COMPETITIONS: CompetitionDefinition[] = [
  {
    id: "premier-league",
    slug: "premier-league",
    name: "Premier League",
    country: "GB",
    confederation: "Domestic",
    logo: null,
    season: "2025/26",
    description:
      "England's top division. RankWagers connects Premier League fixtures that clear published market qualification thresholds with evidence, operators, and observed odds.",
    aliases: ["premier league", "english premier league", "epl"],
    relatedMarketSlugs: ["over-2-5", "over-1-5", "btts", "first-half-goals"],
    relatedOperatorSlugs: ["1xbet", "melbet", "bet-and-you"],
    relatedCompetitionSlugs: ["champions-league", "la-liga", "serie-a"],
    relatedTeamHints: ["Arsenal", "Manchester City", "Liverpool", "Chelsea"],
  },
  {
    id: "la-liga",
    slug: "la-liga",
    name: "La Liga",
    country: "ES",
    confederation: "Domestic",
    logo: null,
    season: "2025/26",
    description:
      "Spain's top flight. This intelligence hub lists qualified research fixtures and related markets without tips or editorial rankings.",
    aliases: ["la liga", "laliga", "primera division", "spanish la liga"],
    relatedMarketSlugs: ["over-2-5", "btts", "over-1-5"],
    relatedOperatorSlugs: ["1xbet", "bet-and-you", "melbet"],
    relatedCompetitionSlugs: ["premier-league", "champions-league", "serie-a"],
    relatedTeamHints: ["Real Madrid", "Barcelona", "Atletico Madrid"],
  },
  {
    id: "serie-a",
    slug: "serie-a",
    name: "Serie A",
    country: "IT",
    confederation: "Domestic",
    logo: null,
    season: "2025/26",
    description:
      "Italy's top division research hub on RankWagers — fixtures, markets, and operator coverage from verified research queues.",
    aliases: ["serie a", "italian serie a"],
    relatedMarketSlugs: ["over-2-5", "over-1-5", "first-half-goals"],
    relatedOperatorSlugs: ["1xbet", "melbet", "betwinner"],
    relatedCompetitionSlugs: ["premier-league", "la-liga", "champions-league"],
    relatedTeamHints: ["Inter", "Juventus", "AC Milan", "Napoli"],
  },
  {
    id: "bundesliga",
    slug: "bundesliga",
    name: "Bundesliga",
    country: "DE",
    confederation: "Domestic",
    logo: null,
    season: "2025/26",
    description:
      "Germany's Bundesliga intelligence page for qualified totals and half markets, with links to operators and odds history.",
    aliases: ["bundesliga", "german bundesliga"],
    relatedMarketSlugs: ["over-2-5", "over-1-5", "btts"],
    relatedOperatorSlugs: ["1xbet", "bet-and-you", "888starz"],
    relatedCompetitionSlugs: ["champions-league", "premier-league", "eredivisie"],
    relatedTeamHints: ["Bayern Munich", "Borussia Dortmund", "RB Leipzig"],
  },
  {
    id: "ligue-1",
    slug: "ligue-1",
    name: "Ligue 1",
    country: "FR",
    confederation: "Domestic",
    logo: null,
    season: "2025/26",
    description:
      "French Ligue 1 research connections: qualified fixtures, popular markets, and country-aware operator availability.",
    aliases: ["ligue 1", "ligue1", "french ligue 1"],
    relatedMarketSlugs: ["over-2-5", "over-1-5", "btts"],
    relatedOperatorSlugs: ["1xbet", "melbet", "bet-and-you"],
    relatedCompetitionSlugs: ["premier-league", "champions-league", "la-liga"],
    relatedTeamHints: ["Paris Saint-Germain", "Marseille", "Lyon"],
  },
  {
    id: "champions-league",
    slug: "champions-league",
    name: "UEFA Champions League",
    country: null,
    confederation: "UEFA",
    logo: null,
    season: "2025/26",
    description:
      "Europe's premier club competition. RankWagers surfaces Champions League fixtures that qualify for tracked markets and links evidence and odds without predictions.",
    aliases: ["champions league", "uefa champions league", "ucl"],
    relatedMarketSlugs: ["over-2-5", "btts", "asian-handicap", "first-half-goals"],
    relatedOperatorSlugs: ["1xbet", "bet-and-you", "melbet", "betwinner"],
    relatedCompetitionSlugs: ["premier-league", "la-liga", "europa-league"],
    relatedTeamHints: ["Real Madrid", "Manchester City", "Bayern Munich"],
  },
  {
    id: "europa-league",
    slug: "europa-league",
    name: "UEFA Europa League",
    country: null,
    confederation: "UEFA",
    logo: null,
    season: "2025/26",
    description:
      "UEFA Europa League intelligence hub connecting qualified fixtures to markets and operators.",
    aliases: ["europa league", "uefa europa league", "uel"],
    relatedMarketSlugs: ["over-2-5", "over-1-5", "btts"],
    relatedOperatorSlugs: ["1xbet", "melbet", "megapari"],
    relatedCompetitionSlugs: ["champions-league", "premier-league", "serie-a"],
    relatedTeamHints: ["Roma", "Tottenham", "Sevilla"],
  },
  {
    id: "libertadores",
    slug: "libertadores",
    name: "Copa Libertadores",
    country: null,
    confederation: "CONMEBOL",
    logo: null,
    season: "2026",
    description:
      "CONMEBOL Libertadores research page for qualified fixtures and related South American market coverage.",
    aliases: ["libertadores", "copa libertadores", "conmebol libertadores"],
    relatedMarketSlugs: ["over-2-5", "btts", "over-1-5"],
    relatedOperatorSlugs: ["1xbet", "melbet", "betwinner"],
    relatedCompetitionSlugs: ["brasileirao", "premier-league", "champions-league"],
    relatedTeamHints: ["Flamengo", "Palmeiras", "River Plate", "Boca Juniors"],
  },
  {
    id: "brasileirao",
    slug: "brasileirao",
    name: "Brasileirão",
    country: "BR",
    confederation: "Domestic",
    logo: null,
    season: "2026",
    description:
      "Brazil's top division intelligence hub. Country personalization and operator availability apply for BR visitors.",
    aliases: ["brasileirao", "brasileirão", "serie a brazil", "brazilian serie a"],
    relatedMarketSlugs: ["over-2-5", "btts", "over-1-5"],
    relatedOperatorSlugs: ["1xbet", "melbet", "bet-and-you"],
    relatedCompetitionSlugs: ["libertadores", "premier-league", "champions-league"],
    relatedTeamHints: ["Flamengo", "Palmeiras", "Sao Paulo", "Corinthians"],
  },
  {
    id: "eredivisie",
    slug: "eredivisie",
    name: "Eredivisie",
    country: "NL",
    confederation: "Domestic",
    logo: null,
    season: "2025/26",
    description:
      "Dutch Eredivisie research connections for high-scoring market environments when fixtures qualify.",
    aliases: ["eredivisie", "dutch eredivisie"],
    relatedMarketSlugs: ["over-2-5", "over-1-5", "btts"],
    relatedOperatorSlugs: ["1xbet", "melbet", "bet-and-you"],
    relatedCompetitionSlugs: ["bundesliga", "champions-league", "premier-league"],
    relatedTeamHints: ["Ajax", "PSV", "Feyenoord"],
  },
  {
    id: "mls",
    slug: "mls",
    name: "Major League Soccer",
    country: "US",
    confederation: "CONCACAF",
    logo: null,
    season: "2026",
    description:
      "MLS competition intelligence for qualified fixtures and related totals markets on RankWagers.",
    aliases: ["major league soccer", "mls"],
    relatedMarketSlugs: ["over-2-5", "over-1-5", "btts"],
    relatedOperatorSlugs: ["1xbet", "bet-and-you", "melbet"],
    relatedCompetitionSlugs: ["premier-league", "liga-mx", "champions-league"],
    relatedTeamHints: ["Inter Miami", "LAFC", "Seattle Sounders"],
  },
  {
    id: "liga-mx",
    slug: "liga-mx",
    name: "Liga MX",
    country: "MX",
    confederation: "CONCACAF",
    logo: null,
    season: "2025/26",
    description:
      "Mexico's Liga MX research hub linking qualified fixtures, markets, and operators.",
    aliases: ["liga mx", "mexican liga mx"],
    relatedMarketSlugs: ["over-2-5", "btts", "over-1-5"],
    relatedOperatorSlugs: ["1xbet", "melbet", "betwinner"],
    relatedCompetitionSlugs: ["mls", "libertadores", "premier-league"],
    relatedTeamHints: ["Club America", "Chivas", "Tigres"],
  },
  {
    id: "npfl",
    slug: "npfl",
    name: "NPFL",
    country: "NG",
    confederation: "CAF",
    logo: null,
    season: "2025/26",
    description:
      "Nigeria Professional Football League intelligence page for research fixtures and regional operator coverage.",
    aliases: ["npfl", "nigeria professional football league", "nigerian premier league"],
    relatedMarketSlugs: ["over-1-5", "over-2-5", "first-half-goals"],
    relatedOperatorSlugs: ["1xbet", "melbet", "bet-and-you"],
    relatedCompetitionSlugs: ["premier-league", "champions-league", "brasileirao"],
    relatedTeamHints: ["Enyimba", "Rangers International", "Remo Stars"],
  },
  {
    id: "j-league",
    slug: "j-league",
    name: "J League",
    country: "JP",
    confederation: "AFC",
    logo: null,
    season: "2026",
    description:
      "Japan's J League research hub connecting qualified fixtures to markets and operators.",
    aliases: ["j league", "j1 league", "j.league", "j-league"],
    relatedMarketSlugs: ["over-2-5", "over-1-5", "btts"],
    relatedOperatorSlugs: ["1xbet", "bet-and-you", "melbet"],
    relatedCompetitionSlugs: ["premier-league", "champions-league", "mls"],
    relatedTeamHints: ["Kawasaki Frontale", "Yokohama F. Marinos", "Vissel Kobe"],
  },
];

const bySlug = new Map(COMPETITIONS.map((row) => [row.slug, row]));

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function listCompetitions(): CompetitionDefinition[] {
  return [...COMPETITIONS];
}

export function getCompetition(slug: string): CompetitionDefinition | undefined {
  return bySlug.get(slug);
}

export function competitionSlugs(): string[] {
  return COMPETITIONS.map((row) => row.slug);
}

export function getRelatedCompetitions(slug: string): CompetitionDefinition[] {
  const competition = getCompetition(slug);
  if (!competition) return [];
  return competition.relatedCompetitionSlugs
    .map((related) => getCompetition(related))
    .filter((related): related is CompetitionDefinition => Boolean(related));
}

export function competitionMatchesLeague(
  competition: CompetitionDefinition,
  leagueName: string
): boolean {
  const haystack = normalize(leagueName);
  return competition.aliases.some((alias) => haystack.includes(normalize(alias)));
}

export function findCompetitionForLeague(leagueName: string): CompetitionDefinition | undefined {
  return COMPETITIONS.find((competition) => competitionMatchesLeague(competition, leagueName));
}
