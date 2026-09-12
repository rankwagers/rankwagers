import Link from "next/link";
import { Icon } from "@/components/v3/Icon";
import { RW3_MARKET_ICON_BY_LIST_KIND } from "@/lib/v3/icons";
import { railTintStyle } from "@/components/homepage/hero/leagueTint";
import { fixturePath } from "@/lib/fixtures/paths";
import type { EditorPickView } from "@/lib/v3/editorPicks.server";
import type { Locale } from "@/lib/i18n";
import type { CSSProperties } from "react";

/* The editor band (Bible V3, block C): four cards, league-tinted 12%
   gradient over surface, crests, kickoff, market pill with its icon, the
   rate beside its sample, a sentence of at most two lines, "more →" only
   when a long note exists, and the odds CTA — FILLED green, the curated
   tier. Cards stagger in 60ms apart (motion law); the band itself is one of
   the two homes of the filled CTA and is registered in the probe.

   An empty band never renders placeholders: the caller passes auto-fill
   picks from the signal engine instead (empty-state law). */

export type EditorBandStrings = {
  editorPick: string;
  more: string;
  /** "Sponsored · 18+" — the no-price fallback ghost's title (group 4). */
  sponsored: string;
  /** "Strongest signals" — the engine's own cards say whose words they are (group 6). */
  strongestSignals: string;
};

function Crest({ src, name }: { src: string | null; name: string }) {
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
          display: "grid",
          placeItems: "center",
          fontSize: 8,
          color: "var(--muted)",
          flex: "none",
        }}
      >
        {name.slice(0, 2).toUpperCase()}
      </span>
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
      style={{
        borderRadius: "50%",
        background: "var(--pctbg)",
        border: "1px solid var(--line)",
        objectFit: "contain",
        flex: "none",
      }}
    />
  );
}

export function EditorBand({
  picks,
  locale,
  strings,
}: {
  picks: EditorPickView[];
  locale: Locale;
  strings: EditorBandStrings;
}) {
  if (!picks.length) return null;
  return (
    <div
      className="rw3-band"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0,1fr))",
        gap: 10,
        padding: "10px 20px",
        borderBottom: "1px solid var(--line)",
      }}
    >
      {picks.slice(0, 4).map((pick, index) => {
        const tint = railTintStyle(pick.league, pick.countryCode ?? undefined);
        const style: CSSProperties = {
          ...tint,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: 4,
          minHeight: 150,
          padding: "8px 14px",
          border: "1px solid var(--line)",
          borderRadius: 6,
          background: tint
            ? "linear-gradient(135deg, rgb(var(--rw-tint-a) / 0.12) 0%, var(--surface) 80%)"
            : "var(--surface)",
          minWidth: 0,
          "--rw3-i": index,
        } as CSSProperties;
        return (
          <div key={pick.matchId} className="rw3-band-card" style={style}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 11,
                color: "var(--muted)",
              }}
            >
              <span style={{ display: "flex" }}>
                <Crest src={pick.homeImage} name={pick.home} />
                <span style={{ marginLeft: -8, display: "flex" }}>
                  <Crest src={pick.awayImage} name={pick.away} />
                </span>
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontWeight: 500,
                  minWidth: 0,
                }}
              >
                {/* GROUP 6 — the label says WHO is speaking: the pencil and
                    "Editor's pick" belong ONLY to /admin/featured picks; a
                    card the engine filled says "Strongest signals". A reader
                    can no longer mistake machine selection for editorial. */}
                {pick.isManual ? (
                  <>
                    <Icon name="editor" size={20} strokePx={1.75} />
                    {strings.editorPick}
                  </>
                ) : (
                  strings.strongestSignals
                )}
              </span>
              <span style={{ marginLeft: "auto" }}>{pick.timeLabel}</span>
            </div>

            <Link
              href={fixturePath(locale, pick.matchId, pick.marketKind, "editor_band")}
              style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.2 }}
            >
              {pick.home} – {pick.away}
            </Link>

            {/* ≤110 chars authored / engine-built — wraps to two lines, never clips. */}
            <span style={{ fontSize: 13, lineHeight: 1.35 }}>{pick.sentence}</span>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                color: "var(--muted)",
                flexWrap: "wrap",
              }}
            >
              <span className="rw3-pill" style={{ padding: "1px 6px" }}>
                <span style={{ color: "var(--muted)", display: "inline-flex" }}>
                  <Icon name={RW3_MARKET_ICON_BY_LIST_KIND[pick.marketKind]} size={20} strokePx={1.75} />
                </span>
                {pick.marketLabel}
              </span>
              <span className="rw3-pct" style={{ fontSize: 12, padding: "1px 5px" }}>
                {pick.ratePct}%
              </span>
              <span>{pick.sample}</span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 6,
              }}
            >
              {pick.hasLongNote ? (
                <Link
                  href={fixturePath(locale, pick.matchId, pick.marketKind, "editor_band")}
                  style={{ fontSize: 11, color: "var(--muted)" }}
                >
                  {strings.more} <Icon name="arrow" size={10} />
                </Link>
              ) : (
                <span />
              )}
              {pick.bestOdds ? (
                <a
                  href={pick.bestOdds.continueHref}
                  rel="nofollow sponsored noopener"
                  className="rw3-filled"
                  style={{
                    fontSize: 11,
                    padding: "3px 9px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  {/* The real brand asset, mark only as fallback (group 1). */}
                  {pick.bestOdds.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={pick.bestOdds.logo}
                      alt=""
                      width={14}
                      height={14}
                      style={{ objectFit: "contain", borderRadius: 3 }}
                    />
                  ) : (
                    pick.bestOdds.mark
                  )}{" "}
                  {pick.bestOdds.decimal} <Icon name="arrow" size={10} />
                </a>
              ) : pick.fallbackOdds ? (
                /* No observed price → the sponsored ghost, no number (group 4). */
                <a
                  href={pick.fallbackOdds.continueHref}
                  rel="nofollow sponsored noopener"
                  className="rw3-ghost"
                  title={strings.sponsored}
                  style={{
                    fontSize: 11,
                    padding: "3px 9px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  {pick.fallbackOdds.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={pick.fallbackOdds.logo}
                      alt=""
                      width={14}
                      height={14}
                      style={{ objectFit: "contain", borderRadius: 3 }}
                    />
                  ) : (
                    pick.fallbackOdds.mark
                  )}{" "}
                  {pick.fallbackOdds.name} <Icon name="arrow" size={10} />
                </a>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
