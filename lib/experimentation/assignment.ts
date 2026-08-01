import { createHash } from "node:crypto";
import type { ExperimentDefinition, ExperimentVariant } from "./contracts";

/**
 * Deterministic assignment — never Math.random() for persistent bucketing.
 * Hash: sha256(experimentId|assignmentVersion|assignmentKey) → [0,1).
 */
export function assignmentBucket(
  experimentId: string,
  assignmentVersion: string,
  assignmentKey: string,
): number {
  const material = `${experimentId}|${assignmentVersion}|${assignmentKey}`;
  const digest = createHash("sha256").update(material, "utf8").digest();
  // Use first 8 bytes as uint64 fraction
  const n =
    digest.readUInt32BE(0) * 0x100000000 + digest.readUInt32BE(4);
  return (n % 1_000_000_000) / 1_000_000_000;
}

export function trafficBucket(
  experimentId: string,
  assignmentVersion: string,
  assignmentKey: string,
): number {
  // Separate salt so traffic % is independent of variant allocation
  return assignmentBucket(`${experimentId}:traffic`, assignmentVersion, assignmentKey);
}

export function selectVariant(
  definition: ExperimentDefinition,
  assignmentKey: string,
): ExperimentVariant | null {
  const enabled = definition.variants.filter((v) => v.enabled);
  if (enabled.length === 0) return null;
  const total = enabled.reduce((s, v) => s + v.allocationWeight, 0);
  if (total <= 0) return null;
  const u = assignmentBucket(
    definition.id,
    definition.assignmentVersion,
    assignmentKey,
  );
  let cursor = 0;
  for (const v of enabled) {
    cursor += v.allocationWeight / total;
    if (u < cursor) return v;
  }
  return enabled[enabled.length - 1] ?? null;
}

export function isInTrafficPercent(
  definition: ExperimentDefinition,
  assignmentKey: string,
): boolean {
  const pct = Math.max(0, Math.min(100, definition.trafficPercent));
  if (pct >= 100) return true;
  if (pct <= 0) return false;
  const bucket = trafficBucket(
    definition.id,
    definition.assignmentVersion,
    assignmentKey,
  );
  return bucket * 100 < pct;
}
