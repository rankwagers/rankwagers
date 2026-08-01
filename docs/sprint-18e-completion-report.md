# Sprint 18E Completion Report — Acca Studio & Betting Workspace

**Date:** 2026-07-25  
**Status:** COMPLETE — awaiting approval  
**Next:** Do not start Sprint 18F until approved  
**Confirmation:** No Sprint 18F+ product functionality was implemented (no design-token overhaul, transparency dashboard, archive IA, Flutter app, or production deploy).

---

## Implemented features

### Global Acca domain
- `lib/acca/*` — types, markets allowlist, conflicts, odds/stake, risk, rules, persistence, share, export, analytics  
- Stable selection / slip IDs; anonymous local-first; named Accas  
- Undo stack; clear all; duplicate-fixture + unsupported-market handling  

### Workspace UI
- Site-wide `AccaWorkspace` in locale layout  
- Desktop sidebar panel + mobile bottom sheet (focus trap, Escape, ARIA)  
- Floating Acca launcher with selection count  
- Full studio page `/{locale}/acca` (**noindex**)  

### Add to Acca
Wired on: homepage top picks, fixture explorer, match predictions, competition hubs, team hubs; country hubs link into Acca/match flow; search deep-links to match pages.

### Markets
Settlement-backed only: Over 1.5 / 2.5, BTTS, FH/SH Over 0.5, Match Winner (when published). Odds never invented.

### Affiliate handoff
- `POST /api/acca/operators` → server `buildGoPath` (`placement: acca_studio`)  
- Explicit “we never place bets” copy  

### Share / save
- Copy text, Telegram-friendly export, share URL (`?share=` restore, noindex)  
- Named Accas in localStorage  
- Social metadata via `pageMetadata` on `/acca` (noindex)  

### Analytics
`acca_opened`, `acca_selection_added/removed`, `acca_cleared`, `acca_undo`, `acca_stake_entered`, `acca_operator_selected`, `acca_affiliate_handoff`, `acca_share_clicked`, `acca_copy_clicked`, `acca_telegram_export`, `acca_named_saved/loaded`

---

## Architecture

- Domain logic outside React (`lib/acca`) for Flutter reuse  
- Evidence Combo (`/combo`) kept as assisted-generation path  
- CTA signing remains server-only  

---

## Routes

| Route | Purpose |
|-------|---------|
| `/[locale]/acca` | Acca Studio workspace (noindex) |
| `/api/acca/operators` | Signed operator offers |

---

## Files changed (primary)

| Area | Paths |
|------|-------|
| Domain | `lib/acca/**` |
| UI | `components/acca/**` |
| Layout | `app/[locale]/layout.tsx` |
| Pages/API | `app/[locale]/acca/page.tsx`, `app/api/acca/operators/route.ts` |
| Surfaces | homepage, explorer, match predictions, competition/team, country, nav, HomepageAccaEntry |
| Analytics | `lib/analytics/types.ts` |
| Tests | `tests/sprint18eAcca.test.ts` (+ combo UI entry assert) |
| Docs | sprint plan, backlog, matrix, analytics, affiliate, acca-studio, this report |

---

## Validation gates

| Gate | Result |
|------|--------|
| `npm test` | **PASS** — 293/293 |
| `npm run build` | **PASS** — includes `/[locale]/acca` + `/api/acca/operators` |
| `npm run lint` | **PASS** |
| `npm run typecheck` | **PASS** |
| `npm run security:scan` | **PASS** — scanned 597 |
| `npm run scan:cta-boundary` | **PASS** — no findings |

---

## Known limitations

| Item | Notes |
|------|--------|
| Odds on list adds | Often null until match detail / odds fetch |
| Search “add” | Fixtures open match page; add there |
| Operator availability | Unknown / football landing — no fake bet-slip |
| Public indexed Accas | Explicitly deferred |

---

## Deferred (not started)

- **18F** Design / mobile / a11y system polish  
- **18G** Transparency dashboard / prediction archive  
- Flutter application  
- Production deploy  
- Acca image/social cards; trending public Accas  

---

## Confirmation: no Sprint 18F+ work

- No design-token / Flutter package sprint  
- No transparency dashboard  
- No archive route IA  
- No staging/production deploy  

**Stop here — wait for Sprint 18E approval before Sprint 18F.**
