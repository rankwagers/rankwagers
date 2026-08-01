# Prediction settlement methodology (Sprint 18B)

Settlement is **server-authoritative** and UI-independent. Domain logic lives in `lib/fixtures/settlement.ts` and is consumed by `lib/fixtures/loadMatchPage.server.ts`. React components only render settlement results.

## Principles

1. Never invent a final result when provider scores are missing.
2. Never silently rewrite a publication snapshot when current odds change.
3. Prefer **void** / **pending** over speculative won/lost.
4. Unit P/L is computed only when decimal odds were observed and the market settled won/lost (stake = 1 unit).

## Lifecycle → settlement defaults

| Match lifecycle | Default settlement effect |
|-----------------|---------------------------|
| scheduled / pre_match / live | `pending` (except FH when HT goals already decide) |
| half_time | FH may settle; other markets `pending` |
| finished | Settle from FT (+ HT for FH/SH) |
| postponed | `void` |
| cancelled / abandoned | `cancelled` |
| suspended | `pending` until a final result exists |
| unavailable / missing scores after finish | `void` |

## Supported markets (published on match page when potentials &gt; 0)

| Market key | Selection model | Win condition |
|------------|-----------------|---------------|
| `over15` | Over 1.5 goals | FT home+away ≥ 2 |
| `over25` | Over 2.5 goals | FT home+away ≥ 3 |
| `fh` | First-half over 0.5 | HT home+away ≥ 1 |
| `sh` | Second-half over 0.5 | (FT−HT) goals ≥ 1; requires HT scores |
| `btts` | Yes | FT home &gt; 0 and away &gt; 0 |

## Settlement helpers ready but not published yet

These helpers exist for API/Flutter reuse but are **not published** on the match page until durable selection snapshots exist:

- `match_winner` — selection `home` \| `draw` \| `away`
- `double_chance` — selection `1X` \| `12` \| `X2`
- `draw_no_bet` — selection `home` \| `away`; draw → `push`

## Explicitly deferred (unsafe with current contracts)

- Corners, cards, Asian handicap, correct score, player props  
Listed in `DEFERRED_SETTLEMENT_MARKETS`.

## Publication snapshot honesty

Sprint 18B captures **page-build observation** of provider potentials and odds (`publishedAt` = live context fetch time) on match pages.

Sprint **18G** ships durable **daily list archives** (`data/daily-archives`) projected through `lib/archive/*` for transparent history. Archive rows expose publication proxy (`savedAt`), kickoff, market, confidence, evidence summary, and settlement — without fabricating original odds or unit P/L.

A per-prediction append-only odds log (corrections audit, never-overwrite odds) remains a follow-on when publication odds are stored durably. Until then, average odds / ROI stay unavailable.

The UI separates:

- Observation / publication window  
- Kickoff  
- Settlement explanation  
- Archive historical record (list markets)

## Refresh policy

- Live / half-time: soft client `router.refresh` every 60s (`MatchLiveRefresh`)  
- Finished / scheduled / disrupted: no live polling  

## Flutter / API readiness

`settlePrediction` and `MatchPageModel` types in `lib/fixtures/types.ts` are browser-safe contracts. The loader is `server-only` and can back a future JSON API without reimplementing settlement in Flutter.
