import type { MarketDefinition, MarketEvidenceIndicator, MarketEvidenceMetricId } from "./types";

const INDICATORS: Record<
  MarketEvidenceMetricId,
  { label: string; description: string }
> = {
  goal_frequency: {
    label: "Goal frequency",
    description:
      "How often matches or teams produce enough goals for the market line, using provider season samples when available.",
  },
  btts_rate: {
    label: "BTTS %",
    description:
      "Share of matches where both teams scored, used as context for both-teams markets.",
  },
  xg_environment: {
    label: "xG indicators",
    description:
      "Expected-goals style environment metrics when FootyStats coverage includes them — never invented.",
  },
  league_baseline: {
    label: "League baseline",
    description:
      "League-level outcome rates used as a baseline against team-specific samples.",
  },
  home_away_split: {
    label: "Home / Away splits",
    description:
      "Venue-specific rates so home and away samples are not mixed without disclosure.",
  },
  sample_quality: {
    label: "Sample quality",
    description:
      "Whether the underlying match counts are very limited, limited, or adequate for interpretation.",
  },
};

export function buildEvidenceIndicators(
  market: MarketDefinition
): MarketEvidenceIndicator[] {
  return market.evidenceMetrics.map((id) => ({
    id,
    label: INDICATORS[id].label,
    description: INDICATORS[id].description,
    // Educational markets still list indicators; live values appear on fixture evidence panels.
    available: Boolean(market.listKind) || id === "sample_quality" || id === "btts_rate",
  }));
}
