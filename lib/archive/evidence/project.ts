/**
 * Projection: raw evidence history → presentation-ready view model (Sprint 23).
 *
 * One-way. The view is what React and the internal APIs consume; it is never written
 * back to the archive. Anything the UI shows is derived here so components stay dumb
 * and the same numbers appear in the HTML, the JSON API and the tests.
 *
 * Node-only: integrity verification pulls in `node:crypto`.
 */

import type {
  EvidenceHistory,
  EvidenceHistoryEmptyReason,
  EvidenceHistoryView,
  EvidenceSnapshot,
  EvidenceSnapshotView,
  ValidationRecord,
  ValidationRevisionView,
  ValidationSubjectView,
} from "@/types/evidence";
import { verifySnapshotIntegrity } from "@/lib/evidence/integrity";
import {
  bestOddsLabel,
  formatCapturedAt,
  operatorAvailabilityLabel,
  shortHash,
} from "@/lib/evidence/presentation";
import { qualificationLabel } from "@/lib/evidence/qualification";
import { evidenceScoreBand, evidenceScoreDelta } from "@/lib/evidence/score";
import { currentValidationRevisions, revisionsOf } from "@/lib/validation/records";
import { validationStateLabel } from "@/lib/validation/states";

export type ProjectEvidenceHistoryOptions = {
  locale?: string;
  /** Set when the archive could not be reached — drives the empty-state copy. */
  unavailable?: boolean;
};

function projectRevision(
  record: ValidationRecord,
  isCurrent: boolean,
  locale: string
): ValidationRevisionView {
  return {
    revisionId: record.revisionId,
    revision: record.revision,
    state: record.state,
    stateLabel: validationStateLabel(record.state),
    reasonCode: record.reasonCode,
    note: record.note,
    recordedAt: record.recordedAt,
    recordedAtLabel: formatCapturedAt(record.recordedAt, locale),
    settledAt: record.settledAt,
    isCurrent,
    supersedesRevisionId: record.supersedesRevisionId,
  };
}

function projectValidationSubjects(
  validations: ValidationRecord[],
  snapshotId: string,
  locale: string
): ValidationSubjectView[] {
  const forSnapshot = validations.filter(
    (record) => record.snapshotId === snapshotId
  );
  const current = currentValidationRevisions(forSnapshot);

  return [...current.values()]
    .sort((a, b) =>
      a.marketKey === b.marketKey
        ? a.selectionKey.localeCompare(b.selectionKey)
        : a.marketKey.localeCompare(b.marketKey)
    )
    .map((head) => {
      const all = revisionsOf(forSnapshot, head.id);
      return {
        id: head.id,
        snapshotId: head.snapshotId,
        marketKey: head.marketKey,
        selectionKey: head.selectionKey,
        current: projectRevision(head, true, locale),
        revisions: all.map((record) =>
          projectRevision(record, record.revisionId === head.revisionId, locale)
        ),
        corrected: all.length > 1,
      };
    });
}

function projectSnapshot(input: {
  snapshot: EvidenceSnapshot;
  previous: EvidenceSnapshot | null;
  validations: ValidationRecord[];
  locale: string;
}): EvidenceSnapshotView {
  const { snapshot, previous, validations, locale } = input;
  const signals = snapshot.signals;

  return {
    id: snapshot.id,
    sequence: snapshot.sequence,
    capturedAt: snapshot.capturedAt,
    capturedAtLabel: formatCapturedAt(snapshot.capturedAt, locale),
    evidenceScore: snapshot.evidenceScore,
    scoreBand: evidenceScoreBand(snapshot.evidenceScore),
    scoreDelta: previous
      ? evidenceScoreDelta(snapshot.evidenceScore, previous.evidenceScore)
      : null,
    qualification: snapshot.qualification,
    qualificationLabel: qualificationLabel(snapshot.qualification),
    status: snapshot.status,
    modelVersion: snapshot.modelVersion,
    schemaVersion: snapshot.schemaVersion,
    contentHash: snapshot.contentHash,
    contentHashShort: shortHash(snapshot.contentHash),
    previousSnapshotId: snapshot.previousSnapshotId,
    supportedMarketCount: snapshot.supportedMarkets.length,
    signalCount: signals.length,
    supportingSignalCount: signals.filter((s) => s.direction === "supporting").length,
    opposingSignalCount: signals.filter((s) => s.direction === "opposing").length,
    operatorAvailabilityLabel: operatorAvailabilityLabel(
      snapshot.operatorAvailability
    ),
    bestOddsLabel: bestOddsLabel(snapshot.bestOddsSnapshot),
    validations: projectValidationSubjects(validations, snapshot.id, locale),
    integrityVerified: verifySnapshotIntegrity(snapshot),
  };
}

/** Empty view for fixtures with no archived evidence. Never throws, never `null`. */
export function emptyEvidenceHistoryView(
  fixtureId: number,
  emptyReason: EvidenceHistoryEmptyReason
): EvidenceHistoryView {
  return {
    fixtureId,
    available: false,
    emptyReason,
    snapshots: [],
    latest: null,
    modelVersions: [],
    totalSnapshots: 0,
    totalValidations: 0,
    correctedValidations: 0,
    firstCapturedAt: null,
    lastCapturedAt: null,
    integrityVerified: true,
  };
}

export function projectEvidenceHistory(
  history: EvidenceHistory,
  options: ProjectEvidenceHistoryOptions = {}
): EvidenceHistoryView {
  const locale = options.locale ?? "en";

  if (options.unavailable) {
    return emptyEvidenceHistoryView(history.fixtureId, "archive_unavailable");
  }
  if (!history.snapshots.length) {
    return emptyEvidenceHistoryView(history.fixtureId, "no_snapshots");
  }

  const ascending = [...history.snapshots].sort((a, b) => a.sequence - b.sequence);
  const views = ascending.map((snapshot, index) =>
    projectSnapshot({
      snapshot,
      previous: index > 0 ? ascending[index - 1] : null,
      validations: history.validations,
      locale,
    })
  );

  // Timeline renders newest first; `latest` is the head of the ascending stream.
  const descending = [...views].reverse();
  const latest = views[views.length - 1] ?? null;

  const modelVersions = [
    ...new Set(descending.map((view) => view.modelVersion)),
  ];
  const correctedValidations = [
    ...currentValidationRevisions(history.validations).values(),
  ].filter((record) => record.revision > 1).length;

  return {
    fixtureId: history.fixtureId,
    available: true,
    emptyReason: null,
    snapshots: descending,
    latest,
    modelVersions,
    totalSnapshots: views.length,
    totalValidations: currentValidationRevisions(history.validations).size,
    correctedValidations,
    firstCapturedAt: ascending[0]?.capturedAt ?? null,
    lastCapturedAt: ascending[ascending.length - 1]?.capturedAt ?? null,
    integrityVerified: views.every((view) => view.integrityVerified),
  };
}
