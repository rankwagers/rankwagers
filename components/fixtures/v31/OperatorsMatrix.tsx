import { Icon } from "@/components/v3/Icon";
import { OperatorLogo } from "@/components/v3/OperatorLogo";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";
import type { PricePanelData, PricePanelRow } from "@/lib/operators/pricePanel.server";

/* ============================================================================
   FIXTURE v3.1 — LAYER 5: THE OPERATORS × MARKETS MATRIX.

   One table: operators down, this match's OBSERVED markets across. Cells are
   ghost odds — an observed decimal or a muted "—", NEVER a stand-in price
   (the no-fake-price law; prices arrive kickoff-frozen and pre-signed from
   the server panel). The market's TOP price wears the green outline —
   decimal odds' best IS the highest (the DECIDED max, flagged in the plan).
   ONE Best badge in the whole table, on the operator holding the most top
   prices. Every row closes on a ghost Continue when the operator carries a
   signed link; an unavailable operator's observation still renders as
   research and links nowhere. No observed market → the matrix is omitted
   whole (empty-state law).
   ========================================================================== */

const MATRIX_MARKETS: ReadonlyArray<{ key: string; labelKey: keyof PredictionStrings }> = [
  { key: "over15", labelKey: "v3MktOver15" },
  { key: "over25", labelKey: "v3MktOver25" },
  { key: "fh", labelKey: "v3MktFh" },
  { key: "sh", labelKey: "v3MktSh" },
  { key: "btts", labelKey: "v3MktBtts" },
];

type MatrixRow = {
  slug: string;
  name: string;
  verified: boolean;
  available: boolean;
  continueHref: string | null;
  cells: Map<string, PricePanelRow>;
  bestCount: number;
};

export function OperatorsMatrix({
  prices,
  operatorLogos,
  p,
}: {
  prices: PricePanelData;
  /** slug → logo path (the registry's wordmark assets), for the light chip. */
  operatorLogos: Record<string, string | null>;
  p: PredictionStrings;
}) {
  const markets = MATRIX_MARKETS.filter((market) => (prices[market.key] ?? []).length > 0);
  if (!markets.length) return null;

  /* The market's top price — the HIGHEST observed decimal (DECIDED). */
  const bestByMarket = new Map<string, number>();
  for (const market of markets) {
    bestByMarket.set(
      market.key,
      Math.max(...prices[market.key].map((row) => row.decimal))
    );
  }

  const bySlug = new Map<string, MatrixRow>();
  for (const market of markets) {
    for (const row of prices[market.key]) {
      const existing = bySlug.get(row.operatorSlug) ?? {
        slug: row.operatorSlug,
        name: row.operatorName,
        verified: row.verified,
        available: row.available,
        continueHref: null,
        cells: new Map<string, PricePanelRow>(),
        bestCount: 0,
      };
      existing.cells.set(market.key, row);
      existing.continueHref = existing.continueHref ?? row.continueHref;
      if (row.decimal === bestByMarket.get(market.key)) existing.bestCount += 1;
      bySlug.set(row.operatorSlug, existing);
    }
  }
  const rows = [...bySlug.values()].sort(
    (a, b) =>
      Number(b.available) - Number(a.available) ||
      Number(b.verified) - Number(a.verified) ||
      b.bestCount - a.bestCount ||
      a.name.localeCompare(b.name)
  );
  /* ONE Best badge in the table — the row holding the most top prices. */
  const bestRow = rows.reduce((top, row) => (row.bestCount > top.bestCount ? row : top), rows[0]);

  return (
    <div className="mt-6" data-fx31-matrix="">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h3 className="rw3-label">{p.v3OperatorsMatchMarkets}</h3>
        <span className="rw3-meta">{p.v3TopPriceOutline}</span>
      </div>
      <div className="fx31-matrix-table" style={{ overflowX: "auto" }}>
        <table className="mt-2 w-full text-[12px]" style={{ borderCollapse: "collapse", minWidth: 520 }}>
          <thead>
            <tr>
              <th className="rw3-meta py-2 text-left font-normal" style={{ borderBottom: "1px solid var(--line)" }} />
              {markets.map((market) => (
                <th
                  key={market.key}
                  className="rw3-meta px-2 py-2 text-right font-normal"
                  style={{ borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}
                >
                  {p[market.labelKey] as string}
                </th>
              ))}
              <th style={{ borderBottom: "1px solid var(--line)" }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.slug}>
                <td className="py-2 pr-3" style={{ borderBottom: "1px solid var(--line)" }}>
                  <span className="flex items-center gap-2" style={{ whiteSpace: "nowrap" }}>
                    <OperatorLogo logo={operatorLogos[row.slug] ?? null} name={row.name} variant="row" />
                    <span className="font-medium">{row.name}</span>
                    {row === bestRow && row.bestCount > 0 ? (
                      <span className="rw3-pill" style={{ fontSize: 10, color: "var(--win)", borderColor: "var(--win)" }}>
                        {p.v3Best}
                      </span>
                    ) : null}
                  </span>
                </td>
                {markets.map((market) => {
                  const cell = row.cells.get(market.key);
                  if (!cell) {
                    return (
                      <td
                        key={market.key}
                        className="px-2 py-2 text-right"
                        style={{ borderBottom: "1px solid var(--line)", color: "var(--muted)" }}
                        title={p.v3NoObservation}
                      >
                        —
                      </td>
                    );
                  }
                  const isTop = cell.decimal === bestByMarket.get(market.key);
                  const price = cell.decimal.toFixed(2);
                  return (
                    <td
                      key={market.key}
                      className="px-2 py-2 text-right"
                      style={{ borderBottom: "1px solid var(--line)" }}
                    >
                      {cell.continueHref ? (
                        <a
                          href={cell.continueHref}
                          rel="nofollow sponsored noopener"
                          className="rw3-ghost"
                          data-fx31-top-price={isTop ? "" : undefined}
                          style={{
                            fontSize: 12,
                            padding: "2px 8px",
                            ...(isTop ? { borderColor: "var(--win)", color: "var(--win)" } : {}),
                          }}
                        >
                          {price}
                        </a>
                      ) : (
                        <span
                          data-fx31-top-price={isTop ? "" : undefined}
                          style={
                            isTop
                              ? {
                                  border: "1px solid var(--win)",
                                  borderRadius: 6,
                                  padding: "2px 8px",
                                  color: "var(--win)",
                                }
                              : { color: "var(--muted)" }
                          }
                        >
                          {price}
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="py-2 pl-3 text-right" style={{ borderBottom: "1px solid var(--line)" }}>
                  {row.continueHref ? (
                    <a
                      href={row.continueHref}
                      rel="nofollow sponsored noopener"
                      className="rw3-ghost"
                      style={{ fontSize: 11, padding: "2px 8px", whiteSpace: "nowrap" }}
                    >
                      {p.v3Continue} <Icon name="arrow" size={11} />
                    </a>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/*
        THE MOBILE ACCORDION — the same observations, one <details> per
        market (CSS swaps it in below the breakpoint; no JS, no navigation).
        The same rows, the same top-price outline, the same no-fake-price
        silence: an operator without an observation simply isn't listed.
      */}
      <div className="fx31-matrix-accordion mt-2">
        {markets.map((market) => (
          <details key={market.key} style={{ borderBottom: "1px solid var(--line)" }}>
            <summary
              className="rw3-hoverable flex items-baseline justify-between gap-4 py-2.5 text-[13px] font-medium"
              style={{ cursor: "pointer", listStyle: "none" }}
            >
              <span>{p[market.labelKey] as string}</span>
              <span style={{ color: "var(--win)" }}>
                {bestByMarket.get(market.key)!.toFixed(2)}
              </span>
            </summary>
            <ul style={{ margin: 0, padding: "0 0 8px" }}>
              {prices[market.key].map((row) => {
                const isTop = row.decimal === bestByMarket.get(market.key);
                return (
                  <li
                    key={row.operatorSlug}
                    className="flex items-center justify-between gap-3 py-1.5 text-[12px]"
                    style={{ listStyle: "none" }}
                  >
                    <span className="flex items-center gap-2">
                      <OperatorLogo
                        logo={operatorLogos[row.operatorSlug] ?? null}
                        name={row.operatorName}
                        variant="row"
                      />
                      {row.operatorName}
                    </span>
                    {row.continueHref ? (
                      <a
                        href={row.continueHref}
                        rel="nofollow sponsored noopener"
                        className="rw3-ghost"
                        style={{
                          fontSize: 12,
                          padding: "2px 8px",
                          ...(isTop ? { borderColor: "var(--win)", color: "var(--win)" } : {}),
                        }}
                      >
                        {row.decimal.toFixed(2)}
                      </a>
                    ) : (
                      <span style={isTop ? { color: "var(--win)" } : { color: "var(--muted)" }}>
                        {row.decimal.toFixed(2)}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </details>
        ))}
      </div>
    </div>
  );
}
