"use client";

import { useCallback, useId, useState } from "react";
import type { EvidenceSnapshotView } from "@/types/evidence";
import { trackEvidenceArchiveEvent } from "@/lib/evidence/analytics";
import {
  evidenceArchiveTokens,
  formatEvidenceScore,
  formatScoreDelta,
  scoreBandClass,
} from "@/lib/evidence/presentation";
import { evidenceScoreBandLabel } from "@/lib/evidence/score";
import { EvidenceQualificationBadge } from "./EvidenceQualificationBadge";
import { EvidenceVersion } from "./EvidenceVersion";
import { ValidationBadge } from "./ValidationBadge";

/**
 * One archived evidence snapshot (Sprint 23).
 *
 * Client Component: it owns disclosure state and emits analytics. It imports only from
 * `@/lib/evidence/presentation`, `@/lib/evidence/analytics` and `@/types/evidence` —
 * never from the archive barrels, which pull `node:crypto` and `fs` into the bundle.
 *
 * `collapsible={false}` renders the body already open with no toggle, which is how
 * `EvidenceHistoryTable` embeds it inside an expanded row (the row's own button is
 * already the disclosure control — a nested one would be a keyboard trap).
 */
export function EvidenceSnapshotCard({
  snapshot,
  fixtureId,
  locale,
  collapsible = true,
  defaultExpanded = false,
}: {
  snapshot: EvidenceSnapshotView;
  fixtureId: number;
  locale?: string | null;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}) {
  const bodyId = useId();
  const headingId = useId();
  const [expanded, setExpanded] = useState(defaultExpanded || !collapsible);

  const toggle = useCallback(() => {
    setExpanded((previous) => {
      const next = !previous;
      if (next) {
        trackEvidenceArchiveEvent("evidence_snapshot_expanded", {
          fixtureId,
          snapshotId: snapshot.id,
          sequence: snapshot.sequence,
          modelVersion: snapshot.modelVersion,
          qualification: snapshot.qualification,
          locale: locale ?? null,
          interaction: "pointer",
        });
      }
      return next;
    });
  }, [fixtureId, locale, snapshot.id, snapshot.modelVersion, snapshot.qualification, snapshot.sequence]);

  const summary = (
    <div className="flex flex-wrap items-center gap-2">
      <span className={evidenceArchiveTokens.label}>#{snapshot.sequence}</span>
      <span className={evidenceArchiveTokens.value}>
        {formatEvidenceScore(snapshot.evidenceScore)}
      </span>
      <span
        className={`${evidenceArchiveTokens.badge} ${scoreBandClass(snapshot.scoreBand)}`}
      >
        <span className="sr-only">Evidence band: </span>
        {evidenceScoreBandLabel(snapshot.scoreBand)}
      </span>
      <EvidenceQualificationBadge qualification={snapshot.qualification} />
      {snapshot.scoreDelta === null ? null : (
        <span className={evidenceArchiveTokens.note}>
          <span className="sr-only">Change from previous snapshot: </span>
          {formatScoreDelta(snapshot.scoreDelta)}
        </span>
      )}
    </div>
  );

  return (
    <article
      className={evidenceArchiveTokens.card}
      aria-labelledby={headingId}
      data-snapshot-id={snapshot.id}
      data-sequence={snapshot.sequence}
    >
      <h3 id={headingId} className="text-sm font-semibold text-foreground">
        <span className="sr-only">Evidence snapshot {snapshot.sequence}, captured </span>
        {snapshot.capturedAtLabel}
      </h3>

      <div className="mt-2">{summary}</div>

      {collapsible ? (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={expanded}
          aria-controls={bodyId}
          className={`mt-3 inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground ${evidenceArchiveTokens.focusRing}`}
        >
          {expanded ? "Hide detail" : "Show detail"}
          <span className="sr-only"> for snapshot {snapshot.sequence}</span>
        </button>
      ) : null}

      <div id={bodyId} hidden={!expanded} className="mt-3 space-y-3">
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <dt className={evidenceArchiveTokens.label}>Status</dt>
            <dd className="text-sm text-foreground">{snapshot.status}</dd>
          </div>
          <div>
            <dt className={evidenceArchiveTokens.label}>Supported markets</dt>
            <dd className="text-sm text-foreground">{snapshot.supportedMarketCount}</dd>
          </div>
          <div>
            <dt className={evidenceArchiveTokens.label}>Signals</dt>
            <dd className="text-sm text-foreground">
              {snapshot.signalCount} total · {snapshot.supportingSignalCount} supporting ·{" "}
              {snapshot.opposingSignalCount} opposing
            </dd>
          </div>
          <div>
            <dt className={evidenceArchiveTokens.label}>Operator coverage</dt>
            <dd className="text-sm text-foreground">
              {snapshot.operatorAvailabilityLabel}
            </dd>
          </div>
          <div>
            <dt className={evidenceArchiveTokens.label}>Best price captured</dt>
            <dd className="text-sm text-foreground">{snapshot.bestOddsLabel}</dd>
          </div>
          <div>
            <dt className={evidenceArchiveTokens.label}>Provenance</dt>
            <dd>
              <EvidenceVersion
                modelVersion={snapshot.modelVersion}
                schemaVersion={snapshot.schemaVersion}
                contentHash={snapshot.contentHash}
                contentHashShort={snapshot.contentHashShort}
                integrityVerified={snapshot.integrityVerified}
              />
            </dd>
          </div>
        </dl>

        <SnapshotValidations
          snapshot={snapshot}
          fixtureId={fixtureId}
          locale={locale ?? null}
        />
      </div>
    </article>
  );
}

function SnapshotValidations({
  snapshot,
  fixtureId,
  locale,
}: {
  snapshot: EvidenceSnapshotView;
  fixtureId: number;
  locale: string | null;
}) {
  const onRevisionsOpen = useCallback(
    (state: string) => {
      trackEvidenceArchiveEvent("evidence_validation_viewed", {
        fixtureId,
        snapshotId: snapshot.id,
        sequence: snapshot.sequence,
        validationState: state,
        locale,
      });
    },
    [fixtureId, locale, snapshot.id, snapshot.sequence]
  );

  if (!snapshot.validations.length) {
    return (
      <p className={evidenceArchiveTokens.note}>
        No validation record has been written against this snapshot yet.
      </p>
    );
  }

  return (
    <div>
      <h4 className={evidenceArchiveTokens.label}>Validation</h4>
      <ul className="mt-2 space-y-2">
        {snapshot.validations.map((subject) => (
          <li
            key={subject.id}
            className={evidenceArchiveTokens.cardMuted}
            data-validation-id={subject.id}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {subject.marketKey} · {subject.selectionKey}
              </span>
              <ValidationBadge
                state={subject.current.state}
                revision={subject.current.revision}
              />
            </div>
            <p className={`mt-1 ${evidenceArchiveTokens.note}`}>
              {subject.current.recordedAtLabel} · {subject.current.reasonCode}
            </p>

            {subject.corrected ? (
              <details
                className="mt-2"
                onToggle={(event) => {
                  if (event.currentTarget.open) {
                    onRevisionsOpen(subject.current.state);
                  }
                }}
              >
                <summary
                  className={`cursor-pointer text-xs font-medium text-foreground ${evidenceArchiveTokens.focusRing}`}
                >
                  {subject.revisions.length} revisions — this record was corrected
                </summary>
                {/*
                  Every revision is shown, including superseded ones. Corrections append;
                  they never erase what was previously published.
                */}
                <ol className="mt-2 space-y-2">
                  {subject.revisions.map((revision) => (
                    <li
                      key={revision.revisionId}
                      className="border-l-2 border-border pl-3"
                      data-revision={revision.revision}
                      data-current={revision.isCurrent ? "true" : "false"}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={evidenceArchiveTokens.label}>
                          Revision {revision.revision}
                        </span>
                        <ValidationBadge state={revision.state} />
                        {revision.isCurrent ? (
                          <span className={evidenceArchiveTokens.note}>Current</span>
                        ) : null}
                      </div>
                      <p className={`mt-1 ${evidenceArchiveTokens.note}`}>
                        {revision.recordedAtLabel} · {revision.reasonCode}
                      </p>
                      {revision.note ? (
                        <p className={`mt-1 ${evidenceArchiveTokens.note}`}>
                          {revision.note}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </details>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
