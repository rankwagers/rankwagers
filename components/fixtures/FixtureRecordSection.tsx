import type { MatchPredictionView } from "@/lib/fixtures/types";

/* ============================================================================
   THE RECORD — what was archived, not what we recommend
   ----------------------------------------------------------------------------
   §3.11 forbids removing published history, so odds at publication, unit P/L and
   settlement all stay on the page. They move out of the research section because
   they answer a different question: research says what we found, the record says
   what was published and what happened to it afterwards (§3.12).

   ROI is omitted, and the reason is editorial rather than technical: the product
   does not claim a return. A per-selection P/L is a fact about one archived row;
   a return figure is a claim about a strategy, and we do not make one.
   ========================================================================== */

function formatStamp(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC";
  } catch {
    return "—";
  }
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="rw3-label">{label}</dt>
      <dd className="mt-1 text-[13px]">{value}</dd>
    </div>
  );
}

function RecordRow({ prediction }: { prediction: MatchPredictionView }) {
  const profit =
    prediction.unitProfit == null
      ? "—"
      : prediction.unitProfit > 0
        ? `+${prediction.unitProfit.toFixed(2)}u`
        : `${prediction.unitProfit.toFixed(2)}u`;

  return (
    <li className="border-t border-[var(--line)] py-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h3 className="text-[14px] font-semibold">{prediction.marketLabel}</h3>
        <p className="rw3-label">{prediction.status}</p>
      </div>
      {/* An after-kickoff derivation is not a publication and must not wear its labels. */}
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <Field
          label={prediction.capturedAfterKickoff ? "Observed (after kickoff)" : "Published"}
          value={formatStamp(prediction.publishedAt)}
        />
        <Field
          label={
            prediction.capturedAfterKickoff
              ? "Odds observed (after kickoff)"
              : "Odds at publication"
          }
          value={prediction.originalOdds != null ? prediction.originalOdds.toFixed(2) : "Unavailable"}
        />
        <Field label="Unit P/L" value={profit} />
        <Field label="Selection" value={prediction.selection} />
      </dl>
      {prediction.settlementReason ? (
        <p className="mt-3 max-w-[62ch] text-[12px] leading-relaxed" style={{ color: "var(--muted)" }}>
          {prediction.settlementReason}
        </p>
      ) : null}
    </li>
  );
}

export function FixtureRecordSection({
  predictions,
}: {
  predictions: MatchPredictionView[];
}) {
  return (
    <section aria-labelledby="record-heading" className="scroll-mt-24">
      <h2 id="record-heading" className="rw3-title">
        The record
      </h2>
      <p className="mt-3 max-w-[62ch] text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>
        What was published for this fixture, when, and what happened afterwards. Nothing here is
        removed once written, and corrections are added rather than substituted.
      </p>
      {predictions.length ? (
        <ul className="mt-6">
          {predictions.map((p) => (
            <RecordRow key={p.id} prediction={p} />
          ))}
        </ul>
      ) : (
        <p
          className="mt-6 py-1 pl-4 text-[13px]"
          style={{ borderLeft: "2px solid var(--line)", color: "var(--muted)" }}
        >
          Nothing has been published for this fixture, so there is no record yet.
        </p>
      )}
    </section>
  );
}
