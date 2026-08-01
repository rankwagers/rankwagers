import type { FootyMatchRow } from "@/lib/footystats/types";
import { apiFootballGet } from "./request";

function norm(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function teamsMatch(home: string, away: string, fHome: string, fAway: string): boolean {
  const a = norm(home);
  const b = norm(away);
  const fh = norm(fHome);
  const fa = norm(fAway);
  if (!a || !b || !fh || !fa) return false;
  const homeOk = a === fh || a.includes(fh) || fh.includes(a) || a.slice(0, 5) === fh.slice(0, 5);
  const awayOk = b === fa || b.includes(fa) || fa.includes(b) || b.slice(0, 5) === fa.slice(0, 5);
  return homeOk && awayOk;
}

type ApiFixture = {
  fixture: { status: { short: string; elapsed: number | null } };
  teams: { home: { name: string; logo: string }; away: { name: string; logo: string } };
  goals: { home: number | null; away: number | null };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
  };
};

export function getApiFootballKey(): string | undefined {
  return process.env.API_FOOTBALL_KEY?.trim() || undefined;
}

export async function enrichRowsWithApiFootball(
  rows: FootyMatchRow[],
  date: string
): Promise<void> {
  const key = getApiFootballKey();
  if (!key || rows.length === 0) return;

  try {
    const data = await apiFootballGet<{ response?: ApiFixture[] }>(
      "fixtures",
      { date },
      { operation: "fixture_list" }
    );
    const fixtures = data?.response ?? [];
    if (fixtures.length === 0) return;

    for (const row of rows) {
      const match = fixtures.find((f) =>
        teamsMatch(row.homeTeam, row.awayTeam, f.teams.home.name, f.teams.away.name)
      );
      if (!match) continue;

      if (!row.homeImage && match.teams.home.logo) {
        row.homeImage = match.teams.home.logo;
      }
      if (!row.awayImage && match.teams.away.logo) {
        row.awayImage = match.teams.away.logo;
      }

      const ht = match.score?.halftime;
      if (ht?.home != null && ht?.away != null) {
        row.htHome = ht.home;
        row.htAway = ht.away;
        row.htGoalCount = ht.home + ht.away;
      }

      const ft = match.score?.fulltime;
      const st = match.fixture.status.short;
      if (st === "FT" || st === "AET" || st === "PEN") {
        row.isFinished = true;
        row.isLive = false;
        if (ft?.home != null && ft?.away != null) {
          row.homeScore = ft.home;
          row.awayScore = ft.away;
        } else if (match.goals.home != null && match.goals.away != null) {
          row.homeScore = match.goals.home;
          row.awayScore = match.goals.away;
        }
        row.status = "complete";
      } else if (["1H", "HT", "2H", "LIVE"].includes(st)) {
        row.isLive = true;
        row.status = st === "1H" ? "1H" : st === "2H" ? "2H" : "live";
        if (match.goals.home != null && match.goals.away != null) {
          row.homeScore = match.goals.home;
          row.awayScore = match.goals.away;
        }
        row.minute = match.fixture.status.elapsed ?? row.minute;
      }
    }
  } catch {
    /* enrichment optional */
  }
}

export async function enrichAllLists(
  lists: {
    over15: FootyMatchRow[];
    fh: FootyMatchRow[];
    over25: FootyMatchRow[];
    sh: FootyMatchRow[];
  },
  date: string
): Promise<void> {
  const seen = new Map<number, FootyMatchRow>();
  for (const arr of [lists.over15, lists.fh, lists.over25, lists.sh]) {
    for (const r of arr) {
      if (!seen.has(r.matchId)) seen.set(r.matchId, r);
    }
  }
  const unique = [...seen.values()];
  await enrichRowsWithApiFootball(unique, date);
}
