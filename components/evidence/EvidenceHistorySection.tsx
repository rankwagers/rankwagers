import { JsonLd } from "@/components/JsonLd";
import {
  EVIDENCE_HISTORY_ANCHOR,
  evidenceHistoryDatasetLd,
  getEvidenceHistoryView,
} from "@/lib/archive/evidence";
import { evidenceArchiveTokens } from "@/lib/evidence/presentation";
import type { EvidenceHistoryEmptyReason, EvidenceHistoryView } from "@/types/evidence";
import { EvidenceHistoryTable } from "./EvidenceHistoryTable";
import { EvidenceHistoryTracker } from "./EvidenceHistoryTracker";
import { EvidenceSnapshotCard } from "./EvidenceSnapshotCard";

/**
 * Evidence History section for the fixture page (Sprint 23).
 *
 * Server Component — the history is fetched and projected on the server, so the archive
 * is in the initial HTML for both crawlers and readers with JavaScript disabled. Only
 * the disclosure controls and analytics hydrate.
 *
 * Fixtures with no history are the normal case, not an error: the section renders an
 * explicit empty state and distinguishes "nothing was captured" from "the archive could
 * not be read", because those mean different things to someone judging our record.
 */

const EMPTY_COPY: Record<EvidenceHistoryEmptyReason, { title: string; body: string }> = {
  no_snapshots: {
    title: "No evidence history yet",
    body: "No evidence snapshot has been captured for this fixture. Once one is, it is archived permanently and appears here — including snapshots that did not qualify for publication.",
  },
  fixture_not_tracked: {
    title: "Fixture not tracked",
    body: "This fixture is outside the evidence capture set, so no archive exists for it.",
  },
  archive_unavailable: {
    title: "Evidence archive unavailable",
    body: "The evidence archive could not be read just now. This is an availability problem on our side — it does not mean no evidence was captured for this fixture.",
  },
};

export async function EvidenceHistorySection({
  fixtureId,
  locale,
  fixtureName,
  view: providedView,
}: {
  fixtureId: number;
  locale: string;
  /** Used for the Dataset name; falls back to the fixture id. */
  fixtureName?: string;
  /** Pre-loaded view — lets a caller (or a test) skip the archive read. */
  view?: EvidenceHistoryView;
}) {
  const view = providedView ?? (await getEvidenceHistoryView(fixtureId, { locale }));

  const datasetLd = evidenceHistoryDatasetLd({
    locale,
    fixtureId,
    fixtureName: fixtureName ?? `Fixture ${fixtureId}`,
    view,
  });

  return (
    <section
      id={EVIDENCE_HISTORY_ANCHOR}
      aria-labelledby={`${EVIDENCE_HISTORY_ANCHOR}-heading`}
      className={evidenceArchiveTokens.section}
      data-evidence-history="true"
      data-available={view.available ? "true" : "false"}
    >
      {datasetLd ? <JsonLd data={datasetLd} /> : null}

      <h2
        id={`${EVIDENCE_HISTORY_ANCHOR}-heading`}
        className="font-display text-lg font-semibold text-foreground"
      >
        Evidence history
      </h2>
      <p className={`mt-1 max-w-2xl ${evidenceArchiveTokens.note}`}>
        A permanent, append-only record of what the evidence looked like at each capture
        and how each prediction settled. Entries are never edited; corrections are
        appended as new revisions and both versions stay visible.
      </p>

      {view.available ? (
        <>
          <EvidenceHistoryTracker
            fixtureId={fixtureId}
            locale={locale}
            snapshotCount={view.totalSnapshots}
            latestSnapshotId={view.latest?.id ?? null}
            latestModelVersion={view.latest?.modelVersion ?? null}
          />

          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className={evidenceArchiveTokens.cardMuted}>
              <dt className={evidenceArchiveTokens.label}>Snapshots</dt>
              <dd className={evidenceArchiveTokens.value}>{view.totalSnapshots}</dd>
            </div>
            <div className={evidenceArchiveTokens.cardMuted}>
              <dt className={evidenceArchiveTokens.label}>Validations</dt>
              <dd className={evidenceArchiveTokens.value}>{view.totalValidations}</dd>
            </div>
            <div className={evidenceArchiveTokens.cardMuted}>
              <dt className={evidenceArchiveTokens.label}>Corrections</dt>
              <dd className={evidenceArchiveTokens.value}>{view.correctedValidations}</dd>
            </div>
            <div className={evidenceArchiveTokens.cardMuted}>
              <dt className={evidenceArchiveTokens.label}>Model versions</dt>
              <dd className="mt-1 font-mono text-xs text-foreground">
                {view.modelVersions.join(", ")}
              </dd>
            </div>
          </dl>

          {view.integrityVerified ? null : (
            <p
              role="status"
              className="mt-3 rounded-md border border-[var(--red-primary)]/25 bg-[var(--red-surface)] px-3 py-2 text-xs text-[var(--red-primary)]"
            >
              One or more archived snapshots failed their content-hash check. The rows
              below are shown as stored, unmodified, and should be treated as unverified.
            </p>
          )}

          {view.latest ? (
            <div className="mt-5">
              <h3 className={evidenceArchiveTokens.label}>Current snapshot</h3>
              <div className="mt-2">
                <EvidenceSnapshotCard
                  snapshot={view.latest}
                  fixtureId={fixtureId}
                  locale={locale}
                  defaultExpanded
                />
              </div>
            </div>
          ) : null}

          <div className="mt-6">
            <h3 className={evidenceArchiveTokens.label}>Full timeline</h3>
            <div className="mt-2">
              <EvidenceHistoryTable
                snapshots={view.snapshots}
                fixtureId={fixtureId}
                locale={locale}
              />
            </div>
          </div>
        </>
      ) : (
        <div className={`mt-4 ${evidenceArchiveTokens.cardMuted}`} role="status">
          <p className="text-sm font-medium text-foreground">
            {EMPTY_COPY[view.emptyReason ?? "no_snapshots"].title}
          </p>
          <p className={`mt-1 ${evidenceArchiveTokens.note}`}>
            {EMPTY_COPY[view.emptyReason ?? "no_snapshots"].body}
          </p>
        </div>
      )}
    </section>
  );
}
