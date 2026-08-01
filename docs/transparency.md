# Transparency & verification (Sprint 18G)

RankWagers trust is evidence-based: every qualified-list prediction can be inspected historically.

## Principles

- Never rewrite settled history  
- Never hide losses  
- Never fabricate ROI, yield, or average odds  
- Never selectively showcase winners only  
- Show sample size and methodology links next to performance claims  

## Data source

Durable source of truth for list markets:

`data/daily-archives/YYYY-MM-DD.json` via `lib/footystats/dailyArchive.ts`

Projection layer: `lib/archive/*` → `ArchivePredictionRecord` + `TransparencyMetrics`.

Publication odds / unit P/L are **null** until an append-only odds log exists. The UI shows “Unavailable” instead of inventing numbers.

## Surfaces

| Route | Role |
|-------|------|
| `/{locale}/archive` | Hub + transparency dashboard + filters + pagination |
| `/{locale}/archive/{date}` | Daily archive |
| `/{locale}/methodology` | Process documentation |
| Homepage verified section | Short-window summary linking to archive + methodology |

Competition / team / market archive views are available as **filters** on the hub (not mass thin PSEO pages).

## Metrics (allowed)

- Total / settled / won / lost / void / pending  
- Hit rate = wins ÷ (wins + losses) among settled rows only  
- Sample notes and last archive update timestamp  
- Breakdowns by market and top competitions  

## Metrics (forbidden until durable odds)

- Average odds  
- ROI / yield / bankroll curves  

## Flutter readiness

`lib/archive/types.ts` contracts are browser-safe and UI-independent. Loaders in `lib/archive/load.ts` are server-side and can back future history APIs without Flutter-specific code.
