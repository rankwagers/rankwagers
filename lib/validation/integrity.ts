/**
 * Read-time integrity verification for validation revisions (Sprint 23).
 *
 * Node-only: hashing pulls in `node:crypto`.
 */

import type { ValidationRecord } from "@/types/evidence";
import { verifyEvidenceContentHash } from "@/lib/evidence/hash";
import { validationRevisionId } from "@/lib/evidence/identifiers";
import { canTransition } from "./states";
import { revisionsOf, validationRecordBody } from "./records";

export type ValidationIntegrityIssueCode =
  | "content_hash_mismatch"
  | "revision_id_mismatch"
  | "revision_gap"
  | "revision_duplicate"
  | "chain_broken"
  | "illegal_transition"
  | "timestamp_regression"
  | "missing_correction_note";

export type ValidationIntegrityIssue = {
  code: ValidationIntegrityIssueCode;
  revisionId: string;
  message: string;
};

export type ValidationIntegrityReport = {
  verified: boolean;
  checked: number;
  issues: ValidationIntegrityIssue[];
};

export function verifyValidationRecord(record: ValidationRecord): boolean {
  return verifyEvidenceContentHash(
    validationRecordBody(record),
    record.contentHash
  );
}

/** Verify one logical validation's full revision chain, ascending. */
export function verifyValidationChain(
  records: ValidationRecord[]
): ValidationIntegrityReport {
  const issues: ValidationIntegrityIssue[] = [];
  const ordered = [...records].sort((a, b) => a.revision - b.revision);
  const seen = new Set<number>();

  ordered.forEach((record, index) => {
    if (!verifyValidationRecord(record)) {
      issues.push({
        code: "content_hash_mismatch",
        revisionId: record.revisionId,
        message: `contentHash does not match body for ${record.revisionId}`,
      });
    }
    const expectedRevisionId = validationRevisionId({
      validationId: record.id,
      revision: record.revision,
    });
    if (record.revisionId !== expectedRevisionId) {
      issues.push({
        code: "revision_id_mismatch",
        revisionId: record.revisionId,
        message: `revisionId is not derivable from id/revision for ${record.revisionId}`,
      });
    }
    if (seen.has(record.revision)) {
      issues.push({
        code: "revision_duplicate",
        revisionId: record.revisionId,
        message: `duplicate revision ${record.revision}`,
      });
    }
    seen.add(record.revision);
    if (record.revision !== index + 1) {
      issues.push({
        code: "revision_gap",
        revisionId: record.revisionId,
        message: `expected revision ${index + 1}, got ${record.revision}`,
      });
    }

    const previous = index > 0 ? ordered[index - 1] : null;
    const expectedSupersedes = previous ? previous.revisionId : null;
    if (record.supersedesRevisionId !== expectedSupersedes) {
      issues.push({
        code: "chain_broken",
        revisionId: record.revisionId,
        message: `supersedesRevisionId ${String(
          record.supersedesRevisionId
        )} does not match predecessor ${String(expectedSupersedes)}`,
      });
    }
    if (previous) {
      if (!canTransition(previous.state, record.state)) {
        issues.push({
          code: "illegal_transition",
          revisionId: record.revisionId,
          message: `illegal transition ${previous.state} → ${record.state}`,
        });
      }
      if (Date.parse(record.recordedAt) < Date.parse(previous.recordedAt)) {
        issues.push({
          code: "timestamp_regression",
          revisionId: record.revisionId,
          message: `recordedAt ${record.recordedAt} precedes predecessor ${previous.recordedAt}`,
        });
      }
      if (!record.note || !record.note.trim()) {
        issues.push({
          code: "missing_correction_note",
          revisionId: record.revisionId,
          message: `correction ${record.revisionId} has no note`,
        });
      }
    }
  });

  return { verified: issues.length === 0, checked: ordered.length, issues };
}

/** Verify every logical validation present in a mixed set of revisions. */
export function verifyAllValidationChains(
  records: ValidationRecord[]
): ValidationIntegrityReport {
  const ids = [...new Set(records.map((record) => record.id))];
  const issues: ValidationIntegrityIssue[] = [];
  for (const id of ids) {
    issues.push(...verifyValidationChain(revisionsOf(records, id)).issues);
  }
  return {
    verified: issues.length === 0,
    checked: records.length,
    issues,
  };
}
