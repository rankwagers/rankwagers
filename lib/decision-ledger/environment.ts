import type { LedgerEnvironment } from "./contracts";

export function resolveLedgerEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): LedgerEnvironment {
  if (env.NODE_ENV === "test") return "TEST";
  const app = (env.APP_ENV || "").trim().toLowerCase();
  if (app === "staging") return "STAGING";
  if (app === "production") return "PRODUCTION";
  if (app === "test") return "TEST";
  return "LOCAL";
}
