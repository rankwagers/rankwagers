"use client";

import { useCallback, useId, useRef, useState } from "react";
import type { EvidenceSnapshotView } from "@/types/evidence";
import { trackEvidenceArchiveEvent } from "@/lib/evidence/analytics";
import {
  evidenceArchiveTokens,
  formatEvidenceScore,
  formatScoreDelta,
} from "@/lib/evidence/presentation";
import { EvidenceQualificationBadge } from "./EvidenceQualificationBadge";
import { EvidenceSnapshotCard } from "./EvidenceSnapshotCard";
import { ValidationBadge } from "./ValidationBadge";

const COLUMN_COUNT = 6;

/**
 * Tabular evidence history with per-row disclosure (Sprint 23).
 *
 * Client Component. Rows arrive newest-first.
 *
 * A11y: a real `<table>` with a `<caption>` and `scope="col"` headers, so a screen
 * reader announces each cell against its column. The disclosure control is a native
 * `<button>` with `aria-expanded` / `aria-controls`, so Enter and Space work without
 * any handler of ours. On top of that, Arrow/Home/End move focus between row toggles —
 * a long history is tedious to Tab through, and this is the one interaction a plain
 * table does not give for free.
 *
 * The detail row is `hidden` rather than unmounted so `aria-controls` always points at
 * a node that exists, which is what assistive tech expects.
 */
export function EvidenceHistoryTable({
  snapshots,
  fixtureId,
  locale,
}: {
  snapshots: EvidenceSnapshotView[];
  fixtureId: number;
  locale?: string | null;
}) {
  const baseId = useId();
  const captionId = `${baseId}-caption`;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggleRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const toggleRow = useCallback(
    (snapshot: EvidenceSnapshotView, interaction: "pointer" | "keyboard") => {
      setExpanded((previous) => {
        const next = !previous[snapshot.id];
        if (next) {
          trackEvidenceArchiveEvent("evidence_snapshot_expanded", {
            fixtureId,
            snapshotId: snapshot.id,
            sequence: snapshot.sequence,
            modelVersion: snapshot.modelVersion,
            qualification: snapshot.qualification,
            locale: locale ?? null,
            interaction,
          });
        }
        return { ...previous, [snapshot.id]: next };
      });
    },
    [fixtureId, locale]
  );

  const focusToggle = useCallback((index: number) => {
    toggleRefs.current[index]?.focus();
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      const last = snapshots.length - 1;
      let target: number | null = null;

      switch (event.key) {
        case "ArrowDown":
          target = index === last ? 0 : index + 1;
          break;
        case "ArrowUp":
          target = index === 0 ? last : index - 1;
          break;
        case "Home":
          target = 0;
          break;
        case "End":
          target = last;
          break;
        default:
          return;
      }

      event.preventDefault();
      focusToggle(target);
      trackEvidenceArchiveEvent("evidence_timeline_interaction", {
        fixtureId,
        snapshotId: snapshots[target]?.id ?? null,
        sequence: snapshots[target]?.sequence ?? null,
        snapshotCount: snapshots.length,
        interaction: "keyboard",
        locale: locale ?? null,
      });
    },
    [fixtureId, focusToggle, locale, snapshots]
  );

  if (!snapshots.length) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left" aria-describedby={captionId}>
        <caption id={captionId} className={`mb-2 text-left ${evidenceArchiveTokens.note}`}>
          Every evidence snapshot archived for this fixture, newest first. Records are
          append-only — nothing in this table is ever rewritten. Use the arrow keys to
          move between rows.
        </caption>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className={`py-2 pr-3 ${evidenceArchiveTokens.label}`}>
              Snapshot
            </th>
            <th scope="col" className={`py-2 pr-3 ${evidenceArchiveTokens.label}`}>
              Captured
            </th>
            <th scope="col" className={`py-2 pr-3 ${evidenceArchiveTokens.label}`}>
              Evidence score
            </th>
            <th scope="col" className={`py-2 pr-3 ${evidenceArchiveTokens.label}`}>
              Qualification
            </th>
            <th scope="col" className={`py-2 pr-3 ${evidenceArchiveTokens.label}`}>
              Validation
            </th>
            <th scope="col" className={`py-2 ${evidenceArchiveTokens.label}`}>
              Model
            </th>
          </tr>
        </thead>
        <tbody>
          {snapshots.map((snapshot, index) => {
            const isOpen = Boolean(expanded[snapshot.id]);
            const detailId = `${baseId}-detail-${snapshot.sequence}`;
            const current = snapshot.validations[0]?.current ?? null;

            return [
              <tr
                key={snapshot.id}
                className="border-b border-[var(--border-subtle)] align-top"
                data-snapshot-id={snapshot.id}
              >
                <th scope="row" className="py-2 pr-3">
                  <button
                    type="button"
                    ref={(node) => {
                      toggleRefs.current[index] = node;
                    }}
                    onClick={() => toggleRow(snapshot, "pointer")}
                    onKeyDown={(event) => onKeyDown(event, index)}
                    aria-expanded={isOpen}
                    aria-controls={detailId}
                    className={`inline-flex items-center gap-1 rounded-md px-1 py-1 text-body-sm font-medium text-foreground ${evidenceArchiveTokens.focusRing}`}
                  >
                    <span aria-hidden="true">{isOpen ? "−" : "+"}</span>
                    <span>#{snapshot.sequence}</span>
                    <span className="sr-only">
                      {isOpen ? "Hide" : "Show"} detail for snapshot {snapshot.sequence}
                    </span>
                  </button>
                </th>
                <td className="py-2 pr-3 text-body-sm text-foreground">
                  <time dateTime={snapshot.capturedAt}>{snapshot.capturedAtLabel}</time>
                </td>
                <td className="py-2 pr-3 text-body-sm text-foreground">
                  <span className="font-mono">
                    {formatEvidenceScore(snapshot.evidenceScore)}
                  </span>
                  {snapshot.scoreDelta === null ? null : (
                    <span className={`ml-2 ${evidenceArchiveTokens.note}`}>
                      <span className="sr-only">change </span>
                      {formatScoreDelta(snapshot.scoreDelta)}
                    </span>
                  )}
                </td>
                <td className="py-2 pr-3">
                  <EvidenceQualificationBadge qualification={snapshot.qualification} />
                </td>
                <td className="py-2 pr-3">
                  {current ? (
                    <ValidationBadge state={current.state} revision={current.revision} />
                  ) : (
                    <span className={evidenceArchiveTokens.note}>Not recorded</span>
                  )}
                </td>
                <td className={`py-2 ${evidenceArchiveTokens.mono}`}>
                  {snapshot.modelVersion}
                </td>
              </tr>,
              <tr key={`${snapshot.id}-detail`} hidden={!isOpen}>
                <td colSpan={COLUMN_COUNT} id={detailId} className="pb-4">
                  <EvidenceSnapshotCard
                    snapshot={snapshot}
                    fixtureId={fixtureId}
                    locale={locale}
                    collapsible={false}
                  />
                </td>
              </tr>,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
