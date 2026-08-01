import { randomBytes } from "node:crypto";

/**
 * Candidate identity (Sprint 20B-A).
 *
 * candidateId identifies one explicit candidate *creation event*, not the data it came
 * from. It is therefore random, never derived from the payload: two candidates created
 * from byte-identical source data must still receive different ids. This is the opposite
 * of `snapshotId` (`lib/combo/prepared.ts`), which is a content hash and collides across
 * generations over the same data — it must never be used as candidate identity.
 *
 * Format: `bpc_` + 32 lowercase hex characters (128 bits of CSPRNG entropy).
 * Contains no secrets, no personal data, no internal paths and no sequence information.
 */

export const CANDIDATE_ID_PREFIX = "bpc_";
const CANDIDATE_ID_ENTROPY_BYTES = 16;
const CANDIDATE_ID_RE = /^bpc_[0-9a-f]{32}$/;

export function mintCandidateId(): string {
  return `${CANDIDATE_ID_PREFIX}${randomBytes(CANDIDATE_ID_ENTROPY_BYTES).toString("hex")}`;
}

export function isCandidateId(value: unknown): value is string {
  return typeof value === "string" && CANDIDATE_ID_RE.test(value);
}
