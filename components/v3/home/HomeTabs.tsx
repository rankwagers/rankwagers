import Link from "next/link";
import { Icon } from "@/components/v3/Icon";
import { RW3_MARKET_ICON_BY_LIST_KIND } from "@/lib/v3/icons";
import type { DayKey } from "@/lib/v3/homeTable.server";
import type { MatchListKind } from "@/lib/footystats/types";
import type { Locale } from "@/lib/i18n";

/* Today / Tomorrow / Weekend with real counts, plus the market filter and
   sort — server-rendered <details> popovers whose options are plain links
   (no client island, no JS). Filter and sort carry the rw3 filter/sort
   glyphs; that is the whole icon budget of this bar. */

export type HomeTabsStrings = {
  today: string;
  tomorrow: string;
  weekend: string;
  allMarkets: string;
  sortByRate: string;
  colTime: string;
  marketLabels: Record<MatchListKind, string>;
};

function query(day: DayKey, market: MatchListKind | null, sort: "rate" | "time"): string {
  const params = new URLSearchParams();
  if (day !== "today") params.set("day", day);
  if (market) params.set("market", market);
  if (sort !== "rate") params.set("sort", sort);
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function HomeTabs({
  locale,
  day,
  counts,
  market,
  sort,
  strings,
}: {
  locale: Locale;
  day: DayKey;
  counts: Record<DayKey, number>;
  market: MatchListKind | null;
  sort: "rate" | "time";
  strings: HomeTabsStrings;
}) {
  const base = `/${locale}`;
  const tabs: Array<{ key: DayKey; label: string }> = [
    { key: "today", label: strings.today },
    { key: "tomorrow", label: strings.tomorrow },
    { key: "weekend", label: strings.weekend },
  ];
  const markets: MatchListKind[] = ["fh", "over15", "over25", "sh"];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 2,
        padding: "10px 20px 0",
        borderBottom: "1px solid var(--line)",
        fontSize: 13,
        fontWeight: 500,
        flexWrap: "wrap",
      }}
    >
      {tabs.map((tab) => {
        const active = tab.key === day;
        return (
          <Link
            key={tab.key}
            href={`${base}${query(tab.key, market, sort)}`}
            aria-current={active ? "page" : undefined}
            style={{
              padding: "6px 10px 9px",
              borderBottom: `2px solid ${active ? "var(--text)" : "transparent"}`,
              color: active ? "var(--text)" : "var(--muted)",
              whiteSpace: "nowrap",
            }}
          >
            {tab.label}{" "}
            <span style={{ color: "var(--muted)", fontWeight: 400 }}>{counts[tab.key]}</span>
          </Link>
        );
      })}

      <span style={{ marginLeft: "auto", display: "flex", gap: 6, paddingBottom: 6 }}>
        <details style={{ position: "relative" }}>
          <summary
            className="rw3-hoverable"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              padding: "4px 8px",
              border: "1px solid var(--line)",
              borderRadius: 6,
              color: market ? "var(--text)" : "var(--muted)",
              cursor: "pointer",
              listStyle: "none",
            }}
          >
            <Icon name="filter" size={13} />
            {market ? strings.marketLabels[market] : strings.allMarkets}
          </summary>
          <div
            style={{
              position: "absolute",
              right: 0,
              top: "calc(100% + 4px)",
              zIndex: 30,
              minWidth: 180,
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 6,
              padding: 4,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Link
              href={`${base}${query(day, null, sort)}`}
              className="rw3-hoverable"
              style={{ padding: "6px 8px", borderRadius: 6, fontSize: 12 }}
            >
              {strings.allMarkets}
            </Link>
            {markets.map((kind) => (
              <Link
                key={kind}
                href={`${base}${query(day, kind, sort)}`}
                className="rw3-hoverable"
                style={{
                  padding: "6px 8px",
                  borderRadius: 6,
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontWeight: kind === market ? 600 : 400,
                }}
              >
                <span style={{ color: "var(--muted)", display: "inline-flex" }}>
                  <Icon name={RW3_MARKET_ICON_BY_LIST_KIND[kind]} size={20} strokePx={1.75} />
                </span>
                {strings.marketLabels[kind]}
              </Link>
            ))}
          </div>
        </details>

        <Link
          href={`${base}${query(day, market, sort === "rate" ? "time" : "rate")}`}
          className="rw3-hoverable"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 12,
            padding: "4px 8px",
            border: "1px solid var(--line)",
            borderRadius: 6,
            color: "var(--muted)",
          }}
        >
          <Icon name="sort" size={13} />
          {sort === "rate" ? strings.sortByRate : strings.colTime}
        </Link>
      </span>
    </div>
  );
}
