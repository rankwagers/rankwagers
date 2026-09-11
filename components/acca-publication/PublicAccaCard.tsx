import Link from "next/link";
import { formatDict } from "@/lib/formatDict";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";
import { publicAccaPath } from "@/lib/acca-publication/paths";
import { availabilityLabel } from "@/lib/acca-publication/freshness";
import type { PublicAccaView } from "@/lib/acca-publication/publicView";

/**
 * Summary card for a published Acca (Sprint 20B-B stage B5; extended in Sprint 24).
 *
 * Shows what the reader needs to decide whether to open it: how many selections, the combined
 * price, the earliest kick-off, its current state, and whether it carries warnings. It does NOT
 * show a confidence headline or any"top pick" framing — ranking selections by apparent certainty
 * is how a research surface turns into a tipster feed.
 *
 * SERVER-RENDERED, ALWAYS. The `data-acca-*` attributes exist so the index's analytics island can
 * measure impressions and clicks by reading the DOM, which is what allows this card to stay a
 * plain server component with no hydration at all.
 *
 * STATE IS NEVER COLOUR-ONLY. The availability label is words; the warning line states its
 * own count. Nothing here depends on a reader distinguishing two shades.
 */
export function PublicAccaCard({
 view,
 position,
 p,
}: {
 p: PredictionStrings;
 view: PublicAccaView;
 /** 1-based position in the list, carried into impression and click events. */
 position?: number;
}) {
 const availability = availabilityLabel(view.freshness.availability);
 const earliest = view.freshness.earliestKickoffAt;
 const warningCount = view.evidence.warnings.length;

 return (
 <article
 className="rw3-hoverable p-4"
 style={{
 border: "1px solid var(--line)",
 background: "var(--surface)",
 borderRadius: 6,
 }}
 data-acca-card=""
 data-acca-id={view.publicId}
 data-acca-legs={view.legCount}
 data-acca-band={view.oddsBand}
 data-acca-state={view.freshness.availability.toLowerCase()}
 {...(view.profile ? {"data-acca-profile": view.profile } : {})}
 {...(position ? {"data-acca-position": position } : {})}
 >
 <h3 className="text-[14px] font-semibold">
 <Link
 href={publicAccaPath(view.locale, view.publicId)}
 className="underline-offset-2 hover:underline"
 >
 {view.title}
 </Link>
 </h3>

 {view.summary ? <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>{view.summary}</p> : null}

 <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
 <div>
 <dt className="rw3-label">{p.apdSelections}</dt>
 <dd className="tabular-nums">{view.legCount}</dd>
 </div>
 <div>
 <dt className="rw3-label">{p.appCombinedOdds}</dt>
 <dd className="tabular-nums">{view.combinedOdds.display}</dd>
 </div>
 {earliest ? (
 <div>
 <dt className="rw3-label">{p.apxFirstKickoff}</dt>
 <dd>
 <time dateTime={earliest}>{`${earliest.slice(0, 10)} ${earliest.slice(11, 16)} UTC`}</time>
 </dd>
 </div>
 ) : null}
 <div>
 <dt className="rw3-label">{p.apdState}</dt>
 <dd>{availability.label}</dd>
 </div>
 </dl>

 {warningCount > 0 ? (
 <p className="mt-3 text-[11px]" style={{ color: "var(--loss)" }}>
 {formatDict(p.apxLimitationsNoted, { n: String(warningCount) })}
 </p>
 ) : null}
 </article>
 );
}
