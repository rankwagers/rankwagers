import type { NextRequest } from "next/server";
import { handleCronPost } from "@/lib/jobs/cronHandler";
import { runOddsRefreshJob } from "@/lib/jobs/runner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  return handleCronPost(req, () => runOddsRefreshJob());
}
