import type {
  AffiliateConversionType,
  NormalizedPostback,
  PostbackAdapterDefinition,
} from "./types";

const TYPES = new Set<AffiliateConversionType>([
  "registration",
  "first_deposit",
  "qualified_ftd",
  "revenue",
  "rejected",
  "chargeback",
]);

const CURRENCY_RE = /^[A-Z]{3}$/;
const TIMESTAMP_TOLERANCE_MS = 7 * 24 * 60 * 60 * 1000;

export type NormalizeResult =
  | { ok: true; value: NormalizedPostback }
  | { ok: false; reason: string };

function readField(
  body: Record<string, unknown>,
  field?: string
): unknown {
  if (!field) return undefined;
  return body[field];
}

export function normalizePostbackPayload(input: {
  adapter: PostbackAdapterDefinition;
  body: Record<string, unknown>;
  now?: number;
}): NormalizeResult {
  const now = input.now ?? Date.now();
  const typeRaw = String(
    readField(input.body, input.adapter.conversionTypeField) ?? ""
  ).toLowerCase();
  if (!TYPES.has(typeRaw as AffiliateConversionType)) {
    return { ok: false, reason: "unknown_conversion_type" };
  }

  const amountRaw = readField(input.body, input.adapter.amountField);
  let amount: number | undefined;
  if (amountRaw != null && amountRaw !== "") {
    amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount < 0) {
      return { ok: false, reason: "invalid_amount" };
    }
  }

  const currencyRaw = readField(input.body, input.adapter.currencyField);
  let currency: string | undefined;
  if (currencyRaw != null && currencyRaw !== "") {
    currency = String(currencyRaw).toUpperCase();
    if (!CURRENCY_RE.test(currency)) {
      return { ok: false, reason: "invalid_currency" };
    }
  }

  const tsRaw = readField(input.body, input.adapter.timestampField);
  let occurredAt = new Date(now).toISOString();
  if (tsRaw != null && tsRaw !== "") {
    const parsed = Date.parse(String(tsRaw));
    if (!Number.isFinite(parsed)) {
      return { ok: false, reason: "invalid_timestamp" };
    }
    if (Math.abs(now - parsed) > TIMESTAMP_TOLERANCE_MS) {
      return { ok: false, reason: "timestamp_out_of_tolerance" };
    }
    occurredAt = new Date(parsed).toISOString();
  }

  const clickId = readField(input.body, input.adapter.clickIdField);
  const txn = readField(input.body, input.adapter.transactionIdField);

  return {
    ok: true,
    value: {
      operatorId: input.adapter.operatorId,
      clickId: clickId != null ? String(clickId).slice(0, 128) : undefined,
      externalTransactionId:
        txn != null ? String(txn).slice(0, 128) : undefined,
      type: typeRaw as AffiliateConversionType,
      amount,
      currency,
      occurredAt,
    },
  };
}
