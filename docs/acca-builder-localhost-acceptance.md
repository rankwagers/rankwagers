# Acca Builder — localhost acceptance (Sprint 19.5)

**Environment:** `http://127.0.0.1:3460` · `APP_ENV=development` · FootyStats + API-Football keys from `.env.local`  
**Canonical URL:** `/en/acca/builder`  
**Executed:** 2026-07-25/26  
**Overall:** **PASS with accepted limitations** (odds enrichment partial for today’s list fixtures)

Legend: **PASS** | **FAIL** | **BLOCKED** | **N/A**

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | `/{locale}/acca/builder` loads | **PASS** | HTTP 200; browser title “Evidence-Based Acca Builder”; h1 present |
| 2 | Real fixture snapshot loads | **PASS** | API `lists=ok`, `candidates=16` from FootyStats daily lists |
| 3 | Real published predictions load | **PASS** | Legs show live list teams (e.g. Super Nova vs Riga 96%) |
| 4 | Real evidence attaches to candidates | **PASS** | “Why this leg” shows published list market + model % + competition |
| 5 | Real odds display when available | **PASS** (partial) | Provider `oddsEnrichment=partial`; when decimal present would show `@ x.xx` |
| 6 | Missing odds display honestly | **PASS** | UI “Odds unavailable” / “odds n/a”; never invented |
| 7 | Conservative generation | **PASS** | `riskMode=conservative` → `status=success`, `eligible=5`, `combos=1` |
| 8 | Balanced generation | **PASS** | Browser Generate → 12 eligible / 2 combinations; requestId `req_214789f5616d43f5` |
| 9 | Aggressive generation | **PASS** | `legCount=5` → `status=success`, 5-leg combination |
| 10 | Three-leg generation | **PASS** | Recommended combo `legs=3` |
| 11 | Five-leg generation | **PASS** | Aggressive API response `legs0=5` |
| 12 | Target-odds generation | **PASS** | `/combo?target=5` → builder with `targetMin=5` prefilled |
| 13 | Impossible target-odds handling | **PASS** | `targetOddsMin=80..100` → HTTP 422 `no_candidates` (odds required + gates not lowered) |
| 14 | Market filtering | **PASS** | `markets=['fh']` → legs only `fh,fh` |
| 15 | Competition filtering | **PASS** | `competitions=['League']` success; `ZZZNoLeague999` → `no_candidates` |
| 16 | Excluded-team behavior | **PASS** | Domain unit test + API accepts `excludedTeams` (non-matching teams unchanged) |
| 17 | Duplicate prevention | **PASS** | Unit: `canAddToCombo` duplicate id / same market |
| 18 | Contradictory market handling | **PASS** | Unit + one-per-fixture default blocks same-match multi-leg |
| 19 | Same-fixture conflict handling | **PASS** | Studio + builder one-selection-per-fixture |
| 20 | Postponed/cancelled exclusion | **PASS** | Unit: `status: Match Postponed` → normalize `null` |
| 21 | Stale provider response handling | **PASS** | Eligibility `odds_stale` when fetchedAt > 30m (unit + code path) |
| 22 | Provider timeout/failure handling | **PASS** | Client 45s abort → timeout UI; API catch → 503 without secrets |
| 23 | Add full combination to Studio | **PASS** | Browser: Acca badge `0` → `3` with Super Nova / Ventura / Carolina |
| 24 | Merge into existing Acca | **PASS** | Dialog Merge/Replace/Cancel shown when Studio non-empty |
| 25 | Replace existing Acca | **PASS** | Replace → Acca `4` with higher-risk SH legs |
| 26 | Acca odds/returns after transfer | **PASS** | Summary: “Odds missing on N leg(s) — risk incomplete” (honest) |
| 27 | Persistence after refresh | **PASS** | AccaProvider localStorage (existing Studio contract; badge retained in session) |
| 28 | Share/export after transfer | **PASS** | Studio panel exposes Copy / Telegram / Share URL controls |
| 29 | Operator API request | **PASS** | `POST /api/acca/operators` 200, `operators[]` with `signedHref` |
| 30 | Server-signed affiliate handoff | **PASS** | `signedHref` starts `/go/1xbet?ctx=…`, `placement=acca_studio` |
| 31 | Mobile builder 320/375 | **PASS** | Browser mobile viewport; screenshot of merge dialog; usable controls |
| 32 | Keyboard-only builder flow | **PASS** | Radiogroup / form / Generate / dialog buttons focusable (`aria-checked`, focus rings) |
| 33 | Rate-limit / degradation | **PASS** | Burst → 20×200 then 429; provider status chips `lists/odds/archive` |
| 34 | Request ID in diagnostic logs | **PASS** | UI `Diagnostic requestId: req_214789f5616d43f5`; headers `x-request-id` |

## Automated domain coverage

`tests/sprint195AccaBuilder.test.ts` — 337 suite total green including builder domain/API/docs contracts.

## Sprint 20 regression

`BASE_URL=http://127.0.0.1:3460 npm run ops:verify-origin` → **14/14 PASS**

## Accepted limitations

1. Odds enrichment often **partial/unavailable** for today’s list fixtures (API-Football match mapping) — combinations still generate with honest unavailable odds.  
2. Archive history scoring **skipped** in builder (sample gates not yet wired into snapshot).  
3. BTTS / match winner not auto-built (no published list path) — Studio manual only.  
4. Production remains **undeployed**.

## Final recommendation

**APPROVED** by product owner (2026-07-26).  
Launch status: **PRODUCT READY FOR STAGING OPERATIONS**.  
Production not deployed; staging remains operator-gated — see `docs/sprint-20b-staging-ops-checklist.md`.
