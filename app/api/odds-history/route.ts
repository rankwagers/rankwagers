import { NextRequest, NextResponse } from "next/server";
import { rangeToWindow } from "@/lib/odds-history/chartSeries";
import { queryOddsHistory } from "@/lib/odds-history/service";
import type { OddsChartRange } from "@/lib/odds-history/types";

export const dynamic = "force-dynamic";

const RANGES = new Set<OddsChartRange>(["24h", "12h", "6h", "1h", "live"]);

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const fixtureIdRaw = params.get("fixtureId");
  const fixtureId = fixtureIdRaw ? Number(fixtureIdRaw) : undefined;
  if (fixtureIdRaw && (!Number.isSafeInteger(fixtureId) || (fixtureId ?? 0) <= 0)) {
    return NextResponse.json({ error: "Invalid fixtureId" }, { status: 400 });
  }

  const operatorIdRaw = params.get("operatorId");
  const operatorId = operatorIdRaw ? Number(operatorIdRaw) : undefined;
  if (operatorIdRaw && (!Number.isSafeInteger(operatorId) || (operatorId ?? 0) <= 0)) {
    return NextResponse.json({ error: "Invalid operatorId" }, { status: 400 });
  }

  const market = params.get("market")?.slice(0, 32) || undefined;
  const league = params.get("league")?.slice(0, 120) || undefined;
  const rangeParam = params.get("range") as OddsChartRange | null;
  const range = rangeParam && RANGES.has(rangeParam) ? rangeParam : undefined;
  const window = range ? rangeToWindow(range) : null;

  const from = params.get("from") || window?.from;
  const to = params.get("to") || window?.to;
  const limitRaw = params.get("limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;

  const records = await queryOddsHistory({
    fixtureId,
    operatorId,
    market,
    league,
    from: from || undefined,
    to: to || undefined,
    limit: Number.isFinite(limit) ? limit : undefined,
  });

  return NextResponse.json({
    records,
    meta: {
      fixtureId: fixtureId ?? null,
      operatorId: operatorId ?? null,
      market: market ?? null,
      league: league ?? null,
      range: range ?? null,
      from: from ?? null,
      to: to ?? null,
      count: records.length,
    },
  });
}
