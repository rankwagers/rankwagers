import { NextResponse } from "next/server";
import { getDailyMatchListsSafe } from "@/lib/footystats/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date")?.trim() ?? undefined;
  const result = await getDailyMatchListsSafe(date);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json(result);
}
