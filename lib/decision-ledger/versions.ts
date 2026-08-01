import { LEDGER_SCHEMA_VERSION } from "./contracts";

export const PUBLICATION_SNAPSHOT_VERSION = "26.0.0";
export const BUILDER_SNAPSHOT_VERSION = "26.0.0";
export const COMBINATION_SETTLEMENT_RULE_VERSION = "26.0.0";
export const CONFIDENCE_NORMALIZATION_VERSION = "24.0.0-pct100";

export function currentSchemaVersion(): string {
  return LEDGER_SCHEMA_VERSION;
}
