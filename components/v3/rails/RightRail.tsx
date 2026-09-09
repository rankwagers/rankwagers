import { Icon } from "@/components/v3/Icon";
import { LockTick } from "@/components/v3/LockTick";
import { FormDots } from "@/components/v3/motion";
import { SponsoredLabel } from "@/components/v3/SponsoredLabel";
import { formatDict } from "@/lib/formatDict";
import type { HighPotentialMarket, OfferOfTheDay } from "@/lib/v3/homeRails.server";
import Link from "next/link";
import type { Locale } from "@/lib/i18n";

/* The 300px right rail (Bible V3, shell): the verified hit-rate card from
   the REAL archive summary (pct · W · L · the lock line · see the record),
   high-potential markets for today, and the offer of the day — the page's
   single curated commercial slot besides the editor band.

   Truth laws in force: a null hit rate omits the card whole (never 0, never
   a dash); every percentage sits beside its sample; the offer card is
   omitted when no partner qualifies. */

export type VerifiedCard = {
  hitRatePct: number;
  won: number;
  lost: number;
  windowLabel: string;
};

export type RightRailStrings = {
  verifiedHitRate: string;
  lockLine: string;
  seeRecord: string;
  highPotential: string;
  nPredictions: string;
  offerOfTheDay: string;
  sponsored: string;
  continue: string;
  terms: string;
};

export function RightRail({
  verified,
  markets,
  offer,
  strings,
  locale,
}: {
  verified: VerifiedCard | null;
  markets: HighPotentialMarket[];
  offer: OfferOfTheDay | null;
  strings: RightRailStrings;
  locale: Locale;
}) {
  return (
    <aside style={{ borderLeft: "1px solid var(--line)" }}>
      {verified ? (
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 600 }}>
              <span style={{ color: "var(--win)", display: "inline-flex" }}>
                <Icon name="verified" size={14} />
              </span>
              {strings.verifiedHitRate}
            </span>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>{verified.windowLabel}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="rw3-pct" style={{ fontSize: 14, padding: "2px 8px" }}>
              {verified.hitRatePct}%
            </span>
            <LockTick size={16} />
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              {verified.won} <span style={{ color: "var(--win)" }}>W</span> · {verified.lost}{" "}
              <span style={{ color: "var(--loss)" }}>L</span>
            </span>
          </div>
          <div
            aria-hidden
            style={{
              height: 4,
              display: "flex",
              borderRadius: 2,
              overflow: "hidden",
              background: "var(--line)",
            }}
          >
            <span style={{ width: `${verified.hitRatePct}%`, background: "var(--win)" }} />
          </div>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            {strings.lockLine}{" "}
            <Link
              href={`/${locale}/archive`}
              style={{ color: "var(--text)", fontWeight: 500, whiteSpace: "nowrap" }}
            >
              {strings.seeRecord} <Icon name="arrow" size={11} />
            </Link>
          </span>
        </div>
      ) : null}

      {markets.length > 0 ? (
        <>
          <div className="rw3-label" style={{ padding: "12px 16px 6px" }}>
            {strings.highPotential}
          </div>
          {markets.map((market) => (
            <div
              key={market.marketKey}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0,1fr) auto",
                gap: "3px 10px",
                padding: "8px 16px",
                borderBottom: "1px solid var(--line)",
                alignItems: "center",
              }}
            >
              <span style={{ fontWeight: 500 }}>{market.marketLabel}</span>
              <span className="rw3-pct">{market.hitRatePct}%</span>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>
                {formatDict(strings.nPredictions, { n: String(market.todayCount) })} ·{" "}
                {market.won}
                <span style={{ color: "var(--win)" }}>W</span> {market.lost}
                <span style={{ color: "var(--loss)" }}>L</span>
              </span>
              <span style={{ justifySelf: "end" }}>
                <FormDots results={market.form} />
              </span>
            </div>
          ))}
        </>
      ) : null}

      {offer ? (
        <div
          data-offer-of-the-day=""
          style={{
            margin: "14px 16px",
            padding: 12,
            border: "1px solid var(--line)",
            borderRadius: 6,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 8,
            }}
          >
            <span className="rw3-label">{strings.offerOfTheDay}</span>
            <SponsoredLabel text={strings.sponsored} size={11} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              aria-hidden
              style={{
                width: 28,
                height: 28,
                display: "grid",
                placeItems: "center",
                fontSize: 9,
                fontWeight: 600,
                background: "var(--pctbg)",
                color: "var(--text)",
                border: "1px solid var(--line)",
                borderRadius: 6,
                flex: "none",
              }}
            >
              {offer.mark}
            </span>
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <span style={{ fontWeight: 600 }}>{offer.name}</span>
              <span style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.35 }}>
                {offer.offer}
              </span>
            </div>
          </div>
          <a
            href={offer.continueHref}
            rel="nofollow sponsored noopener"
            className="rw3-filled"
            style={{ alignSelf: "flex-start", padding: "6px 12px" }}
          >
            {strings.continue}
          </a>
          <span style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.4 }}>
            {strings.terms}
          </span>
        </div>
      ) : null}
    </aside>
  );
}
