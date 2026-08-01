import { NextResponse } from "next/server";
import { getWorldCupBar } from "@/lib/api-football/worldCupBar";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const data = await getWorldCupBar();
    if (!data) {
      return NextResponse.json({ visible: false }, {
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      });
    }
    return NextResponse.json({ visible: true, ...data }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "World Cup bar error";
    return NextResponse.json({ visible: false, error: msg }, { status: 500 });
  }
}
