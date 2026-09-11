import { JsonLd } from "@/components/JsonLd";
import {
  EVIDENCE_HISTORY_ANCHOR,
  evidenceHistoryDatasetLd,
  getEvidenceHistoryView,
} from "@/lib/archive/evidence";
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

/* The muted stat card and its value in the rw3 grammar: a line, a surface,
   6px radius, 14px/600 numerals — no elevation. */
const rw3Card = {
  border: "1px solid var(--line)",
  borderRadius: 6,
  background: "var(--surface)",
  padding: "10px 12px",
} as const;
const rw3Value = { marginTop: 4, fontSize: 14, fontWeight: 600 } as const;

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
      className="pt-8"
      style={{ borderTop: "1px solid var(--line)" }}
      data-evidence-history="true"
      data-available={view.available ? "true" : "false"}
    >
      {datasetLd ? <JsonLd data={datasetLd} /> : null}

      <h2 id={`${EVIDENCE_HISTORY_ANCHOR}-heading`} className="rw3-title">
        Evidence history
      </h2>
      <p className="rw3-meta mt-1 max-w-2xl">
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
            <div style={rw3Card}>
              <dt className="rw3-label">Snapshots</dt>
              <dd style={rw3Value}>{view.totalSnapshots}</dd>
            </div>
            <div style={rw3Card}>
              <dt className="rw3-label">Validations</dt>
              <dd style={rw3Value}>{view.totalValidations}</dd>
            </div>
            <div style={rw3Card}>
              <dt className="rw3-label">Corrections</dt>
              <dd style={rw3Value}>{view.correctedValidations}</dd>
            </div>
            <div style={rw3Card}>
              <dt className="rw3-label">Model versions</dt>
              <dd className="mt-1" style={{ fontSize: 12 }}>
                {view.modelVersions.join(", ")}
              </dd>
            </div>
          </dl>

          {view.integrityVerified ? null : (
            <p
              role="status"
              className="mt-3 px-3 py-2"
              style={{
                border: "1px solid var(--line)",
                borderRadius: 6,
                fontSize: 12,
                color: "var(--loss)",
              }}
            >
              One or more archived snapshots failed their content-hash check. The rows
              below are shown as stored, unmodified, and should be treated as unverified.
            </p>
          )}

          {view.latest ? (
            <div className="mt-5">
              <h3 className="rw3-label">Current snapshot</h3>
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
            <h3 className="rw3-label">Full timeline</h3>
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
        <div className="mt-4" style={rw3Card} role="status">
          <p style={{ fontSize: 13, fontWeight: 500 }}>
            {EMPTY_COPY[view.emptyReason ?? "no_snapshots"].title}
          </p>
          <p className="rw3-meta mt-1">
            {EMPTY_COPY[view.emptyReason ?? "no_snapshots"].body}
          </p>
        </div>
      )}
    </section>
  );
}
