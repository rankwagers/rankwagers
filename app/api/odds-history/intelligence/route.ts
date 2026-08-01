import { NextRequest, NextResponse } from "next/server";
import { buildOddsIntelligence } from "@/lib/odds-history/intelligence";
import { queryOddsHistory } from "@/lib/odds-history/service";
import type { OddsChartRange, OddsChartView } from "@/lib/odds-history/types";

export const dynamic = "force-dynamic";

const RANGES = new Set<OddsChartRange>(["24h", "12h", "6h", "1h", "live"]);
const VIEWS = new Set<OddsChartView>(["decimal", "implied", "percent_change"]);

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const fixtureId = Number(params.get("fixtureId"));
  const market = params.get("market")?.slice(0, 32);

  if (!Number.isSafeInteger(fixtureId) || fixtureId <= 0 || !market) {
    return NextResponse.json({ error: "fixtureId and market are required" }, { status: 400 });
  }

  const rangeParam = (params.get("range") || "24h") as OddsChartRange;
  const viewParam = (params.get("view") || "decimal") as OddsChartView;
  const range = RANGES.has(rangeParam) ? rangeParam : "24h";
  const view = VIEWS.has(viewParam) ? viewParam : "decimal";

  const compare = params
    .get("compare")
    ?.split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isSafeInteger(value) && value > 0);

  const records = await queryOddsHistory({
    fixtureId,
    market,
    limit: 10_000,
  });

  const payload = buildOddsIntelligence({
    fixtureId,
    market,
    records,
    range,
    view,
    compareOperatorIds: compare?.length ? compare : undefined,
  });

  return NextResponse.json(payload);
}
