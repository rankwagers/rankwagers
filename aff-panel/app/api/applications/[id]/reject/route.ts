import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/apiAuth";
import { readSettings } from "@/lib/settings";
import { sendTelegramMessage } from "@/lib/telegram";
import { getApplication, updateApplication } from "@/lib/vipStore";

export const dynamic = "force-dynamic";

type Body = { reason?: string };

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const app = getApplication(params.id);
  if (!app) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (app.status !== "pending_review") {
    return NextResponse.json(
      { error: `Already ${app.status}` },
      { status: 400 }
    );
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    body = {};
  }

  const reason = (body.reason || "").trim();
  if (!reason) {
    return NextResponse.json({ error: "Reason is required" }, { status: 400 });
  }

  const settings = readSettings();
  const message = `${settings.rejectMessagePrefix}\n\nReason:\n${reason}`;

  const sent = await sendTelegramMessage(app.telegram_user_id, message);
  if (!sent.ok) {
    return NextResponse.json(
      { error: sent.error || "Telegram send failed" },
      { status: 502 }
    );
  }

  const updated = updateApplication(params.id, {
    status: "rejected",
    reviewed_at: new Date().toISOString(),
    reject_reason: reason,
  });

  return NextResponse.json({ application: updated });
}
