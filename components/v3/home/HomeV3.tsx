import Link from "next/link";
import { Icon } from "@/components/v3/Icon";
import { LockTick } from "@/components/v3/LockTick";
import { LeftRail, type LeftRailStrings } from "@/components/v3/rails/LeftRail";
import { RightRail, type RightRailStrings, type VerifiedCard } from "@/components/v3/rails/RightRail";
import { LiveStrip } from "@/components/v3/home/LiveStrip";
import { EditorBand, type EditorBandStrings } from "@/components/v3/home/EditorBand";
import { HomeTabs, type HomeTabsStrings } from "@/components/v3/home/HomeTabs";
import { PredictionTable, type TableStrings } from "@/components/v3/home/PredictionTable";
import { EmptyStateV3, IllustrationNoMatches } from "@/components/v3/illustrations";
import { SponsoredLabel } from "@/components/v3/SponsoredLabel";
import type {
  HighPotentialMarket,
  OfferOfTheDay,
  PopularLeague,
  RailSite,
} from "@/lib/v3/homeRails.server";
import type { DayKey, LiveStripItem, TableRow } from "@/lib/v3/homeTable.server";
import type { EditorPickView } from "@/lib/v3/editorPicks.server";
import type { MatchListKind } from "@/lib/footystats/types";
import type { Locale } from "@/lib/i18n";

/* The v3 homepage composition (Bible V3, block C): 224 · fluid · 300 at
   ≥1200; below that the rails fold into the column — verified bar above the
   tabs, sites list after the table, band on a horizontal scroll — and the
   bottom tab bar takes the navigation. */

export type HomeV3Strings = {
  leftRail: LeftRailStrings;
  rightRail: RightRailStrings;
  band: EditorBandStrings;
  tabs: HomeTabsStrings;
  table: TableStrings;
  live: string;
  seeRecord: string;
  verifiedShort: string;
  emptyTitle: string;
  emptyLine: string;
  emptyTomorrowLine: string | null;
};

export function HomeV3(props: {
  locale: Locale;
  strings: HomeV3Strings;
  live: LiveStripItem[];
  picks: EditorPickView[];
  day: DayKey;
  counts: Record<DayKey, number>;
  market: MatchListKind | null;
  sort: "rate" | "time";
  rows: TableRow[];
  totalRows: number;
  moreHref: string | null;
  leagues: PopularLeague[];
  totalMatches: number;
  sites: RailSite[];
  verified: VerifiedCard | null;
  highPotential: HighPotentialMarket[];
  offer: OfferOfTheDay | null;
}) {
  const { locale, strings } = props;
  const empty = props.totalRows === 0;

  return (
    <div className="rw3-home-grid">
      <div className="rw3-left-rail">
        <LeftRail
          leagues={props.leagues}
          totalMatches={props.totalMatches}
          sites={props.sites}
          strings={strings.leftRail}
        />
      </div>

      <div style={{ minWidth: 0 }}>
        <LiveStrip items={props.live} liveLabel={strings.live} />
        <EditorBand picks={props.picks} locale={locale} strings={strings.band} />

        {/* Below lg the verified record compresses into one bar. */}
        {props.verified ? (
          <div
            className="rw3-mobile-only"
            style={{ borderBottom: "1px solid var(--line)" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                fontSize: 12,
              }}
            >
              <span className="rw3-pct">{props.verified.hitRatePct}%</span>
              <LockTick size={14} />
              <span
                style={{
                  color: "var(--muted)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {strings.verifiedShort} · {props.verified.won}{" "}
                <span style={{ color: "var(--win)" }}>W</span> {props.verified.lost}{" "}
                <span style={{ color: "var(--loss)" }}>L</span>
              </span>
              <Link
                href={`/${locale}/archive`}
                style={{ marginLeft: "auto", fontWeight: 500, whiteSpace: "nowrap" }}
              >
                {strings.seeRecord} <Icon name="arrow" size={11} />
              </Link>
            </div>
          </div>
        ) : null}

        <HomeTabs
          locale={locale}
          day={props.day}
          counts={props.counts}
          market={props.market}
          sort={props.sort}
          strings={strings.tabs}
        />

        {empty ? (
          <EmptyStateV3
            illustration={<IllustrationNoMatches />}
            title={strings.emptyTitle}
            line={strings.emptyTomorrowLine ?? strings.emptyLine}
          />
        ) : (
          <PredictionTable
            rows={props.rows}
            totalRows={props.totalRows}
            locale={locale}
            strings={strings.table}
            moreHref={props.moreHref}
          />
        )}

        {/* Below lg the sites list follows the table (the left rail is gone). */}
        {props.sites.length > 0 ? (
          <div className="rw3-mobile-only">
            <div
              style={{
                padding: "10px 14px 4px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
              }}
            >
              <span className="rw3-label">{strings.leftRail.bettingSites}</span>
              <SponsoredLabel text={strings.leftRail.sponsored} />
            </div>
            {props.sites.map((site) => (
              <div
                key={site.slug}
                style={{
                  display: "grid",
                  gridTemplateColumns: "24px minmax(0,1fr) auto",
                  gap: "1px 10px",
                  alignItems: "center",
                  padding: "8px 14px",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 24,
                    height: 24,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 8,
                    fontWeight: 600,
                    background: "var(--pctbg)",
                    border: "1px solid var(--line)",
                    borderRadius: 6,
                    gridRow: "span 2",
                  }}
                >
                  {site.mark}
                </span>
                <span style={{ fontWeight: 600, fontSize: 12 }}>{site.name}</span>
                <a
                  href={site.continueHref}
                  rel="nofollow sponsored noopener"
                  className="rw3-ghost"
                  style={{ fontSize: 11, padding: "3px 8px", gridRow: "span 2" }}
                >
                  {strings.leftRail.continue}
                </a>
                <span style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.35 }}>
                  {site.offer}
                </span>
              </div>
            ))}
            <p
              style={{
                padding: "10px 14px",
                fontSize: 10,
                color: "var(--muted)",
                lineHeight: 1.4,
                margin: 0,
              }}
            >
              {strings.leftRail.commission}
            </p>
          </div>
        ) : null}
      </div>

      <div className="rw3-right-rail">
        <RightRail
          verified={props.verified}
          markets={props.highPotential}
          offer={props.offer}
          strings={strings.rightRail}
          locale={locale}
        />
      </div>
    </div>
  );
}
