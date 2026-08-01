/**
 * Read-time integrity verification for evidence history.
 *
 * The archive is append-only by contract, but a contract that cannot be checked is a
 * hope. These functions re-derive each row's hash and re-walk the chain so a page,
 * an API response or a test can state — not assume — that history was not rewritten.
 *
 * Node-only: hashing pulls in `node:crypto`.
 */

import type { EvidenceSnapshot } from "@/types/evidence";
import { verifyEvidenceContentHash } from "./hash";
import { evidenceSnapshotId } from "./identifiers";
import { evidenceSnapshotBody } from "./snapshot";

export type IntegrityIssueCode =
  | "content_hash_mismatch"
  | "identifier_mismatch"
  | "sequence_gap"
  | "sequence_duplicate"
  | "chain_broken"
  | "timestamp_regression"
  | "fixture_mismatch";

export type IntegrityIssue = {
  code: IntegrityIssueCode;
  snapshotId: string;
  message: string;
};

export type IntegrityReport = {
  verified: boolean;
  checked: number;
  issues: IntegrityIssue[];
};

/** A single row is intact when its stored hash matches a recomputation of its body. */
export function verifySnapshotIntegrity(snapshot: EvidenceSnapshot): boolean {
  return verifyEvidenceContentHash(
    evidenceSnapshotBody(snapshot),
    snapshot.contentHash
  );
}

/** The id is derived, so a mismatch means the coordinates were altered after minting. */
export function verifySnapshotIdentifier(snapshot: EvidenceSnapshot): boolean {
  return (
    snapshot.id ===
    evidenceSnapshotId({
      fixtureId: snapshot.fixtureId,
      capturedAt: snapshot.capturedAt,
      sequence: snapshot.sequence,
    })
  );
}

/**
 * Verify an ordered stream for one fixture.
 *
 * Expects ascending `sequence`. Checks per-row hashes and identifiers, then that the
 * sequence is dense from 1, that each row's `previousSnapshotId` points at its actual
 * predecessor, and that capture time never moves backwards.
 */
export function verifyEvidenceChain(
  snapshots: EvidenceSnapshot[]
): IntegrityReport {
  const issues: IntegrityIssue[] = [];
  const ordered = [...snapshots].sort((a, b) => a.sequence - b.sequence);
  const seenSequences = new Set<number>();
  const fixtureId = ordered[0]?.fixtureId ?? null;

  ordered.forEach((snapshot, index) => {
    if (!verifySnapshotIntegrity(snapshot)) {
      issues.push({
        code: "content_hash_mismatch",
        snapshotId: snapshot.id,
        message: `contentHash does not match body for ${snapshot.id}`,
      });
    }
    if (!verifySnapshotIdentifier(snapshot)) {
      issues.push({
        code: "identifier_mismatch",
        snapshotId: snapshot.id,
        message: `id is not derivable from fixtureId/capturedAt/sequence for ${snapshot.id}`,
      });
    }
    if (fixtureId !== null && snapshot.fixtureId !== fixtureId) {
      issues.push({
        code: "fixture_mismatch",
        snapshotId: snapshot.id,
        message: `expected fixture ${fixtureId}, got ${snapshot.fixtureId}`,
      });
    }
    if (seenSequences.has(snapshot.sequence)) {
      issues.push({
        code: "sequence_duplicate",
        snapshotId: snapshot.id,
        message: `duplicate sequence ${snapshot.sequence}`,
      });
    }
    seenSequences.add(snapshot.sequence);

    if (snapshot.sequence !== index + 1) {
      issues.push({
        code: "sequence_gap",
        snapshotId: snapshot.id,
        message: `expected sequence ${index + 1}, got ${snapshot.sequence}`,
      });
    }

    const previous = index > 0 ? ordered[index - 1] : null;
    const expectedPrevious = previous ? previous.id : null;
    if (snapshot.previousSnapshotId !== expectedPrevious) {
      issues.push({
        code: "chain_broken",
        snapshotId: snapshot.id,
        message: `previousSnapshotId ${String(
          snapshot.previousSnapshotId
        )} does not match predecessor ${String(expectedPrevious)}`,
      });
    }
    if (
      previous &&
      Date.parse(snapshot.capturedAt) < Date.parse(previous.capturedAt)
    ) {
      issues.push({
        code: "timestamp_regression",
        snapshotId: snapshot.id,
        message: `capturedAt ${snapshot.capturedAt} precedes predecessor ${previous.capturedAt}`,
      });
    }
  });

  return { verified: issues.length === 0, checked: ordered.length, issues };
}
