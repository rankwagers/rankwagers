"use client";

import Image from "next/image";
import Link from "next/link";
import type { PublicOperatorMatch } from "@/lib/combo/apiTypes";

function availabilityCopy(op: PublicOperatorMatch): string {
 switch (op.availability) {
 case "full":
 return "Verified availability";
 case "partial":
 return `${op.availableSelectionCount} of ${op.totalSelections} selections available`;
 case "unknown":
 return "Availability could not be confirmed";
 case "none":
 default:
 return "Not available for this combination";
 }
}

function ctaLabel(op: PublicOperatorMatch): string | null {
 if (!op.outboundPath || op.deeplinkType === "unavailable" || !op.countryEligible) {
 return null;
 }
 if (op.availability === "unknown") return "Visit Operator";
 switch (op.deeplinkType) {
 case "betslip":
 return "Open Prepared Bet Slip";
 case "market":
 return "View Markets";
 case "fixture":
 return "View Fixtures";
 case "football_landing":
 return "Open Football Markets";
 case "homepage":
 default:
 return "Visit Operator";
 }
}

function deeplinkExplanation(op: PublicOperatorMatch): string | null {
 if (op.deeplinkType === "football_landing") return "Opens football markets";
 if (op.deeplinkType === "homepage") return "Opens operator homepage";
 if (op.deeplinkType === "unavailable") return null;
 return null;
}

export function ComboOperatorCard({
 operator,
 locale,
 onCta,
 onView,
}: {
 operator: PublicOperatorMatch;
 locale: string;
 onCta: () => void;
 onView: () => void;
}) {
 const cta = ctaLabel(operator);
 const showBestMatch =
 operator.badge === "best_match" && operator.availability === "full";

 return (
 <article
 className="rounded-md border border-border bg-[var(--canvas-secondary)] px-4 py-4"
 onMouseEnter={onView}
 onFocus={onView}
 >
 <div className="flex items-start gap-3">
 {operator.logo ? (
 <Image
 src={operator.logo}
 alt={`${operator.displayName} logo`}
 width={40}
 height={40}
 className="h-10 w-10 rounded object-contain"
 />
 ) : (
 <div className="flex h-10 w-10 items-center justify-center rounded bg-border text-xs font-semibold">
 {operator.displayName.slice(0, 1)}
 </div>
 )}
 <div className="min-w-0 flex-1">
 <div className="flex flex-wrap items-center gap-2">
 <h3 className="font-semibold text-foreground">{operator.displayName}</h3>
 {showBestMatch ? (
 <span className="rounded bg-brand/15 px-2 py-0.5 text-metadata font-semibold text-brand">
 All selections covered
 </span>
 ) : null}
 {operator.badge === "full_combo" && operator.availability === "full" ? (
 <span className="rounded bg-[var(--green-surface)] px-2 py-0.5 text-metadata font-semibold text-brand">
 Verified availability
 </span>
 ) : null}
 </div>
 <p className="mt-1 text-sm text-[var(--ink-secondary)]">
 {availabilityCopy(operator)}
 </p>
 <p className="mt-1 text-xs text-muted-foreground">
 {operator.countryEligible
 ? "Available in your country"
 : "Not available in your country"}
 {deeplinkExplanation(operator)
 ? ` · ${deeplinkExplanation(operator)}`
 : ""}
 </p>
 {operator.availability === "unknown" ? (
 <p className="mt-2 text-xs text-muted-foreground">
 Combo availability has not been verified for this operator. You can open the
 operator and search for the listed markets manually.
 </p>
 ) : null}
 {operator.availability === "full" && operator.combinedOdds == null ? (
 <p className="mt-2 text-xs text-muted-foreground">
 Combined operator odds unavailable
 </p>
 ) : null}
 {operator.offerSummary && operator.countryEligible ? (
 <p className="mt-2 text-xs">
 Available offer: {operator.offerSummary} · Terms apply
 </p>
 ) : null}
 {operator.combinedOdds != null ? (
 <p className="mt-1 font-mono text-sm">
 Combined odds: {operator.combinedOdds.toFixed(2)}
 </p>
 ) : null}
 <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
 {operator.reasons.slice(0, 4).map((reason) => (
 <li key={reason}>{reason}</li>
 ))}
 </ul>
 </div>
 </div>
 <div className="mt-4 flex flex-wrap gap-2">
 {cta && operator.outboundPath ? (
 <a
 href={operator.outboundPath}
 onClick={onCta}
 className="btn-primary min-h-12"
 rel="nofollow sponsored"
 >
 {cta}
 </a>
 ) : null}
 <Link
 href={`/${locale}/operators/${operator.slug}`}
 className="inline-flex min-h-12 items-center rounded-md border border-border px-4 py-2 text-sm font-semibold"
 >
 Operator research
 </Link>
 </div>
 </article>
 );
}
