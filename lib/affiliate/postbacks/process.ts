import {
  getAttributionStore,
  hashReference,
  type AffiliateConversionRecord,
} from "@/lib/combo/attribution";
import { randomBytes } from "node:crypto";
import { recordPostbackEvent } from "./events";
import { normalizePostbackPayload } from "./normalize";
import { getPostbackAdapter } from "./registry";
import type { PostbackProcessResult } from "./types";
import { verifyPostbackRequest } from "./verify";

export async function processAffiliatePostback(input: {
  operatorSlug: string;
  body: Record<string, unknown>;
  rawBody: string;
  headers: Headers;
  clientIp?: string;
}): Promise<PostbackProcessResult> {
  const adapter = getPostbackAdapter(input.operatorSlug);
  if (!adapter) {
    await recordPostbackEvent({
      operatorId: input.operatorSlug,
      eventType: "postback",
      status: "rejected",
      reason: "invalid_operator",
      rawReferenceHash: hashReference(input.rawBody.slice(0, 2048)),
    });
    return { status: "rejected", reason: "invalid_operator" };
  }
  if (adapter.status !== "configured") {
    await recordPostbackEvent({
      operatorId: adapter.operatorId,
      eventType: "postback",
      status: "not_configured",
      reason: "Postback adapter is not configured for this operator",
      rawReferenceHash: hashReference(input.rawBody.slice(0, 2048)),
    });
    return {
      status: "not_configured",
      reason: "Postback adapter is not configured for this operator",
    };
  }

  const verified = verifyPostbackRequest({
    adapter,
    headers: input.headers,
    rawBody: input.rawBody,
    clientIp: input.clientIp,
  });
  if (!verified.ok) {
    await recordPostbackEvent({
      operatorId: adapter.operatorId,
      eventType: "postback",
      status: "rejected",
      reason: verified.reason,
      rawReferenceHash: hashReference(input.rawBody.slice(0, 2048)),
    });
    return { status: "rejected", reason: verified.reason };
  }

  const normalized = normalizePostbackPayload({
    adapter,
    body: input.body,
  });
  if (!normalized.ok) {
    await recordPostbackEvent({
      operatorId: adapter.operatorId,
      eventType: "postback",
      status: "rejected",
      reason: normalized.reason,
      rawReferenceHash: hashReference(input.rawBody.slice(0, 2048)),
    });
    return { status: "rejected", reason: normalized.reason };
  }

  const store = getAttributionStore();
  let attributed = false;
  if (normalized.value.clickId) {
    const click = await store.getClick(normalized.value.clickId);
    attributed = Boolean(click);
  }

  const conversionId = `cnv_${randomBytes(10).toString("hex")}`;
  const record: AffiliateConversionRecord = {
    conversionId,
    operatorId: adapter.operatorId,
    clickId: normalized.value.clickId,
    externalTransactionId: normalized.value.externalTransactionId,
    type: normalized.value.type,
    amount: normalized.value.amount,
    currency: normalized.value.currency,
    occurredAt: normalized.value.occurredAt,
    receivedAt: new Date().toISOString(),
    status: "accepted",
    attributed,
    // Hash only — raw payload retention off by default
    rawReferenceHash: hashReference(input.rawBody.slice(0, 2048)),
  };

  const saved = await store.createConversion(record);
  if (!saved.created || saved.record.status === "duplicate") {
    await recordPostbackEvent({
      operatorId: adapter.operatorId,
      eventType: record.type,
      clickId: record.clickId,
      externalTransactionId: record.externalTransactionId,
      status: "duplicate",
      rawReferenceHash: record.rawReferenceHash,
    });
    return {
      status: "duplicate",
      conversionId: saved.record.conversionId,
    };
  }

  await recordPostbackEvent({
    operatorId: adapter.operatorId,
    eventType: record.type,
    clickId: record.clickId,
    externalTransactionId: record.externalTransactionId,
    status: "accepted",
    rawReferenceHash: record.rawReferenceHash,
  });

  return {
    status: "accepted",
    conversionId: saved.record.conversionId,
    attributed,
  };
}
