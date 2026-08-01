import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/apiAuth";
import { listApplications } from "@/lib/vipStore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const status = req.nextUrl.searchParams.get("status");
  const filter =
    status === "pending_review" || status === "approved" || status === "rejected"
      ? status
      : undefined;
  return NextResponse.json({ applications: listApplications(filter) });
}
