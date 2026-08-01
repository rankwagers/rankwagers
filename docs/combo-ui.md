# Evidence Combo Studio UI (Sprint 16 Phase C)

## Route

- Public page: `/[locale]/combo`
- Canonical: base path only (query presets such as `?target=` are applied then stripped client-side)
- Indexable studio shell only — generated combo IDs are not separate pages and are not in the sitemap

## Prepared-data boundary

Server-only module: `lib/combo/prepare.ts`

| Function | Role |
|---|---|
| `prepareComboData()` | Loads daily lists (reuses FootyStats safe loader), optional bounded odds enrichment, builds `ComboClientSnapshot` |
| `hydrateComboDomainSnapshot()` | Test/injection helper without provider I/O |
| `getPreparedComboSnapshot()` | Read process store if present |

Rules:

- React components never call providers
- Combo API route handlers never call providers
- Client POSTs fixtures + odds + `dataSnapshot` from the SSR snapshot
- `persist: false` must not leave global prepared state (unit tests)

## Component map

`components/combo/*` — studio form, progress, result, selection cards, alternatives, operators, sticky bar, sheet, homepage launcher.

API orchestration lives in `ComboStudio` + `lib/combo/clientApi.ts`. Scoring stays in Phase A domain.

Selection reasoning reuses Sprint 14 `components/evidence-ui` primitives via `ComboReasoningPanel`.

## Supported market controls

Only enabled prefs:

- Over 1.5 Goals
- Over 2.5 Goals
- First Half Over 0.5
- Second Half Over 0.5
- Mixed

Unsupported (not rendered): BTTS, 1X2, Double Chance, Draw No Bet.

## Operator-state behavior

| State | Best Match | Primary CTA |
|---|---|---|
| full | Allowed | Deeplink-aware label via `/go/{slug}` |
| partial | No | May CTA with partial copy |
| unknown | Never | Visit Operator / Copy Combo / details |
| unavailable / none | No | No affiliate CTA |

Client never re-ranks operators — API order is preserved.

## Session persistence

- `localStorage`: target range, risk, markets, selection count
- `sessionStorage`: last generated combo (marked stale on restore → Refresh Combo)

## Mobile flow

After a valid combo: sticky bar → `ComboOperatorSheet` (focus trap, Escape, safe-area, dismissible).

## Analytics hooks

Typed via `trackComboEvent` / `lib/analytics` event names (`combo_*`). Safe no-op when no production backend is connected. No raw provider payloads.

## Crawl behavior

- Inventory hub: `/combo`
- Sitemap static path
- Homepage + header + tracked market pages link in
- No generated combo URLs

## Phase D operator honesty

- 13 configured mapping shells; **0** verified API-Football bookmaker IDs
- Selection availability remains **unknown** until explicit provider IDs are configured
- Operator-specific combined odds remain unavailable without verified quotes
- Homepage affiliate fallback via signed `/go/{slug}?ctx=…` remains functional
- UI copy: Verified availability · Availability could not be confirmed · Combined operator odds unavailable · Opens operator homepage
- Postback adapters remain disabled until real specifications and credentials exist
- Copy Combo remains the universal fallback

## Known limitations

- No betslip / market / fixture deeplinks without verified docs
- Homepage does not block on combo generation
- No production analytics backends or deployment config in this phase
