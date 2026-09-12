import "server-only";

import {
  emptyLists,
  getDailyMatchListsSafe,
  todayMatchDateStr,
} from "@/lib/footystats/client";
import { backfillCountryCodes } from "@/lib/footystats/countryBackfill";
import type {
  DailyMatchLists,
  FootyMatchRow,
  MatchListKind,
} from "@/lib/footystats/types";
import {
  getMatchDetails,
  type MatchDetailPublic,
  type VenueSideStats,
} from "@/lib/footystats/matchDetail";
import { marketForListKind } from "@/lib/research/fixturePresentation";
import { publicationOddsForFixture } from "@/lib/odds-history/publication";
import { listOperators } from "@/lib/operators/registry";
import { resolveOperatorAvailability } from "@/lib/operators/availability";
import { buildGoPath } from "@/lib/operators/go-path";
import type { Locale } from "@/lib/i18n";

/* ============================================================================
   THE V3 PREDICTION TABLE'S DATA (Bible V3 + the truth laws).

   One row per fixture; the row's market is the fixture's strongest qualified
   bucket (or the reader's market filter). The rate/sample pair comes from the
   home side's venue record for that market — the same derivation the fixture
   page renders — and a row whose venue stat did not resolve shows NO rate
   (omission, never a stand-in). Form dots derive from full-time scores, so
   they exist only for the O1.5/O2.5 markets; half markets have no honest
   source and render none. Odds are kickoff-frozen observations; a row with
   no observed price has no odds button.
   ========================================================================== */

export type DayKey = "today" | "tomorrow" | "weekend";

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The dates each tab covers. Weekend = the coming Saturday and Sunday. */
export function datesForDay(day: DayKey): string[] {
  const today = todayMatchDateStr();
  if (day === "today") return [today];
  if (day === "tomorrow") return [addDays(today, 1)];
  const dow = new Date(`${today}T00:00:00.000Z`).getUTCDay(); // 0=Sun..6=Sat
  const toSaturday = (6 - dow + 7) % 7;
  const saturday = addDays(today, toSaturday);
  // On Sunday the weekend is today alone — never yesterday's settled Saturday.
  if (dow === 0) return [today];
  return [saturday, addDays(saturday, 1)];
}

export function parseDayParam(raw: string | undefined): DayKey {
  return raw === "tomorrow" || raw === "weekend" ? raw : "today";
}

function mergeLists(parts: DailyMatchLists[]): DailyMatchLists {
  if (parts.length === 1) return parts[0];
  const base = emptyLists();
  const merged: DailyMatchLists = {
    ...base,
    ...parts[0],
    fh: parts.flatMap((p) => p.fh),
    over15: parts.flatMap((p) => p.over15),
    over25: parts.flatMap((p) => p.over25),
    sh: parts.flatMap((p) => p.sh),
  };
  return merged;
}

export async function loadListsForDay(
  day: DayKey
): Promise<{ lists: DailyMatchLists; error: string | null }> {
  const dates = datesForDay(day);
  const results = await Promise.all(dates.map((date) => getDailyMatchListsSafe(date)));
  const ok = results.filter(
    (result): result is DailyMatchLists => !("error" in result)
  );
  const error = results.find((result) => "error" in result) as
    | { error: string }
    | undefined;
  const lists = backfillCountryCodes(ok.length ? mergeLists(ok) : emptyLists());
  return { lists, error: error?.error ?? null };
}

export function countDistinctMatches(lists: DailyMatchLists): number {
  return new Set(
    [...lists.fh, ...lists.over15, ...lists.over25, ...lists.sh].map((r) => r.matchId)
  ).size;
}

/* ── the table rows ────────────────────────────────────────────────────── */

const VENUE_KEY: Record<MatchListKind, keyof VenueSideStats> = {
  fh: "fh05",
  over15: "over15",
  over25: "over25",
  sh: "sh05",
};

const PCT_FIELD: Record<MatchListKind, keyof FootyMatchRow> = {
  fh: "fhOver05Pct",
  over15: "over15Pct",
  over25: "over25Pct",
  sh: "shOver05Pct",
};

export type TableRow = {
  matchId: number;
  kickoffTime: number;
  timeLabel: string;
  home: string;
  away: string;
  homeImage: string | null;
  awayImage: string | null;
  league: string;
  countryCode: string | null;
  marketKind: MatchListKind;
  marketLabel: string;
  /** Venue rate for the market — null renders as omission, never a dash. */
  ratePct: number | null;
  sample: string | null;
  /** Oldest → newest, true = market hit. Empty for half markets (no HT data). */
  form: boolean[];
  bestOdds: {
    operatorSlug: string;
    mark: string;
    /** The real brand asset for the CTA (polish group 1); mark is the fallback. */
    logo: string | null;
    decimal: string;
    continueHref: string;
  } | null;
  /**
   * Polish group 4: when NO price was observed, the sponsored no-number
   * ghost (day's pinned/Best operator) — placement price_row_fallback.
   * Never rendered beside a real price; null when nobody qualifies.
   */
  fallbackOdds: {
    operatorSlug: string;
    name: string;
    mark: string;
    logo: string | null;
    continueHref: string;
  } | null;
  isLive: boolean;
};

function timeLabelFor(row: FootyMatchRow): string {
  const d = new Date(row.kickoffTime * 1000);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(d);
}

function formFromHistory(
  detail: MatchDetailPublic | undefined,
  kind: MatchListKind
): boolean[] {
  if (!detail?.history?.homeAtHome) return [];
  const threshold = kind === "over15" ? 1.5 : kind === "over25" ? 2.5 : null;
  if (threshold === null) return []; // half markets: no half-time data in history
  return detail.history.homeAtHome
    .slice(0, 10)
    .map((m) => m.home.score + m.away.score > threshold)
    .reverse();
}

function markFor(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export async function bestPriceForRow(
  row: FootyMatchRow,
  kind: MatchListKind,
  locale: Locale,
  country: string | null
): Promise<TableRow["bestOdds"]> {
  try {
    const kickoffIso = new Date(row.kickoffTime * 1000).toISOString();
    const prices = await publicationOddsForFixture(row.matchId, kickoffIso);
    if (!prices.length) return null;
    const operators = listOperators();
    const byBookmakerId = new Map<number, (typeof operators)[number]>();
    for (const operator of operators) {
      for (const id of operator.apiFootballBookmakerIds) byBookmakerId.set(id, operator);
    }
    const candidates = prices
      .filter((price) => price.market === kind)
      .flatMap((price) => {
        const operator = byBookmakerId.get(price.operatorId);
        if (!operator || !operator.affiliateEnabled) return [];
        const availability = resolveOperatorAvailability(operator, country ?? "");
        if (!availability.available) return [];
        return [{ price, operator }];
      })
      .sort((a, b) => b.price.decimal - a.price.decimal);
    const best = candidates[0];
    if (!best) return null;
    return {
      operatorSlug: best.operator.slug,
      mark: markFor(best.operator.name),
      logo: best.operator.logo ?? null,
      decimal: best.price.decimal.toFixed(2),
      continueHref: buildGoPath({
        slug: best.operator.slug,
        placement: "price_row",
        subid: `pr_${row.matchId}_${kind}_${best.operator.slug}`.toLowerCase(),
        locale: String(locale),
        country: country ?? undefined,
        availability: "full",
        deeplinkType: "football_landing",
      }),
    };
  } catch {
    // No odds store (dev without Postgres) → no odds button, never a fabricated price.
    return null;
  }
}

export async function buildTableRows(input: {
  lists: DailyMatchLists;
  locale: Locale;
  country: string | null;
  marketFilter: MatchListKind | null;
  sort: "rate" | "time";
  limit: number;
  /** Polish group 4: the day's pinned/Best operator for the no-price ghost. */
  fallbackOperator?: import("./homeRails.server").FallbackOperator | null;
}): Promise<{ rows: TableRow[]; totalRows: number }> {
  const { lists, locale, country, marketFilter, sort, limit, fallbackOperator } = input;
  const kinds: MatchListKind[] = ["fh", "over15", "over25", "sh"];
  const byFixture = new Map<number, { row: FootyMatchRow; kinds: Map<MatchListKind, number> }>();
  for (const kind of kinds) {
    for (const row of lists[kind] as FootyMatchRow[]) {
      const entry = byFixture.get(row.matchId) ?? { row, kinds: new Map() };
      entry.kinds.set(kind, Number(row[PCT_FIELD[kind]]) || 0);
      byFixture.set(row.matchId, entry);
    }
  }

  const chosen = [...byFixture.values()].flatMap((entry) => {
    let kind: MatchListKind | null = null;
    if (marketFilter) {
      kind = entry.kinds.has(marketFilter) ? marketFilter : null;
    } else {
      let bestPct = -1;
      for (const [k, pct] of entry.kinds) {
        if (pct > bestPct) {
          bestPct = pct;
          kind = k;
        }
      }
    }
    if (!kind) return [];
    return [{ row: entry.row, kind, pct: entry.kinds.get(kind) ?? 0 }];
  });

  const totalRows = chosen.length;
  const preliminary = [...chosen].sort((a, b) =>
    sort === "time"
      ? a.row.kickoffTime - b.row.kickoffTime
      : b.pct - a.pct || a.row.kickoffTime - b.row.kickoffTime
  );
  const visible = preliminary.slice(0, limit);

  const details = await getMatchDetails(
    visible.map((v) => v.row.matchId),
    locale
  );

  const fallbackFor = (row: FootyMatchRow, kind: MatchListKind) =>
    fallbackOperator
      ? {
          operatorSlug: fallbackOperator.slug,
          name: fallbackOperator.name,
          mark: fallbackOperator.mark,
          logo: fallbackOperator.logo,
          continueHref: buildGoPath({
            slug: fallbackOperator.slug,
            placement: "price_row_fallback",
            subid: `prf_${row.matchId}_${kind}_${fallbackOperator.slug}`.toLowerCase(),
            locale: String(locale),
            country: country ?? undefined,
            availability: "unknown",
            deeplinkType: "football_landing",
          }),
        }
      : null;

  const rows = await Promise.all(
    visible.map(async ({ row, kind }) => {
      const detail = details.get(row.matchId) ?? undefined;
      const stat = detail?.homeAtHome?.[VENUE_KEY[kind]] as
        | { hits: number; played: number; measured?: boolean }
        | undefined;
      const paired =
        stat && stat.played > 0 && stat.measured !== false
          ? { ratePct: Math.round((stat.hits / stat.played) * 100), sample: `${stat.hits}/${stat.played}` }
          : { ratePct: null, sample: null };
      const bestOdds = await bestPriceForRow(row, kind, locale, country);
      return {
        matchId: row.matchId,
        kickoffTime: row.kickoffTime,
        timeLabel: timeLabelFor(row),
        home: row.homeTeam,
        away: row.awayTeam,
        homeImage: row.homeImage ?? null,
        awayImage: row.awayImage ?? null,
        league: row.competition,
        countryCode: row.countryCode ?? null,
        marketKind: kind,
        marketLabel: marketForListKind(kind).label,
        ratePct: paired.ratePct,
        sample: paired.sample,
        form: formFromHistory(detail, kind),
        bestOdds,
        /* The real price always wins; the ghost stands in only for silence. */
        fallbackOdds: bestOdds ? null : fallbackFor(row, kind),
        isLive: Boolean(row.isLive),
      } satisfies TableRow;
    })
  );

  // Re-sort the enriched slice by the pair the reader actually sees.
  if (sort === "rate") {
    rows.sort((a, b) => (b.ratePct ?? -1) - (a.ratePct ?? -1) || a.kickoffTime - b.kickoffTime);
  }
  return { rows, totalRows };
}

/* ── the live strip ────────────────────────────────────────────────────── */

export type LiveStripItem = {
  matchId: number;
  label: string;
  minute: string | null;
};

/**
 * Live rows, only when the payload is fresh from the provider. A replayed
 * snapshot has frozen minutes — publishing them fabricates a present-tense
 * claim (the fixed live path; incident 2026-08-01).
 */
export function buildLiveStrip(lists: DailyMatchLists): LiveStripItem[] {
  if (lists.provenance?.source !== "fresh_provider") return [];
  const seen = new Set<number>();
  const items: LiveStripItem[] = [];
  for (const row of [...lists.fh, ...lists.over15, ...lists.over25, ...lists.sh]) {
    if (!row.isLive || seen.has(row.matchId)) continue;
    seen.add(row.matchId);
    items.push({
      matchId: row.matchId,
      label: `${row.homeTeam} ${row.homeScore}–${row.awayScore} ${row.awayTeam}`,
      minute: row.minute > 0 ? `${row.minute}′` : null,
    });
  }
  return items.slice(0, 4);
}
