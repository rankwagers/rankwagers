import type { NextRequest } from "next/server";
import { handleCronPost } from "@/lib/jobs/cronHandler";
import { runCleanupJob } from "@/lib/jobs/runner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const dryRun = req.headers.get("x-cron-dry-run") === "1";
  return handleCronPost(req, () => runCleanupJob({ dryRun }));
}
