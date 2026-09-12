import { CountryFlagIcon } from "@/components/CountryFlagIcon";
import { Icon } from "@/components/v3/Icon";
import { OperatorLogo } from "@/components/v3/OperatorLogo";
import { SponsoredLabel } from "@/components/v3/SponsoredLabel";
import type { PopularLeague, RailSite } from "@/lib/v3/homeRails.server";

/* The 224px left rail (Bible V3, layout): popular leagues with their real
   marks and counts, then the betting-sites list — mono-tinted operator mark,
   name, one Best, the offer wrapping to two lines, a ghost Continue, and
   Sponsored · 18+ on the section. A rail with no sites omits the section. */

export type LeftRailStrings = {
  popularLeagues: string;
  allMatches: string;
  bettingSites: string;
  sponsored: string;
  best: string;
  continue: string;
  commission: string;
};

function LeagueMark({ league }: { league: PopularLeague }) {
  if (league.leagueImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={league.leagueImage}
        alt=""
        aria-hidden
        width={14}
        height={14}
        style={{ borderRadius: 3, flex: "none", objectFit: "contain" }}
      />
    );
  }
  return <CountryFlagIcon code={league.countryCode} />;
}

export function LeftRail({
  leagues,
  totalMatches,
  sites,
  strings,
}: {
  leagues: PopularLeague[];
  totalMatches: number;
  sites: RailSite[];
  strings: LeftRailStrings;
}) {
  return (
    <aside style={{ borderRight: "1px solid var(--line)" }}>
      <div className="rw3-label" style={{ padding: "14px 16px 6px" }}>
        {strings.popularLeagues}
      </div>
      <div
        className="rw3-hoverable"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "7px 16px",
          fontSize: 13,
          borderLeft: "2px solid var(--text)",
          background: "var(--surface)",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 14,
            height: 14,
            borderRadius: 3,
            background: "var(--pctbg)",
            border: "1px solid var(--line)",
            flex: "none",
          }}
        />
        <span style={{ fontWeight: 500 }}>{strings.allMatches}</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)" }}>
          {totalMatches}
        </span>
      </div>
      {leagues.map((league) => (
        <div
          key={league.name}
          className="rw3-hoverable"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "7px 16px",
            fontSize: 13,
            borderLeft: "2px solid transparent",
          }}
        >
          <LeagueMark league={league} />
          <span style={{ fontWeight: 500, minWidth: 0 }}>{league.name}</span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)" }}>
            {league.count}
          </span>
        </div>
      ))}

      {sites.length > 0 ? (
        <>
          <div
            style={{
              marginTop: 12,
              padding: "12px 16px 6px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              borderTop: "1px solid var(--line)",
            }}
          >
            <span className="rw3-label">{strings.bettingSites}</span>
            <SponsoredLabel text={strings.sponsored} />
          </div>
          {sites.map((site) => (
            <div
              key={site.slug}
              style={{
                display: "grid",
                gridTemplateColumns: "20px minmax(0,1fr) auto",
                gap: "2px 10px",
                alignItems: "center",
                padding: "9px 16px",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <span style={{ gridRow: "span 2", display: "flex" }}>
                <OperatorLogo logo={site.logo} mark={site.mark} name={site.name} size={20} />
              </span>
              <span
                style={{
                  fontWeight: 600,
                  fontSize: 12,
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                  minWidth: 0,
                }}
              >
                {site.name}
                {site.best ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 3,
                      fontSize: 10,
                      fontWeight: 500,
                      color: "var(--muted)",
                      border: "1px solid var(--line)",
                      padding: "0 4px",
                      borderRadius: 4,
                    }}
                  >
                    <Icon name="best" size={20} strokePx={1.75} />
                    {strings.best}
                  </span>
                ) : null}
              </span>
              <a
                href={site.continueHref}
                rel="nofollow sponsored noopener"
                className="rw3-ghost"
                style={{ fontSize: 11, padding: "3px 8px", gridRow: "span 2" }}
              >
                {strings.continue}
              </a>
              {/* The offer wraps naturally — curated copy is written to two
                  lines; clamping would ellipsize, and ellipsis is banned. */}
              <span style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.35 }}>
                {site.offer}
              </span>
            </div>
          ))}
          <p
            style={{
              padding: "10px 16px",
              fontSize: 10,
              color: "var(--muted)",
              lineHeight: 1.4,
              margin: 0,
            }}
          >
            {strings.commission}
          </p>
        </>
      ) : null}
    </aside>
  );
}
