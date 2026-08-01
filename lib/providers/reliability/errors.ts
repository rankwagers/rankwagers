import type { ProviderErrorCode, ProviderName, ProviderOperation } from "./types";

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly provider: ProviderName;
  readonly operation: ProviderOperation;
  readonly publicMessage: string;
  readonly retryable: boolean;
  readonly status?: number;
  readonly details?: Record<string, string | number | boolean | null>;

  constructor(input: {
    code: ProviderErrorCode;
    provider: ProviderName;
    operation: ProviderOperation;
    message: string;
    publicMessage?: string;
    retryable?: boolean;
    status?: number;
    details?: Record<string, string | number | boolean | null>;
    cause?: unknown;
  }) {
    super(input.message, { cause: input.cause });
    this.name = "ProviderError";
    this.code = input.code;
    this.provider = input.provider;
    this.operation = input.operation;
    this.publicMessage =
      input.publicMessage ?? publicMessageForCode(input.code);
    this.retryable = input.retryable ?? isRetryableCode(input.code);
    this.status = input.status;
    this.details = sanitizeDetails(input.details);
  }
}

export function publicMessageForCode(code: ProviderErrorCode): string {
  switch (code) {
    case "timeout":
      return "Upstream data provider timed out";
    case "rate_limited":
      return "Upstream data provider is rate limited";
    case "quota_exhausted":
      return "Upstream data provider quota is exhausted";
    case "authentication":
      return "Upstream data provider authentication failed";
    case "circuit_open":
      return "Upstream data provider temporarily unavailable";
    case "stale_data":
      return "Upstream data is stale";
    default:
      return "Upstream data provider unavailable";
  }
}

export function isRetryableCode(code: ProviderErrorCode): boolean {
  return (
    code === "timeout" ||
    code === "network" ||
    code === "upstream_5xx" ||
    code === "rate_limited"
  );
}

function sanitizeDetails(
  details?: Record<string, string | number | boolean | null>
): Record<string, string | number | boolean | null> | undefined {
  if (!details) return undefined;
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(details)) {
    if (/(secret|key|token|authorization|password|cookie)/i.test(key)) {
      out[key] = "[REDACTED]";
      continue;
    }
    if (typeof value === "string" && value.length > 240) {
      out[key] = `${value.slice(0, 240)}…`;
      continue;
    }
    out[key] = value;
  }
  return out;
}

export function classifyHttpStatus(status: number): {
  code: ProviderErrorCode;
  retryable: boolean;
} {
  if (status === 401 || status === 403) {
    return { code: "authentication", retryable: false };
  }
  if (status === 400 || status === 404 || status === 422) {
    return { code: "invalid_request", retryable: false };
  }
  if (status === 429) {
    return { code: "rate_limited", retryable: true };
  }
  if (status >= 500) {
    return { code: "upstream_5xx", retryable: true };
  }
  return { code: "unavailable", retryable: false };
}

export function classifyThrown(err: unknown): {
  code: ProviderErrorCode;
  retryable: boolean;
  message: string;
} {
  if (err instanceof ProviderError) {
    return {
      code: err.code,
      retryable: err.retryable,
      message: err.message,
    };
  }
  if (err instanceof Error) {
    const name = err.name.toLowerCase();
    const msg = err.message.toLowerCase();
    if (name === "aborterror" || msg.includes("aborted") || msg.includes("timeout")) {
      return { code: "timeout", retryable: true, message: err.message };
    }
    if (
      msg.includes("econnreset") ||
      msg.includes("enotfound") ||
      msg.includes("econnrefused") ||
      msg.includes("network") ||
      msg.includes("fetch failed")
    ) {
      return { code: "network", retryable: true, message: err.message };
    }
    return { code: "unknown", retryable: false, message: err.message };
  }
  return { code: "unknown", retryable: false, message: "Unknown provider error" };
}
