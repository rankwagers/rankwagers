import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/apiAuth";
import { readSettings, renderApprovalMessage } from "@/lib/settings";
import { sendTelegramMessage } from "@/lib/telegram";
import { getApplication, updateApplication } from "@/lib/vipStore";

export const dynamic = "force-dynamic";

type Body = {
  vipLink?: string;
  messageTemplate?: string;
};

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

  const settings = readSettings();
  const vipLink = (body.vipLink || settings.defaultVipLink).trim();
  const template = body.messageTemplate || settings.approvalMessageTemplate;
  const message = renderApprovalMessage(template, {
    brand: app.brand_name,
    brand_slug: app.brand_slug,
    player_id: app.player_id,
    vip_link: vipLink,
    username: app.username ? `@${app.username}` : "—",
    region: app.region,
  });

  const sent = await sendTelegramMessage(app.telegram_user_id, message);
  if (!sent.ok) {
    return NextResponse.json(
      { error: sent.error || "Telegram send failed" },
      { status: 502 }
    );
  }

  const updated = updateApplication(params.id, {
    status: "approved",
    reviewed_at: new Date().toISOString(),
    approval_message_sent: message,
    reject_reason: null,
  });

  return NextResponse.json({ application: updated });
}
