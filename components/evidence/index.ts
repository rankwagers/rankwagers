/**
 * Sprint 23 evidence archive component registry.
 *
 * | Component                    | Boundary | Purpose                                        |
 * | ---------------------------- | -------- | ---------------------------------------------- |
 * | EvidenceHistorySection       | server   | Fixture-page section; loads, projects, composes |
 * | EvidenceHistoryTable         | client   | Full timeline, per-row disclosure, key nav      |
 * | EvidenceSnapshotCard         | client   | One snapshot in detail, with its validations    |
 * | EvidenceHistoryTracker       | client   | Fires `evidence_history_viewed`                 |
 * | ValidationBadge              | neutral  | Validation outcome, revision-aware              |
 * | EvidenceQualificationBadge   | neutral  | Qualification as stored at capture time         |
 * | EvidenceVersion              | neutral  | Model / schema / content-hash stamp             |
 *
 * "neutral" = no `"use client"` and no hooks, so it renders on either side of the
 * boundary. Importing this barrel from a Client Component would pull the server section
 * (and with it `fs` and `node:crypto`) into the bundle — import the leaf modules there.
 */

export { EvidenceHistorySection } from "./EvidenceHistorySection";
export { EvidenceHistoryTable } from "./EvidenceHistoryTable";
export { EvidenceHistoryTracker } from "./EvidenceHistoryTracker";
export { EvidenceQualificationBadge } from "./EvidenceQualificationBadge";
export { EvidenceSnapshotCard } from "./EvidenceSnapshotCard";
export { EvidenceVersion } from "./EvidenceVersion";
export { ValidationBadge } from "./ValidationBadge";
