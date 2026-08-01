import type { TeamEntity } from "./types";
import { resolveTeam, slugifyTeamName } from "./resolver";

type TeamSeed = Omit<TeamEntity, "id" | "active" | "relatedMarketSlugs" | "relatedOperatorSlugs" | "relatedTeamSlugs"> & {
  relatedMarketSlugs?: readonly string[];
  relatedOperatorSlugs?: readonly string[];
  relatedTeamSlugs?: readonly string[];
  active?: boolean;
};

const DEFAULT_MARKETS = ["over-2-5", "over-1-5", "btts", "first-half-goals"] as const;
const DEFAULT_OPERATORS = ["1xbet", "melbet", "bet-and-you"] as const;

function team(
  seed: TeamSeed
): TeamEntity {
  return {
    id: seed.slug,
    active: seed.active ?? true,
    relatedMarketSlugs: seed.relatedMarketSlugs ?? DEFAULT_MARKETS,
    relatedOperatorSlugs: seed.relatedOperatorSlugs ?? DEFAULT_OPERATORS,
    relatedTeamSlugs: seed.relatedTeamSlugs ?? [],
    ...seed,
  };
}

/**
 * Canonical team registry — seeded from supported competitions.
 * Provider IDs are optional internal mappings only.
 */
const TEAMS: TeamEntity[] = [
  // Premier League
  team({
    slug: "arsenal",
    name: "Arsenal",
    shortName: "Arsenal",
    countryCode: "GB",
    competitionSlugs: ["premier-league", "champions-league"],
    aliases: ["arsenal fc", "arsenal london"],
    relatedTeamSlugs: ["liverpool", "manchester-city", "chelsea"],
  }),
  team({
    slug: "liverpool",
    name: "Liverpool",
    countryCode: "GB",
    competitionSlugs: ["premier-league", "champions-league"],
    aliases: ["liverpool fc", "lfc"],
    relatedTeamSlugs: ["arsenal", "manchester-city", "chelsea"],
  }),
  team({
    slug: "manchester-city",
    name: "Manchester City",
    shortName: "Man City",
    countryCode: "GB",
    competitionSlugs: ["premier-league", "champions-league"],
    aliases: ["man city", "manchester city fc", "mcfc"],
    relatedTeamSlugs: ["arsenal", "liverpool", "chelsea"],
  }),
  team({
    slug: "chelsea",
    name: "Chelsea",
    countryCode: "GB",
    competitionSlugs: ["premier-league", "europa-league"],
    aliases: ["chelsea fc"],
    relatedTeamSlugs: ["arsenal", "liverpool", "manchester-city", "tottenham"],
  }),
  team({
    slug: "tottenham",
    name: "Tottenham Hotspur",
    shortName: "Tottenham",
    countryCode: "GB",
    competitionSlugs: ["premier-league", "europa-league"],
    aliases: ["tottenham", "spurs", "tottenham hotspur fc"],
    relatedTeamSlugs: ["chelsea", "arsenal"],
  }),
  // La Liga
  team({
    slug: "real-madrid",
    name: "Real Madrid",
    countryCode: "ES",
    competitionSlugs: ["la-liga", "champions-league"],
    aliases: ["real madrid cf", "madrid"],
    relatedTeamSlugs: ["barcelona", "atletico-madrid"],
  }),
  team({
    slug: "barcelona",
    name: "Barcelona",
    shortName: "Barça",
    countryCode: "ES",
    competitionSlugs: ["la-liga", "champions-league"],
    aliases: ["fc barcelona", "barca", "barça"],
    relatedTeamSlugs: ["real-madrid", "atletico-madrid"],
  }),
  team({
    slug: "atletico-madrid",
    name: "Atletico Madrid",
    shortName: "Atlético",
    countryCode: "ES",
    competitionSlugs: ["la-liga", "champions-league"],
    aliases: ["atlético madrid", "atletico", "club atletico de madrid"],
    relatedTeamSlugs: ["real-madrid", "barcelona"],
  }),
  // Serie A
  team({
    slug: "inter",
    name: "Inter",
    shortName: "Inter Milan",
    countryCode: "IT",
    competitionSlugs: ["serie-a", "champions-league"],
    aliases: ["inter milan", "internazionale", "fc internazionale"],
    relatedTeamSlugs: ["ac-milan", "juventus", "napoli"],
  }),
  team({
    slug: "juventus",
    name: "Juventus",
    countryCode: "IT",
    competitionSlugs: ["serie-a", "champions-league"],
    aliases: ["juventus fc", "juve"],
    relatedTeamSlugs: ["inter", "ac-milan", "napoli"],
  }),
  team({
    slug: "ac-milan",
    name: "AC Milan",
    shortName: "Milan",
    countryCode: "IT",
    competitionSlugs: ["serie-a", "champions-league"],
    aliases: ["milan", "a.c. milan"],
    relatedTeamSlugs: ["inter", "juventus"],
  }),
  team({
    slug: "napoli",
    name: "Napoli",
    countryCode: "IT",
    competitionSlugs: ["serie-a", "champions-league"],
    aliases: ["ssc napoli", "ssc napoli calcio"],
    relatedTeamSlugs: ["inter", "juventus", "roma"],
  }),
  team({
    slug: "roma",
    name: "Roma",
    countryCode: "IT",
    competitionSlugs: ["serie-a", "europa-league"],
    aliases: ["as roma", "a.s. roma"],
    relatedTeamSlugs: ["napoli", "juventus"],
  }),
  // Bundesliga
  team({
    slug: "bayern-munich",
    name: "Bayern Munich",
    shortName: "Bayern",
    countryCode: "DE",
    competitionSlugs: ["bundesliga", "champions-league"],
    aliases: ["fc bayern", "bayern munchen", "bayern münchen", "fc bayern munich"],
    relatedTeamSlugs: ["borussia-dortmund", "rb-leipzig"],
  }),
  team({
    slug: "borussia-dortmund",
    name: "Borussia Dortmund",
    shortName: "Dortmund",
    countryCode: "DE",
    competitionSlugs: ["bundesliga", "champions-league"],
    aliases: ["bvb", "dortmund"],
    relatedTeamSlugs: ["bayern-munich", "rb-leipzig"],
  }),
  team({
    slug: "rb-leipzig",
    name: "RB Leipzig",
    countryCode: "DE",
    competitionSlugs: ["bundesliga", "champions-league"],
    aliases: ["rasenballsport leipzig", "leipzig"],
    relatedTeamSlugs: ["bayern-munich", "borussia-dortmund"],
  }),
  // Ligue 1
  team({
    slug: "paris-saint-germain",
    name: "Paris Saint-Germain",
    shortName: "PSG",
    countryCode: "FR",
    competitionSlugs: ["ligue-1", "champions-league"],
    aliases: ["psg", "paris sg", "paris saint germain"],
    relatedTeamSlugs: ["marseille", "lyon"],
  }),
  team({
    slug: "marseille",
    name: "Marseille",
    countryCode: "FR",
    competitionSlugs: ["ligue-1", "europa-league"],
    aliases: ["olympique de marseille", "om", "olympique marseille"],
    relatedTeamSlugs: ["paris-saint-germain", "lyon"],
  }),
  team({
    slug: "lyon",
    name: "Lyon",
    countryCode: "FR",
    competitionSlugs: ["ligue-1"],
    aliases: ["olympique lyonnais", "ol"],
    relatedTeamSlugs: ["paris-saint-germain", "marseille"],
  }),
  // CONMEBOL / Brazil
  team({
    slug: "flamengo",
    name: "Flamengo",
    countryCode: "BR",
    competitionSlugs: ["brasileirao", "libertadores"],
    aliases: ["cr flamengo", "mengao", "clube de regatas do flamengo"],
    relatedTeamSlugs: ["palmeiras", "sao-paulo", "corinthians"],
    relatedOperatorSlugs: ["1xbet", "melbet", "bet-and-you", "betwinner"],
  }),
  team({
    slug: "palmeiras",
    name: "Palmeiras",
    countryCode: "BR",
    competitionSlugs: ["brasileirao", "libertadores"],
    aliases: ["se palmeiras", "sociedade esportiva palmeiras"],
    relatedTeamSlugs: ["flamengo", "sao-paulo", "corinthians"],
  }),
  team({
    slug: "sao-paulo",
    name: "Sao Paulo",
    shortName: "São Paulo",
    countryCode: "BR",
    competitionSlugs: ["brasileirao", "libertadores"],
    aliases: ["são paulo", "sao paulo fc", "spfc"],
    relatedTeamSlugs: ["flamengo", "palmeiras", "corinthians"],
  }),
  team({
    slug: "corinthians",
    name: "Corinthians",
    countryCode: "BR",
    competitionSlugs: ["brasileirao"],
    aliases: ["sc corinthians", "sport club corinthians paulista"],
    relatedTeamSlugs: ["flamengo", "palmeiras", "sao-paulo"],
  }),
  team({
    slug: "river-plate",
    name: "River Plate",
    countryCode: "AR",
    competitionSlugs: ["libertadores"],
    aliases: ["club atletico river plate", "river"],
    relatedTeamSlugs: ["boca-juniors", "flamengo"],
  }),
  team({
    slug: "boca-juniors",
    name: "Boca Juniors",
    countryCode: "AR",
    competitionSlugs: ["libertadores"],
    aliases: ["club atletico boca juniors", "boca"],
    relatedTeamSlugs: ["river-plate", "flamengo"],
  }),
  // Eredivisie
  team({
    slug: "ajax",
    name: "Ajax",
    countryCode: "NL",
    competitionSlugs: ["eredivisie", "champions-league"],
    aliases: ["afc ajax", "ajax amsterdam"],
    relatedTeamSlugs: ["psv", "feyenoord"],
  }),
  team({
    slug: "psv",
    name: "PSV",
    countryCode: "NL",
    competitionSlugs: ["eredivisie", "champions-league"],
    aliases: ["psv eindhoven"],
    relatedTeamSlugs: ["ajax", "feyenoord"],
  }),
  team({
    slug: "feyenoord",
    name: "Feyenoord",
    countryCode: "NL",
    competitionSlugs: ["eredivisie", "europa-league"],
    aliases: ["feyenoord rotterdam"],
    relatedTeamSlugs: ["ajax", "psv"],
  }),
  // MLS
  team({
    slug: "inter-miami",
    name: "Inter Miami",
    countryCode: "US",
    competitionSlugs: ["mls"],
    aliases: ["inter miami cf", "club internacional de futbol miami"],
    relatedTeamSlugs: ["lafc", "seattle-sounders"],
  }),
  team({
    slug: "lafc",
    name: "LAFC",
    countryCode: "US",
    competitionSlugs: ["mls"],
    aliases: ["los angeles fc", "los angeles football club"],
    relatedTeamSlugs: ["inter-miami", "seattle-sounders"],
  }),
  team({
    slug: "seattle-sounders",
    name: "Seattle Sounders",
    countryCode: "US",
    competitionSlugs: ["mls"],
    aliases: ["seattle sounders fc"],
    relatedTeamSlugs: ["inter-miami", "lafc"],
  }),
  // Liga MX
  team({
    slug: "club-america",
    name: "Club America",
    shortName: "América",
    countryCode: "MX",
    competitionSlugs: ["liga-mx"],
    aliases: ["américa", "club america mexico", "cf america"],
    relatedTeamSlugs: ["chivas", "tigres"],
  }),
  team({
    slug: "chivas",
    name: "Chivas",
    countryCode: "MX",
    competitionSlugs: ["liga-mx"],
    aliases: ["guadalajara", "cd guadalajara", "chivas rayadas"],
    relatedTeamSlugs: ["club-america", "tigres"],
  }),
  team({
    slug: "tigres",
    name: "Tigres",
    countryCode: "MX",
    competitionSlugs: ["liga-mx"],
    aliases: ["tigres uanl", "uanl tigres"],
    relatedTeamSlugs: ["club-america", "chivas"],
  }),
  // NPFL
  team({
    slug: "enyimba",
    name: "Enyimba",
    countryCode: "NG",
    competitionSlugs: ["npfl"],
    aliases: ["enyimba fc", "enyimba international"],
    relatedTeamSlugs: ["rangers-international", "remo-stars"],
    relatedOperatorSlugs: ["1xbet", "melbet", "bet-and-you", "megapari"],
  }),
  team({
    slug: "rangers-international",
    name: "Rangers International",
    countryCode: "NG",
    competitionSlugs: ["npfl"],
    aliases: ["enugu rangers", "rangers fc"],
    relatedTeamSlugs: ["enyimba", "remo-stars"],
  }),
  team({
    slug: "remo-stars",
    name: "Remo Stars",
    countryCode: "NG",
    competitionSlugs: ["npfl"],
    aliases: ["remo stars fc"],
    relatedTeamSlugs: ["enyimba", "rangers-international"],
  }),
  // J League
  team({
    slug: "kashima-antlers",
    name: "Kashima Antlers",
    countryCode: "JP",
    competitionSlugs: ["j-league"],
    aliases: ["kashima"],
    relatedTeamSlugs: ["kawasaki-frontale", "yokohama-f-marinos", "vissel-kobe"],
    relatedOperatorSlugs: ["1xbet", "bet-and-you", "melbet"],
  }),
  team({
    slug: "kawasaki-frontale",
    name: "Kawasaki Frontale",
    countryCode: "JP",
    competitionSlugs: ["j-league"],
    aliases: ["frontale", "kawasaki"],
    relatedTeamSlugs: ["kashima-antlers", "yokohama-f-marinos", "vissel-kobe"],
  }),
  team({
    slug: "yokohama-f-marinos",
    name: "Yokohama F. Marinos",
    shortName: "Yokohama FM",
    countryCode: "JP",
    competitionSlugs: ["j-league"],
    aliases: ["yokohama f marinos", "yokohama marinos", "f marinos"],
    relatedTeamSlugs: ["kashima-antlers", "kawasaki-frontale", "vissel-kobe"],
  }),
  team({
    slug: "vissel-kobe",
    name: "Vissel Kobe",
    countryCode: "JP",
    competitionSlugs: ["j-league"],
    aliases: ["vissel"],
    relatedTeamSlugs: ["kashima-antlers", "kawasaki-frontale"],
  }),
  // Europa / misc hints
  team({
    slug: "sevilla",
    name: "Sevilla",
    countryCode: "ES",
    competitionSlugs: ["la-liga", "europa-league"],
    aliases: ["sevilla fc"],
    relatedTeamSlugs: ["real-madrid", "barcelona"],
  }),
];

export function listTeams(): TeamEntity[] {
  return TEAMS.filter((team) => team.active);
}

export function listAllTeams(): TeamEntity[] {
  return [...TEAMS];
}

export function getTeam(slug: string): TeamEntity | undefined {
  return TEAMS.find((team) => team.slug === slug && team.active);
}

export function teamSlugs(): string[] {
  return listTeams().map((team) => team.slug);
}

export function getRelatedTeams(slug: string, limit = 6): TeamEntity[] {
  const team = getTeam(slug);
  if (!team) return [];
  const fromRelated = team.relatedTeamSlugs
    .map((related) => getTeam(related))
    .filter((related): related is TeamEntity => Boolean(related));
  if (fromRelated.length) return fromRelated.slice(0, limit);

  return listTeams()
    .filter(
      (candidate) =>
        candidate.slug !== slug &&
        candidate.competitionSlugs.some((competition) =>
          team.competitionSlugs.includes(competition)
        )
    )
    .slice(0, limit);
}

export function teamsForCompetition(competitionSlug: string): TeamEntity[] {
  return listTeams().filter((team) => team.competitionSlugs.includes(competitionSlug));
}

export function resolveRegisteredTeam(input: {
  name?: string | null;
  providerIds?: TeamEntity["providerIds"];
  competitionSlug?: string | null;
}) {
  return resolveTeam(listTeams(), input);
}

export function ensureUniqueSlugs(): string[] {
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const team of TEAMS) {
    if (seen.has(team.slug)) dupes.push(team.slug);
    seen.add(team.slug);
  }
  return dupes;
}

/** Suggest slug from a fixture team name without creating a registry entry. */
export function suggestedSlugForName(name: string): string {
  return slugifyTeamName(name);
}
