# Acca Studio (Sprint 18E)

## Product role

Acca Studio is RankWagers’ interactive betting **workspace** — not a bookmaker bet slip.

Journey: Discover → Research → Compare → Build Acca → Review → Choose operator → Affiliate handoff.

## Domain (`lib/acca/`)

UI-independent, Flutter-ready modules:

| Module | Responsibility |
|--------|----------------|
| `types.ts` | Slip, selection, risk, share DTOs |
| `markets.ts` | Settlement-backed market allowlist |
| `rules.ts` | Add / remove / toggle / clear / stake |
| `conflicts.ts` | Same-fixture & duplicate selection |
| `odds.ts` | Combined decimal odds, return, profit |
| `risk.ts` | Explainable risk class (deterministic) |
| `persistence.ts` | localStorage slip + named Accas |
| `share.ts` | Encode/decode noindex share payloads |
| `exportText.ts` | Copy / Telegram text |
| `analytics.ts` | `acca_*` events |
| `operators.server.ts` | Server-only signed CTAs (`placement: acca_studio`) |

## Global state

`AccaProvider` + `AccaWorkspace` in `app/[locale]/layout.tsx`.

- Anonymous local-first persistence  
- Undo stack  
- Safe hydration  
- Desktop sidebar + mobile bottom sheet  

## Routes

| Route | Indexable | Notes |
|-------|-----------|-------|
| `/[locale]/acca` | **no** | Studio + `?share=` restore |
| `/[locale]/acca/builder` | **no** | Automatic Evidence-Based Acca Builder (Sprint 19.5) |
| `/api/acca/operators` | n/a | Signs operator CTAs |
| `/api/acca/builder` | n/a | Generates ranked combinations |

Automatic generation lives at Acca Builder (`docs/acca-builder.md`). `/combo` redirects to `/acca/builder`. Builder drafts transfer via `transferBuilder` (merge/replace) into this Studio slip — one slip model only.

## Supported markets

`over15`, `over25`, `btts`, `fh`, `sh`, `match_winner` — only when settlement-backed and data is available. Never invent odds.

## Affiliate

CTAs via `buildGoPath` on the server only. UI never places bets and never claims a bet was placed.

## Out of scope (18F+)

Public indexed Acca pages, image cards, Flutter app, design-token overhaul, transparency archive.
