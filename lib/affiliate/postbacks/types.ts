export type AffiliateConversionType =
  | "registration"
  | "first_deposit"
  | "qualified_ftd"
  | "revenue"
  | "rejected"
  | "chargeback";

export type PostbackAuthMethod =
  | "none"
  | "shared_secret"
  | "hmac_signature"
  | "allowlisted_ip";

export type PostbackAdapterStatus = "disabled" | "not_configured" | "configured";

export type PostbackAdapterDefinition = {
  operatorId: string;
  status: PostbackAdapterStatus;
  authMethod: PostbackAuthMethod;
  expectedFields: string[];
  clickIdField?: string;
  conversionTypeField?: string;
  amountField?: string;
  currencyField?: string;
  transactionIdField?: string;
  timestampField?: string;
  dedupeKeyFields?: string[];
  notes?: string;
};

export type NormalizedPostback = {
  operatorId: string;
  clickId?: string;
  externalTransactionId?: string;
  type: AffiliateConversionType;
  amount?: number;
  currency?: string;
  occurredAt: string;
};

export type PostbackProcessResult =
  | {
      status: "accepted";
      conversionId: string;
      attributed: boolean;
    }
  | {
      status: "duplicate";
      conversionId: string;
    }
  | {
      status: "rejected";
      reason: string;
    }
  | {
      status: "not_configured";
      reason: string;
    };
