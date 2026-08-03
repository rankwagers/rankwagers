import { unstable_cache } from "next/cache";
import {
  EXCLUDED_COMPETITIONS,
  FH_OVER_05_THRESHOLD,
  FOOTYSTATS_BASE_URL,
  getFootyStatsApiKey,
  OVER_15_THRESHOLD,
  OVER_25_THRESHOLD,
  SH_OVER_05_THRESHOLD,
} from "./config";
import { enrichAllLists } from "@/lib/api-football/enrich";
import { observedResearchRun, unobservedResearchRun } from "@/lib/research/researchRun";
import { footyRowCoreSchema, type FootyRowCore } from "@/lib/research/footyRowContract";
import { countryToIso2, flagEmojiForCountry } from "./flags";
import { leagueImageUrl, teamImageUrl } from "./images";
import {
  archiveToDailyLists,
  mergeArchiveFromLists,
  readDailyArchive,
} from "./dailyArchive";
import type { DailyMatchLists, FootyMatchRow } from "./types";
import { isMatchPostponed } from "./matchStatus";
import { loadSameDayArchiveFallback } from "./archiveFallback";
import { noteDailyListsServing } from "./servingState";

type LeagueInfo = { league: string; country: string; image?: string };
type RawMatch = Record<string, unknown>;

function toIstanbulTime(unix: number): string {
  if (!unix) return "?";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Istanbul",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(unix * 1000));
  } catch {
    return "?";
  }
}

function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function todayMatchDateStr(): string {
  return todayDateStr();
}

/**
 * The raw provider match, projected onto the fields the usability contract constrains.
 *
 * Extracted so `buildRow` and the `validated` stage count read the SAME coercion. If the two
 * diverged — one treating an absent potential as 0 and the other as missing, say — the count
 * would describe a population the pipeline does not actually accept, and a measured number that
 * describes nothing is worse than no number at all.
 *
 * The coercions mirror what the provider sends: numerics arrive as strings on some endpoints, and
 * an absent potential is a real zero rather than a defect.
 */
function coreFieldsFromRaw(m: RawMatch): FootyRowCore {
  return {
    matchId: Number(m.id),
    homeTeam: String(m.home_name ?? ""),
    awayTeam: String(m.away_name ?? ""),
    kickoffTime: Number(m.date_unix ?? 0),
    over15Pct: Number(m.o15_potential ?? 0),
    fhOver05Pct: Number(m.o05HT_potential ?? 0),
    over25Pct: Number(m.o25_potential ?? 0),
    shOver05Pct: Number(m.o05_2H_potential ?? 0),
  };
}

function isCup(leagueName: string): boolean {
  if (!leagueName) return false;
  const lower = leagueName.toLowerCase();
  return EXCLUDED_COMPETITIONS.some((kw) => lower.includes(kw.toLowerCase()));
}

/**
 * Provider result that keeps the failure reason instead of discarding it.
 *
 * `executeProviderCallSoft` collapses "the provider failed" and "the provider returned nothing"
 * into the same `null`, and today's fallback turns on exactly that distinction. This calls
 * `executeProviderCall` directly and catches — the same function the soft wrapper calls, so retry,
 * timeout, quota and circuit-breaker behaviour are untouched and there is no second request.
 */
type ProviderFetch<T> = { ok: true; data: T } | { ok: false; code: string };

async function fetchJsonResult<T>(
  endpoint: string,
  params: Record<string, string>,
  operation:
    | "fixture_list"
    | "fixture_detail"
    | "team_stats"
    | "season_data"
    | "generic" = "generic"
): Promise<ProviderFetch<T>> {
  const { executeProviderCall, ProviderError } = await import(
    "@/lib/providers/reliability"
  );
  try {
    // Credential resolution and URL assembly sit INSIDE the try deliberately.
    //
    // `getFootyStatsApiKey()` throws when the key is missing or blank. With that call outside the
    // try, the throw escaped this function entirely, skipped the failure classification, and left
    // the day looking like an application error rather than a provider one — so the same-day
    // archive fallback never engaged and the page rendered empty. Isolated verification of the
    // 2026-08-01 candidate reproduced exactly that: 0 qualified fixtures and no stale notice.
    //
    // A missing or rotated credential is operationally a provider outage: we cannot reach the
    // provider, and the last good archive is the right thing to serve.
    const key = getFootyStatsApiKey();
    const url = new URL(`${FOOTYSTATS_BASE_URL}/${endpoint}`);
    url.searchParams.set("key", key);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
    const result = await executeProviderCall<T>({
      provider: "footystats",
      operation,
      endpoint,
      fetch: (signal) =>
        fetch(url.toString(), {
          signal,
          next: { revalidate: 300 },
        }),
      parse: (res) => res.json() as Promise<T>,
    });
    return { ok: true, data: result.data };
  } catch (error) {
    // Every reliability failure mode arrives here as a ProviderError with a bounded code:
    // circuit_open, timeout, network, quota_exhausted, rate_limited, upstream_5xx, unavailable,
    // authentication, invalid_request, malformed_response. Anything else is recorded as `unknown`.
    const code =
      error instanceof ProviderError ? error.code : "unknown";
    return { ok: false, code };
  }
}

/** Soft accessor retained for callers that have no fallback and only need the payload. */
async function fetchJson<T>(
  endpoint: string,
  params: Record<string, string>,
  operation:
    | "fixture_list"
    | "fixture_detail"
    | "team_stats"
    | "season_data"
    | "generic" = "generic"
): Promise<T | null> {
  const result = await fetchJsonResult<T>(endpoint, params, operation);
  return result.ok ? result.data : null;
}

let leagueCache: Record<number, LeagueInfo> | null = null;

async function loadLeagueCache(): Promise<Record<number, LeagueInfo>> {
  if (leagueCache) return leagueCache;
  type LeagueListResponse = {
    data?: Array<{
      league_name?: string;
      name?: string;
      country?: string;
      image?: string;
      season?: Array<{ id?: number }>;
    }>;
  };
  const raw = await fetchJson<LeagueListResponse>("league-list", {});
  const map: Record<number, LeagueInfo> = {};
  const leagues = raw?.data ?? (Array.isArray(raw) ? raw : []);
  if (Array.isArray(leagues)) {
    for (const league of leagues) {
      const name = league.league_name || league.name || "";
      const country = league.country || "";
      const image = leagueImageUrl(league.image);
      for (const season of league.season ?? []) {
        const sid = season.id;
        if (sid) map[sid] = { league: name, country, image };
      }
    }
  }
  leagueCache = map;
  return map;
}

function leagueInfo(
  compId: number | undefined,
  matchUrl: string,
  cache: Record<number, LeagueInfo>
): LeagueInfo {
  if (compId && cache[compId]) return cache[compId];
  if (matchUrl?.startsWith("/")) {
    const parts = matchUrl.split("/");
    if (parts[1]) {
      return { league: "", country: parts[1].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) };
    }
  }
  return { league: "", country: "" };
}

function buildRow(m: RawMatch, info: LeagueInfo, highlightPct: number): FootyMatchRow {
  const status = String(m.status ?? "");
  const statusLower = status.toLowerCase();
  const isPostponed = isMatchPostponed(status);
  const isLive =
    !isPostponed &&
    ["live", "inplay", "1h", "2h", "ht", "in_play", "playing"].includes(statusLower);
  const isFinished =
    !isPostponed &&
    ["complete", "finished", "ft", "ended", "full-time"].includes(statusLower);
  const homeScore = Number(m.homeGoalCount ?? 0);
  const awayScore = Number(m.awayGoalCount ?? 0);
  const htHomeRaw = m.ht_goals_team_a;
  const htAwayRaw = m.ht_goals_team_b;
  const htHome = htHomeRaw != null && htHomeRaw !== "" ? Number(htHomeRaw) : null;
  const htAway = htAwayRaw != null && htAwayRaw !== "" ? Number(htAwayRaw) : null;
  const htGoalCountRaw = m.HTGoalCount;
  const htGoalCount =
    htGoalCountRaw != null && htGoalCountRaw !== ""
      ? Number(htGoalCountRaw)
      : htHome != null && htAway != null
        ? htHome + htAway
        : null;
  const kickoff = Number(m.date_unix ?? 0);
  const matchUrl = String(m.match_url ?? "");
  let country = info.country;
  if (!country && matchUrl.startsWith("/")) {
    const slug = matchUrl.split("/").filter(Boolean)[0] || "";
    if (slug === "usa") country = "USA";
    else if (slug === "ireland" || slug === "republic-of-ireland") country = "Ireland";
    else if (slug === "belarus") country = "Belarus";
    else if (slug)
      country = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  const countryCode =
    countryToIso2(country, matchUrl, info.league) ?? countryToIso2("", matchUrl, info.league);
  const homeRaw = m.home_image ?? m.team_a_image;
  const awayRaw = m.away_image ?? m.team_b_image;
  const homeImg = homeRaw ? teamImageUrl(String(homeRaw)) : undefined;
  const awayImg = awayRaw ? teamImageUrl(String(awayRaw)) : undefined;

  return {
    ...coreFieldsFromRaw(m),
    homeImage: homeImg,
    awayImage: awayImg,
    leagueImage: info.image,
    competition: info.league,
    country,
    countryCode,
    flag: flagEmojiForCountry(country),
    kickoff: toIstanbulTime(kickoff),
    status,
    isLive,
    isFinished,
    homeScore,
    awayScore,
    htHome,
    htAway,
    htGoalCount,
    minute: Number(m.minute ?? 0),
    highlightPct,
  };
}

/**
 * Split the provider population into the four market lists, and observe the funnel while doing it.
 *
 * Extracted from `fetchDailyListsUncached` for one reason: this is where the funnel is measured,
 * and a measurement nothing can execute is a measurement nothing can check. Pure — the league
 * cache is passed in, there is no I/O and no clock — so the invariant that observation does not
 * alter flow is directly testable.
 *
 * Behaviour is byte-for-byte what it was before the instrumentation landed: the cup filter is the
 * only `continue`, every other row reaches `buildRow`, and the thresholds decide the lists.
 */
export function partitionDailyMatches(
  matches: RawMatch[],
  cache: Record<number, LeagueInfo>
): {
  over15: FootyMatchRow[];
  fh: FootyMatchRow[];
  over25: FootyMatchRow[];
  sh: FootyMatchRow[];
  analysed: number;
  validated: number;
  inScope: number;
  qualifiedIds: Set<number>;
} {
  const over15: FootyMatchRow[] = [];
  const fh: FootyMatchRow[] = [];
  const over25: FootyMatchRow[] = [];
  const sh: FootyMatchRow[] = [];

  /*
   * Funnel instrumentation (rwdesign §6).
   *
   * This loop is the ONLY place in the product where the rejected population is visible: after it
   * returns, the lists carry qualified fixtures and nothing else. The counts below are taken here
   * because here they are observations; anywhere downstream they would be reconstructions.
   *
   * `analysed` is the provider population. `validated` counts rows whose fields satisfy the
   * usability contract — a row with no id, no team name or a non-finite potential cannot be used
   * downstream whatever its thresholds say, so it is rejected here rather than carried and dropped
   * later. `inScope` counts the validated rows whose competition survives the cup filter.
   * `qualified` counts DISTINCT fixtures — a match clearing three thresholds is one qualified
   * fixture in three lists, so a sum of list lengths would overcount it. Nothing is derived by
   * subtraction: each is incremented where it is observed (§3.2).
   */
  const analysed = matches.length;
  let validated = 0;
  let inScope = 0;
  const qualifiedIds = new Set<number>();

  for (const m of matches) {
    /*
     * OBSERVATION ONLY. A row failing the contract is still built, still pushed if it clears a
     * threshold, and still reaches the archive — it is counted out of `validated`, not filtered
     * out of the run.
     *
     * Skipping here looked equivalent because the fixture parse rejects the same rows downstream.
     * It is not: `mapApiFixtureToQualifiedFixture` is reached only from `qualifiedFixture.ts`,
     * while `app/api/home-search/route.ts` reads `FootyMatchRow` fields straight off these lists,
     * and `mergeArchiveFromLists` persists them verbatim. An early skip therefore removed rows
     * from search and, worse, from the permanent daily archive — a destructive change to stored
     * history (§3.11).
     *
     * Instrumentation observes; it does not alter what flows.
     */
    const rowValidated = footyRowCoreSchema.safeParse(coreFieldsFromRaw(m)).success;
    if (rowValidated) validated += 1;

    const compId = Number(m.competition_id);
    const info = leagueInfo(compId, String(m.match_url ?? ""), cache);
    // The ONLY `continue` in this loop, and it predates the instrumentation: the cup filter is
    // existing flow control and stays exactly as it was.
    if (isCup(info.league)) continue;
    // `inScope` is defined as validated rows in scope, so it stays a subset of `validated`. The
    // condition governs the COUNT only — an unvalidated row still flows on to the thresholds.
    if (rowValidated) inScope += 1;

    const o15 = Number(m.o15_potential ?? 0);
    const fh05 = Number(m.o05HT_potential ?? 0);
    const o25 = Number(m.o25_potential ?? 0);
    const sh05 = Number(m.o05_2H_potential ?? 0);

    if (o15 >= OVER_15_THRESHOLD) {
      over15.push(buildRow(m, info, o15));
    }
    if (fh05 >= FH_OVER_05_THRESHOLD) {
      fh.push(buildRow(m, info, fh05));
    }
    if (o25 >= OVER_25_THRESHOLD) {
      over25.push(buildRow(m, info, o25));
    }
    if (sh05 >= SH_OVER_05_THRESHOLD) {
      sh.push(buildRow(m, info, sh05));
    }

    if (
      o15 >= OVER_15_THRESHOLD ||
      fh05 >= FH_OVER_05_THRESHOLD ||
      o25 >= OVER_25_THRESHOLD ||
      sh05 >= SH_OVER_05_THRESHOLD
    ) {
      const matchId = Number(m.id);
      if (Number.isFinite(matchId) && matchId > 0) qualifiedIds.add(matchId);
    }
  }


  return { over15, fh, over25, sh, analysed, validated, inScope, qualifiedIds };
}

async function fetchDailyListsUncached(date: string): Promise<DailyMatchLists> {
  type TodayResponse = { data?: RawMatch[] };
  const fetched = await fetchJsonResult<TodayResponse>("todays-matches", { date });

  // Provider failure is reported, not swallowed. The caller decides whether a same-day archive may
  // stand in; this function never substitutes data of its own accord, and it does NOT touch the
  // archive on a failed fetch — a failure must not overwrite the last good capture.
  if (!fetched.ok) {
    return {
      ...emptyLists(date),
      provenance: {
        source: "unavailable",
        requestedDate: date,
        providerFailureReasonCode: fetched.code,
      },
      /*
       * A failed fetch observed no population at all. Every stage is `null` — not zero: zero
       * would assert the provider returned nothing, which is a different and unevidenced claim
       * about the day (§3.2, §3.8).
       */
      researchRun: unobservedResearchRun(),
    };
  }

  const matches = fetched.data?.data ?? [];
  const cache = await loadLeagueCache();

  const { over15, fh, over25, sh, analysed, validated, inScope, qualifiedIds } =
    partitionDailyMatches(matches, cache);

  const sortKick = (a: FootyMatchRow, b: FootyMatchRow) => a.kickoffTime - b.kickoffTime;
  over15.sort(sortKick);
  fh.sort(sortKick);
  over25.sort(sortKick);
  sh.sort(sortKick);

  await enrichAllLists({ over15, fh, over25, sh }, date);

  const fetchedAt = new Date().toISOString();
  const lists: DailyMatchLists = {
    date,
    over15,
    fh,
    over25,
    sh,
    fetchedAt,
    // A successful empty day is still fresh. Only a provider FAILURE may be substituted.
    provenance: { source: "fresh_provider", requestedDate: date },
    /*
     * `featured` is absent here by contract: how many fixtures are FEATURED is a presentation
     * decision made downstream — the pipeline does not observe it and must not guess.
     */
    researchRun: observedResearchRun({
      analysed,
      validated,
      inScope,
      qualified: qualifiedIds.size,
      fetchedAt,
    }),
  };
  try {
    await mergeArchiveFromLists(lists);
  } catch {
    /* archive is optional — never block page load */
  }
  return lists;
}

function isValidDateStr(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

export async function getDailyMatchListsForDate(date: string): Promise<DailyMatchLists> {
  const d = isValidDateStr(date) ? date : todayDateStr();
  const today = todayDateStr();

  if (d === today) {
    const fresh = await unstable_cache(
      () => fetchDailyListsUncached(d),
      ["footystats-daily", d],
      { revalidate: 300 }
    )();

    // Only a provider failure is substitutable. A successful response — including a successful
    // EMPTY one — is returned untouched, so an genuinely quiet day never shows yesterday's rows.
    if (fresh.provenance?.source !== "unavailable") {
      noteDailyListsServing(fresh.provenance?.source ?? "fresh_provider");
      return fresh;
    }

    // The fallback read sits OUTSIDE the cache on purpose: the failure marker stays cached for the
    // normal 300s window, so the provider is not re-hit any harder than before, while the archive
    // is re-read each request and picks up a recovery capture the moment one lands.
    const fallback = await loadSameDayArchiveFallback(
      d,
      fresh.provenance?.providerFailureReasonCode ?? "unknown"
    );
    if (fallback.used) {
      noteDailyListsServing("stale_daily_archive");
      return fallback.lists;
    }

    // Fail closed: provider failed AND no valid same-day archive exists.
    noteDailyListsServing("unavailable");
    return fresh;
  }

  const archive = await readDailyArchive(d);
  if (archive) {
    return archiveToDailyLists(archive);
  }

  return unstable_cache(
    () => fetchDailyListsUncached(d),
    ["footystats-daily", d],
    { revalidate: 3600 }
  )();
}

export async function getDailyMatchLists(): Promise<DailyMatchLists> {
  return getDailyMatchListsForDate(todayDateStr());
}

export async function getDailyMatchListsSafe(
  date?: string
): Promise<DailyMatchLists | { error: string }> {
  try {
    return await getDailyMatchListsForDate(date ?? todayDateStr());
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load matches";
    return { error: msg };
  }
}

export function emptyLists(date?: string): DailyMatchLists {
  const requestedDate = date ?? todayDateStr();
  return {
    date: requestedDate,
    over15: [],
    fh: [],
    over25: [],
    sh: [],
    fetchedAt: new Date().toISOString(),
    provenance: { source: "unavailable", requestedDate },
  };
}
