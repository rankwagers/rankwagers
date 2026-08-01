import { NextResponse } from "next/server";
import { buildAccaOperatorOffers } from "@/lib/acca/operators.server";
import { isAccaMarketKey } from "@/lib/acca/markets";
import type { AccaSelection } from "@/lib/acca/types";
import { getRequestCountryContext } from "@/lib/personalization/server";

export const dynamic = "force-dynamic";

type Body = {
  locale?: string;
  slipId?: string;
  stake?: number;
  country?: string;
  selections?: Array<{
    matchId?: number;
    marketKey?: string;
    odds?: number | null;
  }>;
};

export async function POST(request: Request) {
  const headers = {
    "cache-control": "no-store",
    "x-robots-tag": "noindex, nofollow",
  };

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers });
  }

  const locale = typeof body.locale === "string" ? body.locale : "en";
  const rows = Array.isArray(body.selections) ? body.selections : [];
  if (!rows.length || rows.length > 8) {
    return NextResponse.json({ error: "invalid_selections" }, { status: 400, headers });
  }

  const now = new Date().toISOString();
  const selections: AccaSelection[] = [];
  for (const s of rows) {
    if (typeof s.matchId !== "number" || typeof s.marketKey !== "string") continue;
    if (!isAccaMarketKey(s.marketKey)) continue;
    selections.push({
      id: `${s.matchId}:${s.marketKey}:default`,
      matchId: s.matchId,
      homeTeam: "",
      awayTeam: "",
      competition: "",
      competitionSlug: null,
      countryCode: null,
      kickoffAt: null,
      marketKey: s.marketKey,
      marketLabel: s.marketKey,
      selectionLabel: "",
      selectionKey: "default",
      odds: s.odds ?? null,
      confidence: null,
      evidenceSummary: [],
      publishedAt: null,
      status: "pending",
      matchHref: "",
      source: "studio",
      addedAt: now,
    });
  }

  if (!selections.length) {
    return NextResponse.json({ error: "unsupported_markets" }, { status: 400, headers });
  }

  const countryContext = getRequestCountryContext(body.country);
  const operators = buildAccaOperatorOffers({
    slip: {
      id: typeof body.slipId === "string" ? body.slipId : "acca_anon",
      locale,
      stake: typeof body.stake === "number" ? body.stake : 10,
      selections,
    },
    country: countryContext.country,
  });

  return NextResponse.json({ operators }, { headers });
}
