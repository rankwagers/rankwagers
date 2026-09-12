import type { VenueSideStats } from "@/lib/footystats/matchDetail";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";
import { formatDict } from "@/lib/formatDict";

/* ============================================================================
   FIXTURE v3.1 — THE MODEL VIEW'S TEMPLATE REGISTRY (layer 3).

   Every sentence the model view can speak is REGISTERED here: a template
   names its dictionary key, the computed inputs it REQUIRES, and how the
   placeholders fill. A sentence whose input is not computed is omitted
   whole — no template may interpolate a guess, and no free-text sentence
   exists outside this registry (probe-pinned). Ranking claims ("highest in
   the league") are impossible by construction: no template computes a
   league rank, so none may utter one.
   ========================================================================== */

export type ModelViewInputs = {
  homeTeam: string;
  awayTeam: string;
  homeVenue?: VenueSideStats;
  awayVenue?: VenueSideStats;
  leagueAvgGoals?: number;
  /** Home wins at home over the venue history — {wins, n}, n>0 when known. */
  homeWinRecord?: { wins: number; n: number };
};

type Template = {
  key: keyof PredictionStrings;
  /** True only when every input the sentence interpolates is computed. */
  requires: (inputs: ModelViewInputs) => boolean;
  args: (inputs: ModelViewInputs) => Record<string, string>;
};

const avg2 = (value: number) => (Math.round(value * 100) / 100).toString();

export const MODEL_TEMPLATES: readonly Template[] = [
  {
    key: "v3TplHomeGoals",
    requires: ({ homeVenue }) =>
      !!homeVenue &&
      homeVenue.played > 0 &&
      Number.isFinite(homeVenue.scoredAvg) &&
      Number.isFinite(homeVenue.concededAvg),
    args: ({ homeTeam, homeVenue }) => ({
      team: homeTeam,
      avg: avg2(homeVenue!.scoredAvg + homeVenue!.concededAvg),
    }),
  },
  {
    key: "v3TplAwayConceded",
    requires: ({ awayVenue }) =>
      !!awayVenue && awayVenue.played > 0 && Number.isFinite(awayVenue.concededAvg),
    args: ({ awayTeam, awayVenue }) => ({
      team: awayTeam,
      avg: avg2(awayVenue!.concededAvg),
    }),
  },
  {
    key: "v3TplEarlyGoals",
    requires: ({ homeVenue }) => !!homeVenue && (homeVenue.fh05?.played ?? 0) > 0,
    args: ({ homeTeam, homeVenue }) => ({
      pct: String(Math.round((homeVenue!.fh05.hits / homeVenue!.fh05.played) * 100)),
      team: homeTeam,
    }),
  },
  {
    key: "v3TplLeagueGoals",
    requires: ({ leagueAvgGoals }) =>
      Number.isFinite(leagueAvgGoals) && (leagueAvgGoals ?? 0) > 0,
    args: ({ leagueAvgGoals }) => ({ avg: avg2(leagueAvgGoals!) }),
  },
  {
    key: "v3TplResultTight",
    requires: ({ homeWinRecord }) => !!homeWinRecord && homeWinRecord.n > 0,
    args: ({ homeTeam, homeWinRecord }) => ({
      team: homeTeam,
      pct: String(Math.round((homeWinRecord!.wins / homeWinRecord!.n) * 100)),
    }),
  },
];

export type ModelSentence = { key: string; text: string };

/** 2–4 sentences, registry order; below two the section is omitted whole. */
export function modelSentences(
  inputs: ModelViewInputs,
  p: PredictionStrings
): ModelSentence[] {
  const sentences: ModelSentence[] = [];
  for (const template of MODEL_TEMPLATES) {
    if (sentences.length >= 4) break;
    if (!template.requires(inputs)) continue;
    sentences.push({
      key: template.key,
      text: formatDict(p[template.key] as string, template.args(inputs)),
    });
  }
  return sentences.length >= 2 ? sentences : [];
}
