/*
 * THE BUNDLE BOUNDARY — this helper is pure and dependency-free ON PURPOSE.
 *
 * It used to live in lib/dictionaryExtras.ts, which VALUE-imports the entire
 * 30-locale dictionary tree (predictionsEn + predictionsLocales + Europe +
 * Asia). Two "use client" components (PricePanel, AccaOperators) imported
 * `formatDict` from there after the commercial pass, and the whole dictionary
 * graph walked into the client bundle: First Load JS tripled on /acca,
 * /fixtures/[matchId] and /markets/[slug] (~116→300 kB class regression).
 *
 * Client components receive fully-prepared, serializable strings as props;
 * the dictionaries stay server-side. Nothing may be added to this module
 * that imports anything — the perf-budget probe pins the routes.
 */
export function formatDict(
  template: string,
  vars: Record<string, string>
): string {
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replaceAll(`{${k}}`, v),
    template
  );
}
