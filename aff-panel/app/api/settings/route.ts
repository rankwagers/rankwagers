import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/apiAuth";
import { readSettings, writeSettings } from "@/lib/settings";
import type { VipSettings } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  return NextResponse.json(readSettings());
}

export async function PUT(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const body = (await req.json()) as Partial<VipSettings>;
  const current = readSettings();
  const next: VipSettings = {
    approvalMessageTemplate:
      body.approvalMessageTemplate ?? current.approvalMessageTemplate,
    defaultVipLink: body.defaultVipLink ?? current.defaultVipLink,
    rejectMessagePrefix: body.rejectMessagePrefix ?? current.rejectMessagePrefix,
  };
  writeSettings(next);
  return NextResponse.json(next);
}
