import Link from "next/link";
import { Icon } from "@/components/v3/Icon";
import { RW3_MARKET_ICON_BY_LIST_KIND } from "@/lib/v3/icons";
import { FormDots } from "@/components/v3/motion";
import { fixturePath } from "@/lib/fixtures/paths";
import { formatDict } from "@/lib/formatDict";
import type { TableRow } from "@/lib/v3/homeTable.server";
import type { Locale } from "@/lib/i18n";

/* The prediction table (Bible V3, block C): columns 44·1fr·112·88·42·44·72·104,
   row padding 17px 0, rate BESIDE its sample on every row, form dots for the
   last ten where full-time scores can answer for the market (half markets
   render none — no half-time history exists), the best observed odds as a
   ghost button signed for placement price_row. Rows hover to --hover; rows
   never animate; there is no "Play" column. */

export type TableStrings = {
  colTime: string;
  colMatch: string;
  colLeague: string;
  colMarket: string;
  colRate: string;
  colSample: string;
  colForm: string;
  colBestOdds: string;
  nMoreMatches: string;
  sponsoredLinks: string;
  /** "Sponsored · 18+" — the no-price fallback ghost's title (group 4). */
  sponsored: string;
  /** "small sample" — n<5 rows say so and render muted (group 5). */
  smallSample: string;
  /** Group 8: dictionary short labels drive the market pill. */
  marketLabels: Record<TableRow["marketKind"], string>;
};

/* Crests render 24px (polish group 3) — the provider asset is larger than
   24 CSS px, so a plain scale-down is already ≥2x sharp on dense screens. */
function TeamMark({ src, name }: { src: string | null; name: string }) {
  if (!src) {
    return (
      <span
        aria-hidden
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: "var(--pctbg)",
          border: "1px solid var(--line)",
          flex: "none",
          alignSelf: "center",
        }}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden
      width={24}
      height={24}
      style={{ borderRadius: "50%", objectFit: "contain", flex: "none", alignSelf: "center" }}
    />
  );
}

export function PredictionTable({
  rows,
  totalRows,
  locale,
  strings,
  moreHref,
}: {
  rows: TableRow[];
  totalRows: number;
  locale: Locale;
  strings: TableStrings;
  moreHref: string | null;
}) {
  const remaining = totalRows - rows.length;
  return (
    <div>
      <div className="rw3-table-head">
        <span>{strings.colTime}</span>
        <span>{strings.colMatch}</span>
        <span>{strings.colLeague}</span>
        <span>{strings.colMarket}</span>
        <span>{strings.colRate}</span>
        <span>{strings.colSample}</span>
        <span>{strings.colForm}</span>
        <span>
          {strings.colBestOdds} <Icon name="arrow" size={10} />
        </span>
      </div>

      {rows.map((row) => (
        <div key={`${row.matchId}-${row.marketKind}`} className="rw3-table-row rw3-hoverable">
          <span className="rw3-c-time" style={{ fontSize: 12, color: "var(--muted)" }}>
            {row.timeLabel}
          </span>

          <Link
            className="rw3-c-match"
            href={fixturePath(locale, row.matchId, row.marketKind, "home_table")}
            style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}
          >
            <TeamMark src={row.homeImage} name={row.home} />
            <span style={{ fontWeight: 500 }}>{row.home}</span>
            <span style={{ color: "var(--muted)", fontSize: 11 }}>–</span>
            <TeamMark src={row.awayImage} name={row.away} />
            <span style={{ fontWeight: 500 }}>{row.away}</span>
          </Link>

          <span className="rw3-c-league" style={{ fontSize: 12, color: "var(--muted)" }}>
            {row.league}
          </span>

          <span className="rw3-c-meta">
            <span className="rw3-pill" style={{ justifySelf: "start" }}>
              <span style={{ color: "var(--muted)", display: "inline-flex" }}>
                <Icon name={RW3_MARKET_ICON_BY_LIST_KIND[row.marketKind]} size={20} strokePx={1.75} />
              </span>
              {strings.marketLabels[row.marketKind]}
            </span>
            {row.ratePct !== null ? (
              <span
                className="rw3-pct"
                style={{
                  justifySelf: "start",
                  /* Group 5: a rate on fewer than five matches whispers. */
                  ...(row.smallSample ? { color: "var(--muted)", fontWeight: 500 } : {}),
                }}
              >
                {row.ratePct}%
              </span>
            ) : (
              <span aria-hidden />
            )}
            {row.sample ? (
              <span style={{ fontSize: 11, color: "var(--muted)" }}>
                {row.sample}
                {row.smallSample ? <> · {strings.smallSample}</> : null}
              </span>
            ) : (
              <span aria-hidden />
            )}
            <span style={{ display: "flex", gap: 3 }}>
              <FormDots
                results={row.form}
                label={
                  row.form.length
                    ? `${row.form.filter(Boolean).length}/${row.form.length}`
                    : undefined
                }
              />
            </span>
          </span>

          <span className="rw3-c-odds" style={{ justifySelf: "start" }}>
            {row.bestOdds ? (
              <a
                href={row.bestOdds.continueHref}
                rel="nofollow sponsored noopener"
                className="rw3-ghost"
                style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
              >
                {/* The real brand asset, mark only as fallback (group 1). */}
                {row.bestOdds.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.bestOdds.logo}
                    alt=""
                    width={14}
                    height={14}
                    style={{ objectFit: "contain", borderRadius: 3 }}
                  />
                ) : (
                  row.bestOdds.mark
                )}{" "}
                {row.bestOdds.decimal} <Icon name="arrow" size={12} />
              </a>
            ) : row.fallbackOdds ? (
              /* No observed price → the sponsored ghost: logo + name +
                 arrow, NO number — never a fabricated price (group 4). */
              <a
                href={row.fallbackOdds.continueHref}
                rel="nofollow sponsored noopener"
                className="rw3-ghost"
                title={strings.sponsored}
                style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
              >
                {row.fallbackOdds.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.fallbackOdds.logo}
                    alt=""
                    width={14}
                    height={14}
                    style={{ objectFit: "contain", borderRadius: 3 }}
                  />
                ) : (
                  row.fallbackOdds.mark
                )}{" "}
                {row.fallbackOdds.name} <Icon name="arrow" size={12} />
              </a>
            ) : null}
          </span>
        </div>
      ))}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "10px 20px",
          fontSize: 12,
          color: "var(--muted)",
          flexWrap: "wrap",
        }}
      >
        {remaining > 0 && moreHref ? (
          <Link href={moreHref} style={{ color: "var(--text)", fontWeight: 500 }}>
            {formatDict(strings.nMoreMatches, { n: String(remaining) })}{" "}
            <Icon name="arrow" size={11} />
          </Link>
        ) : null}
        <span>{strings.sponsoredLinks}</span>
      </div>
    </div>
  );
}
