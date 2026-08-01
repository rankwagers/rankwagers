/**
 * Honest homepage trust aggregates from daily list archives + today's lists.
 * Never invents ROI, average odds, or tipster bankroll metrics.
 */

import fs from "fs/promises";
import path from "path";
import { marketForListKind } from "@/lib/research/fixturePresentation";
import { fixturePath } from "@/lib/fixtures/paths";
import type { Locale } from "@/lib/i18n";
import {
  readDailyArchive,
  type ArchivedRow,
  type DailyArchive,
} from "@/lib/footystats/dailyArchive";
import { listSettleState } from "@/lib/footystats/listSettle";
import type { DailyMatchLists, MatchListKind } from "@/lib/footystats/types";
import {
  findCompetitionForLeague,
  getCompetition,
} from "@/lib/competitions/registry";
import { competitionPath } from "@/lib/competitions/links";
import type { CountryContext } from "@/lib/personalization/types";
import type {
  HomepageFeaturedLeague,
  HomepageRecentResult,
  HomepageResultStatus,
  HomepageTrustModel,
  HomepageVerifiedPerformance,
} from "./types";

const ARCHIVE_DIR = path.join(process.cwd(), "data", "daily-archives");
const TABS: MatchListKind[] = ["fh", "over15", "over25", "sh"];

function shiftDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function listRecentArchiveDates(limit: number): Promise<string[]> {
  try {
    const names = await fs.readdir(ARCHIVE_DIR);
    return names
      .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))
      .map((name) => name.replace(/\.json$/, ""))
      .sort()
      .reverse()
      .slice(0, limit);
  } catch {
    return [];
  }
}

function mapStatus(
  result: ReturnType<typeof listSettleState>
): HomepageResultStatus {
  if (result === "won") return "won";
  if (result === "lost") return "lost";
  if (result === "postponed") return "void";
  return "pending";
}

function scoreLabel(row: ArchivedRow): string {
  if (row.homeScore == null || row.awayScore == null) return "—";
  if (!row.isFinished && !row.isLive) return "—";
  return `${row.homeScore}–${row.awayScore}`;
}

function aggregateArchive(archive: DailyArchive): {
  total: number;
  won: number;
  lost: number;
  pending: number;
  voided: number;
} {
  let total = 0;
  let won = 0;
  let lost = 0;
  let pending = 0;
  let voided = 0;
  for (const tab of TABS) {
    const s = archive.summary[tab];
    total += s.total;
    won += s.won;
    lost += s.lost;
    pending += s.pending;
    voided += s.postponed;
  }
  return { total, won, lost, pending, voided };
}

function aggregateTodayLists(lists: DailyMatchLists): {
  total: number;
  won: number;
  lost: number;
  pending: number;
  voided: number;
} {
  let total = 0;
  let won = 0;
  let lost = 0;
  let pending = 0;
  let voided = 0;
  for (const tab of TABS) {
    for (const row of lists[tab]) {
      total++;
      const status = mapStatus(listSettleState(row, tab));
      if (status === "won") won++;
      else if (status === "lost") lost++;
      else if (status === "void") voided++;
      else pending++;
    }
  }
  return { total, won, lost, pending, voided };
}

function collectRecentResults(
  archives: DailyArchive[],
  locale: Locale,
  limit: number
): HomepageRecentResult[] {
  const items: HomepageRecentResult[] = [];
  for (const archive of archives) {
    for (const tab of TABS) {
      const market = marketForListKind(tab);
      for (const row of archive[tab]) {
        const status = mapStatus(listSettleState(row, tab));
        items.push({
          id: `${archive.date}-${tab}-${row.matchId}`,
          matchId: row.matchId,
          home: row.homeTeam,
          away: row.awayTeam,
          competition: row.competition || "Competition",
          marketKey: tab,
          marketLabel: market.label,
          status,
          scoreLabel: scoreLabel(row),
          matchHref: fixturePath(locale, row.matchId, tab, "recent_results"),
          date: archive.date,
        });
      }
    }
  }
  // Transparent ordering: newest archive date first, then kickoff, no W/L filter.
  items.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return b.matchId - a.matchId;
  });
  return items.slice(0, limit);
}

export function resolveFeaturedLeagues(
  countryContext: CountryContext,
  locale: Locale,
  fallbackSlugs: string[] = [
    "premier-league",
    "la-liga",
    "serie-a",
    "bundesliga",
    "ligue-1",
    "champions-league",
  ]
): HomepageFeaturedLeague[] {
  const fromCountry = countryContext.topLeagues
    .map((name) => {
      const match = findCompetitionForLeague(name);
      if (match) {
        return {
          name: match.name,
          href: competitionPath(locale, match.slug),
          source: "registry" as const,
        };
      }
      return { name, href: null, source: "label_only" as const };
    })
    .filter((row, index, all) => all.findIndex((x) => x.name === row.name) === index);

  if (fromCountry.length >= 4) return fromCountry.slice(0, 8);

  const extras: HomepageFeaturedLeague[] = [];
  for (const slug of fallbackSlugs) {
    const competition = getCompetition(slug);
    if (!competition) continue;
    if (fromCountry.some((row) => row.href === competitionPath(locale, competition.slug))) {
      continue;
    }
    extras.push({
      name: competition.name,
      href: competitionPath(locale, competition.slug),
      source: "registry",
    });
  }
  return [...fromCountry, ...extras].slice(0, 8);
}

export async function buildHomepageTrustModel(input: {
  locale: Locale;
  today: string;
  selectedDate: string;
  lists: DailyMatchLists;
  countryContext: CountryContext;
}): Promise<HomepageTrustModel> {
  const yesterday = shiftDate(input.today, -1);
  const recentDates = await listRecentArchiveDates(5);
  const preferred = [yesterday, ...recentDates.filter((d) => d !== yesterday)].slice(0, 3);

  const archives: DailyArchive[] = [];
  for (const date of preferred) {
    const archive = await readDailyArchive(date);
    if (archive) archives.push(archive);
  }

  const windowParts = archives.map((a) => a.date);
  const fromArchives = archives.reduce(
    (acc, archive) => {
      const next = aggregateArchive(archive);
      return {
        total: acc.total + next.total,
        won: acc.won + next.won,
        lost: acc.lost + next.lost,
        pending: acc.pending + next.pending,
        voided: acc.voided + next.voided,
      };
    },
    { total: 0, won: 0, lost: 0, pending: 0, voided: 0 }
  );

  // Include selected-date intraday settlement when viewing today.
  const todayAgg =
    input.selectedDate === input.today
      ? aggregateTodayLists(input.lists)
      : { total: 0, won: 0, lost: 0, pending: 0, voided: 0 };

  const total = fromArchives.total + todayAgg.total;
  const won = fromArchives.won + todayAgg.won;
  const lost = fromArchives.lost + todayAgg.lost;
  const pending = fromArchives.pending + todayAgg.pending;
  const voided = fromArchives.voided + todayAgg.voided;
  const settled = won + lost;
  const hitRatePct =
    settled > 0 ? Math.round((won / settled) * 1000) / 10 : null;

  const lastUpdatedAt =
    archives[0]?.savedAt ??
    (input.lists.fetchedAt ? input.lists.fetchedAt : null);

  const availability: HomepageVerifiedPerformance["availability"] =
    total > 0 ? "available" : "unavailable";

  const windowLabel =
    windowParts.length > 0
      ? `Qualified list markets · ${windowParts[windowParts.length - 1]} → ${windowParts[0]}${
          todayAgg.total ? " + today (in progress)" : ""
        }`
      : todayAgg.total
        ? "Today's qualified list markets (in progress)"
        : "No settled archive window available yet";

  const verified: HomepageVerifiedPerformance = {
    availability,
    windowLabel,
    lastUpdatedAt,
    totalPredictions: total,
    settledPredictions: settled,
    pendingPredictions: pending,
    voidPredictions: voided,
    won,
    lost,
    hitRatePct,
    sampleNote:
      "Counts cover qualified goal-market lists (1H 0.5+, Over 1.5, Over 2.5, 2H 0.5+) only. Hit rate uses settled won+lost. ROI and average odds are omitted when publication odds are not durably archived.",
    methodologyHref: `/${input.locale}/methodology`,
    archiveEntryHref: `/${input.locale}/archive`,
  };

  const liveMatchCount = new Set(
    [...input.lists.fh, ...input.lists.over15, ...input.lists.over25, ...input.lists.sh]
      .filter((row) => row.isLive)
      .map((row) => row.matchId)
  ).size;

  const qualifiedFixtureCount = new Set(
    [...input.lists.fh, ...input.lists.over15, ...input.lists.over25, ...input.lists.sh].map(
      (row) => row.matchId
    )
  ).size;

  return {
    verified,
    recentResults: collectRecentResults(archives, input.locale, 12),
    featuredLeagues: resolveFeaturedLeagues(input.countryContext, input.locale),
    liveMatchCount,
    qualifiedFixtureCount,
  };
}
