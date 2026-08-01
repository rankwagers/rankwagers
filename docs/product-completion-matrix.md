# RankWagers — Product Completion Matrix

**Date:** 2026-07-25 · after Sprint 18G  
 
 
 
**Status values:** COMPLETE · FUNCTIONAL BUT INCOMPLETE · PARTIAL · PLACEHOLDER · NOT IMPLEMENTED · BLOCKED BY EXTERNAL DATA · INTENTIONALLY DEFERRED

Complexity: **S** &lt;1d · **M** 1–3d · **L** 3–7d · **XL** &gt;1w

| Feature | Status | Evidence | Missing work | Priority | Dependency | Complexity |
|---------|--------|----------|--------------|----------|------------|------------|
| Homepage research shell | COMPLETE | `RankWagersHome.tsx` narrative (18C) | Locale polish for non-EN research chrome | P2 | i18n | M |
| Homepage hero / VP | COMPLETE | Dict-driven hero + CTAs + search (18C) | Localized overlays | P2 | Dictionaries | S |
| Verified performance | COMPLETE | Homepage + `/archive` transparency (`lib/archive`, `trustPerformance`) | Avg odds / ROI when odds log exists | P2 | odds log | M |
| Recent results board | COMPLETE | Transparent W/L/void/pending + full archive IA | Seasonal charts optional | P3 | — | S |
| Qualified fixture explorer | FUNCTIONAL BUT INCOMPLETE | `BibleFixtureExplorer.tsx` | Expander retained; “Open match page” → 18B route | P1 | — | M |
| Match detail **page** | COMPLETE | `app/[locale]/fixtures/[matchId]` + `lib/fixtures/*` | 1X2/DC/DNB publish | P2 | Provider live fields | — |
| Prediction settlement | COMPLETE | Settlement + daily archive history (`lib/archive`) | Per-prediction odds log; unpublished 1X2/DC/DNB | P2 | odds log | M |
| Prediction archive | COMPLETE | `/archive`, `/archive/[date]`, filters, pagination (18G) | Odds-band performance later | P3 | — | — |
| Methodology pages | COMPLETE | `/methodology` + docs (18G) | Locale copy polish | P3 | i18n | S |
| Fixture save / workspace | FUNCTIONAL BUT INCOMPLETE | localStorage + SavedFixturesPanel → match URLs | Account sync optional later | P3 | — | S |
| Highest confidence cards | COMPLETE | Deep-open canonical `/fixtures/{id}` (18B) | — | — | — | — |
| Trending markets | COMPLETE | Deep-open `?market=` (18A) | — | — | — | — |
| Live Signals | FUNCTIONAL BUT INCOMPLETE | `LiveFeedPanel.tsx` | Trust framing; empty/source clarity | P1 | Telegram/FootyStats | M |
| Combo Studio | REDIRECT → Builder | `combo/page.tsx` → `/acca/builder` | Keep legacy APIs | P2 | 19.5 | — |
| Acca Studio | COMPLETE | `lib/acca/*`, `/acca`, global panel/sheet (18E) | Public indexed Accas / images later | P2 | E18E-LATER | — |
| Acca Builder | COMPLETE (19.5 approved) | `lib/acca-builder/*`, `/acca/builder`, `POST /api/acca/builder` | Staging smoke (20B) | P0 | Sprint 20B | — |
| Launch / ops | PRODUCT READY FOR STAGING OPS | Sprint 20 tooling + 19.5 acceptance | Staging evidence | P0 | Sprint 20B | L |
| Internal Intelligence Dashboard | COMPLETE (21) | `/admin/*`, `lib/admin-dashboard/*`, `/api/admin/dashboard*` | Odds/ROI when archived; durable system histograms | P1 | archives + analytics log | — |
| SEO Intelligence | COMPLETE (22) | `/admin/seo/*`, `lib/seo-intelligence/*` | Fixture/archive hydration depth; GSC later (ops) | P1 | crawl-quality + registries | — |
| Affiliate Intelligence | COMPLETE (23) | `/admin/affiliate/*`, `lib/affiliate-intelligence/*` | campaignId stamp; postbacks; signedRedirectRequired | P1 | /go + analytics log | — |
| Calibration Intelligence | COMPLETE (24) | `/admin/calibration/*`, `lib/calibration-intelligence/*` | Append-only publication snapshots; Builder combo settlement when persisted | P1 | daily archives + analytics | — |
| Experimentation Platform | COMPLETE (25) | `/admin/experiments/*`, `lib/experimentation/*` | Durable visitor ID + consent gate; staging/prod activation workflow | P1 | disabled public flag | — |
| Combo entry from home | COMPLETE | `HomepageAccaEntry` → `/acca` + Builder | — | — | — | — |
| Global entity search | COMPLETE | Fuzzy + fixtures/countries; archive filters on `/archive` | Voice/alerts later | P3 | — | M |
| Homepage fixture search | COMPLETE | Hero → explorer + global search parity (18D) | — | — | — | — |
| Header navigation | FUNCTIONAL BUT INCOMPLETE | Grouped IA + bookmaker hubs (18A) | Label polish / reviews entry | P2 | — | S |
| Mobile navigation | COMPLETE | Escape/focus trap + touch targets (18F) | — | — | — | — |
| Design tokens | COMPLETE | `globals.css` + `lib/ui/tokens.ts` (18F) | Dark theme activation later | P3 | Brand | S |
| Accessibility baseline | COMPLETE | Sheets/search/focus/reduced-motion (18F) | Full axe CI later | P2 | — | M |
| Footer / legal links | COMPLETE | `Footer.tsx` | Locale polish | P3 | Dict | S |
| Competitions index/detail | FUNCTIONAL BUT INCOMPLETE | Registry + daily lists | Richer offline content | P1 | Data | L |
| Teams index/detail | FUNCTIONAL BUT INCOMPLETE | Same pattern | Thin-empty SEO | P1 | Data | L |
| Markets index/detail | FUNCTIONAL BUT INCOMPLETE | MarketDetailView | Sample independence | P1 | Odds DB | M |
| Seasons | PARTIAL | Nested routes | Discoverability | P2 | Nav | M |
| Operators intelligence | FUNCTIONAL BUT INCOMPLETE | OperatorDetailView | Align with reviews | P1 | Brands registry | M |
| Reviews (affiliate) | FUNCTIONAL BUT INCOMPLETE | `reviews/[brand]` | Nav entry; freshness | P1 | Brand CMS | M |
| Compare pages | FUNCTIONAL BUT INCOMPLETE | Partial noindex | Content depth | P2 | Brands | M |
| Best betting sites | COMPLETE | Betting variant + meta (18A) | — | — | — | — |
| Best crypto sites | FUNCTIONAL BUT INCOMPLETE | Crypto filter OK | Soften FAQ certainty | P1 | Copy | S |
| Bonuses hub | FUNCTIONAL BUT INCOMPLETE | BrandList prep | Nav entry | P1 | Nav | S |
| Availability / geo | FUNCTIONAL BUT INCOMPLETE | Restyled (18A) | Country chips → hubs polish | P2 | — | S |
| Country browse IA | FUNCTIONAL BUT INCOMPLETE | `/countries` + gated `[code]` (18D) | More profiles; richer regional copy | P2 | content | M |
| Privacy / terms / RG | FUNCTIONAL BUT INCOMPLETE | Dict pages | Locale completeness | P2 | Legal | M |
| 404 / error / loading | COMPLETE | not-found, error, loading | Locale-aware 404 links | P3 | — | S |
| Age gate / 18+ | COMPLETE | Gate + badges | — | — | — | — |
| Signed affiliate CTAs | COMPLETE (tech) | server-only signing | Product disclosure UX | P2 | — | S |
| Evidence UI kit | FUNCTIONAL BUT INCOMPLETE | evidence-ui/* | Plain-language layer | P1 | Copy | M |
| Odds intelligence panel | FUNCTIONAL BUT INCOMPLETE | OddsIntelligencePanel | Mobile chart UX | P2 | Odds history | M |
| Standings context | NOT IMPLEMENTED | Absent in explorer | Provider + UI | P2 | External API | L |
| Date picker on home | COMPLETE | HomepageDateControl (18A) | — | — | — | — |
| Locale translations (research UI) | PARTIAL | 6 dicts; 31 locales | Translate bible/combo UI | P1 | i18n | XL |
| Sitemap / robots | COMPLETE (infra) | sitemap.ts | Defer thin locales | P2 | SEO policy | M |
| Admin / developer tools | INTENTIONALLY DEFERRED | Gated | Keep out of product nav | — | Auth | — |
| Staging deploy readiness | INTENTIONALLY DEFERRED | Ops docs | Server config | — | Ops | — |
| Redis / K8s / ORM / AI | INTENTIONALLY DEFERRED | Non-goals | — | — | — | — |

## Rollup by status

| Status | Count (approx) |
|--------|---------------:|
| COMPLETE | 12 |
| FUNCTIONAL BUT INCOMPLETE | 16 |
| PARTIAL | 9 |
| PLACEHOLDER | 3 |
| NOT IMPLEMENTED | 3 |
| BLOCKED BY EXTERNAL DATA | (overlays Live, odds breadth, affiliate config) |
| INTENTIONALLY DEFERRED | 3 |

**Interpretation:** Core engines exist; **product shell and conversion IA** are the incomplete half.
