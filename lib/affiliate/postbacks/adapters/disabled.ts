import type { PostbackAdapterDefinition } from "../types";

export function disabledAdapter(operatorId: string): PostbackAdapterDefinition {
  return {
    operatorId,
    status: "not_configured",
    authMethod: "none",
    expectedFields: [
      "click_id",
      "transaction_id",
      "type",
      "amount",
      "currency",
      "timestamp",
    ],
    clickIdField: "click_id",
    conversionTypeField: "type",
    amountField: "amount",
    currencyField: "currency",
    transactionIdField: "transaction_id",
    timestampField: "timestamp",
    dedupeKeyFields: ["transaction_id"],
    notes:
      "Disabled until partner postback specification and credentials are supplied.",
  };
}
