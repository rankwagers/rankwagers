import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Liveness — process is up. No dependency checks. */
export async function GET() {
  return NextResponse.json(
    { status: "ok" },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "x-robots-tag": "noindex, nofollow",
      },
    }
  );
}
