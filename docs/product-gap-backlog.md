# RankWagers — Product Gap Backlog

**Updated:** 2026-07-25 · after Sprint 18C  
**Priority:** P0 blocks basic product use · P1 major incomplete flow · P2 quality/SEO/UX · P3 polish  
**Status:** `DONE (18A)` · `DONE (18B)` · `DONE (18C)` · open · deferred to later sprint

Columns: **ID** · **Status** · **Priority** · **Area** · **Finding** · **Notes**

---

## P0

| ID | Status | Area | Finding | Notes |
|----|--------|------|---------|-------|
| P0-01 | **DONE (18A)** | affiliate / SEO | `/best-betting-sites` crypto variant | Now `variant="betting"` + `bestBettingTitle` / `bestBettingDescription` |
| P0-02 | **DONE (18A)** | homepage | Saved workspace dead | localStorage + `SavedFixturesPanel` list + deep-open links |
| P0-03 | **DONE (18A)** | homepage | Inspect did not open fixture | `?fixture=&market=#fixtures` deep-open + expand |
| P0-04 | **DONE (18B)** | match detail | No shareable match detail page | `/{locale}/fixtures/{matchId}` + settlement + SEO |
| P0-05 | **DONE (18A)** | technical interaction | Silent match-detail failure | Error + Retry in expander |
| P0-06 | **DONE (18A)** | navigation / affiliate | Nav omitted bookmaker hubs | Grouped nav; Best sites + Bonuses in desktop primary |
| P0-07 | open | content | Research UI hardcoded English | Hero/trust dict keys done (18C); explorer/combo EN remains post-18G i18n |

---

## P1

| ID | Status | Area | Finding | Notes |
|----|--------|------|---------|-------|
| P1-01 | **DONE (18A)** | navigation | Flat nav / mobile wall | `lib/navigation/primaryNav.ts` Research / Bookmakers / Browse |
| P1-02 | **DONE (18A/18B)** | search | Homepage search href `#fixtures` only | Now `homepageSearchResultHref` → `/fixtures/{id}` |
| P1-03 | **DONE (18D)** | search | Global search no fixtures | Archive-window fixtures + fuzzy + countries in index |
| P1-04 | **DONE (18A)** | homepage | No date UI | `HomepageDateControl` bound to `?date=` |
| P1-05 | **DONE (18A)** | accessibility | Missing heading ids | SectionHeading `id` props |
| P1-06 | **DONE (18F)** | mobile | Filter chips at 320px | Horizontal snap toolbar + touch targets |
| P1-07 | **DONE (18F)** | mobile | Fixture detail density | Tighter card padding / radius tokens |
| P1-08 | **DONE (18C)** | content / trust | Highest confidence undefined | Top picks explain model probability; methodology linked |
| P1-09 | open | content / trust | Crypto FAQ overclaim | Post-18G copy pass |
| P1-10 | open | content / trust | Live Signals tipster risk | Post-18G trust framing |
| P1-11 | open | SEO | Thin locale duplicates | Ongoing localization |
| P1-12 | **PARTIAL (18D)** | SEO | Thin entity pages | Quality gates + country foundation; deeper entity content ongoing |
| P1-13 | **PARTIAL (18C/18D)** | navigation | Operators vs reviews IA | Footer/bookmaker hubs improved; reviews entry polish remains |
| P1-14 | **DONE (18A)** | visual design | Availability dark remnant | Restyled to Design Bible |
| P1-15 | **DONE (18E)** | Acca Studio | Mobile comparison friction | Global Acca sheet + operator handoff |
| P1-16 | **DONE (18G)** | data transparency | Verified vs unknown legend | Archive + methodology + unavailable odds honesty |
| P1-17 | **DONE (18B)** | match detail | No share/copy/breadcrumb | Breadcrumb + canonical URL; copy UX polish optional later |
| P1-18 | **DONE (18A)** | homepage | Trending tiles no market filter | Deep-link `?market=` |

---

## P2 — important quality / UX / SEO (24)

| ID | Area | Finding | Evidence |
|----|------|---------|----------|
| P2-01 | homepage | Model v2.4.1 unexplained | `page.tsx` modelMeta |
| P2-02 | homepage | Research notes are aggregates not notes | Insight cards |
| P2-03 | match detail | No standings | Absent |
| P2-04 | match detail | Related fixtures weak | Same match markets only |
| P2-05 | match detail | Responsible-use note only in footer | — |
| P0-195 | **DONE (19.5 approved)** | Acca Builder | Automatic evidence-based Acca generation + Studio transfer | `/acca/builder` |
| P0-20B | **OPEN (ops)** | Staging | Sprint 20B staging deploy + live ops verification | `docs/sprint-20b-staging-ops-checklist.md` |
| P0-21 | **DONE (21)** | Admin intelligence | Internal dashboard + aggregations + export | `/admin/dashboard` |
| P0-22 | **DONE (22)** | SEO intelligence | Indexability, contracts, sitemap governance, admin SEO | `/admin/seo` |
| P0-23 | **DONE (23)** | Affiliate intelligence | Operator registry, availability, placements, funnels | `/admin/affiliate` |
| P0-24 | **DONE (24)** | Calibration intelligence | Confidence bands, sample gates, Builder quality governance | `/admin/calibration` |
| P0-25 | **DONE (25)** | Experimentation platform | Definitions, assignment, SRM, guardrails, preview | `/admin/experiments` |
| P1-24a | OPEN | Calibration | Append-only immutable publication snapshots | daily archives overwrite-mutable |
| P1-24b | OPEN | Builder eval | Persist generation/combination snapshots for settlement linkage | `persist: false` today |
| P1-25a | OPEN | Experiments | Consent-aware durable anonymous visitor ID | session-only today |
| P1-25b | OPEN | Experiments | Operator-approved staging/production activation workflow | no activate endpoint |
| P2-06 | Combo Studio | Candidate pool opacity pre-generate | Superseded by Builder redirect |
| P2-07 | Combo Studio | Correlation jargon | Builder warnings |
| P2-08 | Combo Studio | Feature flag can 404 product | `comboRouteEnabled` still gates redirect |
| P2-09 | search | Limited typo tolerance | normalizer only |
| P2-10 | search | Fixture filters not in URL | client state |
| P2-11 | SEO | Reviews + operators duplicate intent | sitemap both |
| P2-12 | SEO | Availability low-value indexable | availability page |
| P2-13 | SEO | Compare combinatorial residue | generateStaticParams |
| P2-14 | visual | Card overuse vs design rules | home grids |
| P2-15 | visual | Affiliate vs bible visual split | AffiliateHomeContent |
| P2-16 | mobile | Combo sticky obscures content | ComboStickyBar |
| P2-17 | **DONE (18F)** | Header search width contention | Wider `w-52 xl:w-64` |
| P2-18 | **PARTIAL (18F)** | Live region gaps (search/combo) | Search aria-live; combo later |
| P2-19 | **DONE (18F)** | Contrast on gold error banner | Amber token alert + copy |
| P2-20 | affiliate | Homepage operator strip disclosure weaker than footer | BibleOperatorStrip |
| P2-21 | affiliate | Review bonus strings may be stale | brands data |
| P2-22 | data | Odds intelligence mobile chart | OddsChart |
| P2-23 | navigation | Seasons nested discoverability | seasons routes |
| P2-24 | technical | SidebarBannerSlot unused on current home | predictions/SidebarBannerSlot |

---

## P3 — polish / optional (14)

| ID | Area | Finding |
|----|------|---------|
| P3-01 | **DONE (18F)** | Reduced-motion policy incomplete |
| P3-02 | a11y | 404/error hardcode `/en` |
| P3-03 | content | Microcopy consistency (Inspect / View / Continue) |
| P3-04 | visual | Icon + eyebrow rhythm polish |
| P3-05 | Combo | Progress stage copy tuning |
| P3-06 | search | Empty-state suggestions richer |
| P3-07 | SEO | OG images per entity type |
| P3-08 | nav | Methodology vs Research Notes naming |
| P3-09 | **DONE (18F)** | Drawer close focus return polish |
| P3-10 | data | Stronger provider badges everywhere |
| P3-11 | homepage | Animation delay cascade revisit |
| P3-12 | legal | Per-locale legal depth review |
| P3-13 | analytics | Ensure no destination URLs in payloads (spot-check) |
| P3-14 | today | `/today` alias documentation for users |

---

## External-data blockers (not local code defects)

| ID | Blocker | Affects |
|----|---------|---------|
| EXT-01 | FootyStats / API-Football keys + freshness | Home, entities, combo snapshot |
| EXT-02 | Telegram live engine | Live Signals richness |
| EXT-03 | Affiliate network config per brand | CTA enablement |
| EXT-04 | Broad odds bookmaker coverage | Honest unknown availability volume |

---

## Counts (audit baseline)

| Priority | Count |
|----------|------:|
| P0 | 7 (5 done in 18A; 2 open) |
| P1 | 18 (8 done in 18A) |
| P2 | 24 |
| P3 | 14 |
| External | 4 |

---

## Future epic backlog (NOT COMPLETE — planned only)

See `docs/product-sprint-plan.md` for full committed vs later vs post-launch vs Flutter-readiness layers. Items below are **roadmap commitments for future sprints**, not done work.

### Sprint 18B — Match Detail & Live Match Intelligence

| Epic ID | Status | Summary |
|---------|--------|---------|
| E18B-01 | **DONE (18B)** | SEO match URL + lifecycle states (pre/live/HT/FT/postponed/cancelled/abandoned/suspended/unavailable) |
| E18B-02 | **DONE (18B)** | Live score, clock, goals, red cards, HT/FT (when provider supplies) |
| E18B-03 | **DONE (18B)** | Betting-relevant stats only (no SofaScore clone); empty/unavailable states |
| E18B-04 | **DONE (18B)** | Prediction publish meta, odds, confidence, settlement statuses (supported markets) |
| E18B-05 | **DONE (18B)** | Prediction timeline + server settlement; durable list archive surfaces shipped in 18G |
| E18B-06 | **DONE (18B)** | Related links + BreadcrumbList/SportsEvent/canonical/OG via `pageMetadata` |

### Sprint 18C — Homepage Experience & Trust

| Epic ID | Status | Summary |
|---------|--------|---------|
| E18C-01 | **DONE (18C)** | Coherent VP + top picks + live matches (provider-only) |
| E18C-02 | **DONE (18C)** | Thin Acca entry + verified performance + recent W/L transparency |
| E18C-03 | **DONE (18C)** | League/footer/operator internal links + editorial affiliates |

### Sprint 18D — Search, Discovery & Programmatic SEO

| Epic ID | Status | Summary |
|---------|--------|---------|
| E18D-01 | **DONE (18D)** | Global fixture/team/league/country/market/operator search + fuzzy |
| E18D-02 | **DONE (18D)** | Entity deep links + URL filters + quality-gated PSEO foundation |
| E18D-03 | **DONE (18D)** | Country landings with unique value (no doorways) |

### Sprint 18E — Acca Studio

| Epic ID | Status | Summary |
|---------|--------|---------|
| E18E-01 | **DONE (18E)** | Global Acca state; add-from anywhere; panel/sheet; persistence |
| E18E-02 | **DONE (18E)** | Odds/stake/return; risk/confidence; conflicts; server CTA |
| E18E-03 | **DONE (18E)** | Save/share/export analytics; no fake bet-placed claims |
| E18E-LATER | later | Public/trending/curated Accas; assisted generation; social cards |

### Sprint 18F — Design, Mobile, A11y & Cross-Platform Readiness

| Epic ID | Status | Summary |
|---------|--------|---------|
| E18F-01 | **DONE (18F)** | Design tokens + premium system + Flutter-conceptual parity |
| E18F-02 | **DONE (18F)** | A11y (keyboard, SR, focus, contrast, reduced-motion) |
| E18F-03 | **DONE (18F)** | Mobile density/performance + state patterns |

### Sprint 18G — Transparency, Verification, Archive & Product Credibility

| Epic ID | Status | Summary |
|---------|--------|---------|
| E18G-01 | **DONE (18G)** | Daily-archive projection + methodology metrics (odds/ROI omitted honestly) |
| E18G-02 | **DONE (18G)** | `/archive` hub + daily pages + transparency dashboard |
| E18G-03 | **PARTIAL (18G)** | Archive/methodology SEO + schema + sitemap; CWV/Search Console ops → later |
| E18G-04 | **DONE (prior + 18G)** | Funnel events maintained; archive analytics added; disclosure in footer |

### Cross-cutting — Flutter readiness (no Flutter code in Sprint 18)

| Epic ID | Status | Summary |
|---------|--------|---------|
| E-FLUTTER-01 | planned (arch) | API-first domain services; versioned contracts |
| E-FLUTTER-02 | planned (arch) | Server-authoritative settlement/Acca rules |
| E-FLUTTER-03 | planned (arch) | Stable IDs; deep links; push-ready event taxonomy |
| E-FLUTTER-04 | post-launch | Flutter application implementation |

### Sprint 19 — Production readiness

| Epic ID | Status | Summary |
|---------|--------|---------|
| E19-01 | **DONE (19)** | Release gates: CTA boundary in CI + validate-release |
| E19-02 | **DONE (19)** | Request IDs + ready correlation; smoke header checks |
| E19-03 | **DONE (19)** | Perf/SEO/a11y audit docs + targeted config hardening |
| E19-04 | **DONE (19)** | Launch checklist + readiness report (promote still ops-blocked) |
| E19-05 | blocked (ops) | Live staging smoke, restore/rollback drills, GSC, signed-redirect flip |

### Sprint 20 — Production launch & verification

| Epic ID | Status | Summary |
|---------|--------|---------|
| E20-01 | **DONE (20)** | Preflight + origin verify + rollback rehearsal scripts |
| E20-02 | **DONE (20)** | Launch report + GSC/Bing operator checklist |
| E20-03 | blocked (ops) | Live deploy to real domain |
| E20-04 | blocked (ops) | Search Console + Bing property evidence |
| E20-05 | blocked (ops) | Live affiliate redirect + signed-redirect enforcement |

### Post-launch opportunities (after Sprint 19)

| Epic ID | Status | Summary |
|---------|--------|---------|
| E-POST-01 | post-launch | RichAds / paid landing A/B program |
| E-POST-02 | post-launch | Partner bet-slip injection where contracts allow |
| E-POST-03 | post-launch | Account sync for Accas/preferences |
| E-POST-04 | post-launch | Community/editorial Acca layers |
