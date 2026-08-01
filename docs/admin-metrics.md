# Admin metrics catalog

Sources and honesty notes for Internal Intelligence Dashboard.

| Metric | Source | Notes |
|--------|--------|-------|
| Published / settled / won / lost / void / pending | `data/daily-archives` via `lib/archive` | Real list settlements |
| Hit rate | won / (won+lost) | Voids & pending excluded |
| Average confidence | Archive `confidence` | Null → Unavailable |
| Average odds / ROI | — | **Unavailable** until publication odds archived |
| Today / 7d / 30d counts | Archive dates | Window filters |
| Data freshness | Archive date window | Label only |
| Builder generations / success / fail | `data/analytics-events.log` (`acca_builder_*`, `combo_*`) | Sparse if events not recorded |
| Builder avg time / candidate pools | — | **Unavailable** unless added to event properties |
| Transfer / merge / replace | Analytics events | Count only |
| Operator impressions / clicks / CTR | Analytics events | CTR = clicks/impressions |
| Signed redirect failures | `affiliate_redirect_failed` events | |
| Search teams/leagues/fixtures | `search_*` events with entity properties | Empty → Unavailable note |
| System readiness checks | `buildReadinessReport` | Live process |
| Rate limit / timings | In-process `metrics.snapshot()` | Resets on restart; multi-instance incomplete |

## Filters

Date range · competition · country · market · risk mode (builder events) · prediction source (noted when not distinct in archives)

## SEO Intelligence metrics (Sprint 22)

See `docs/seo-intelligence.md` and `docs/seo-content-quality.md`. Indexability counts, issue severities, sitemap/schema health, orphan/thin/duplicate counts are derived from `lib/seo-intelligence` over registries + crawl-quality — never fabricated rankings.

## Affiliate Intelligence metrics (Sprint 23)

See `docs/affiliate-intelligence.md`. CTA views/clicks, redirect created/resolved/failures, availability decisions, and internal quality scores come from registries + analytics log. **Never** invent revenue, deposits, or FTDs.

## Experimentation metrics (Sprint 25)

See `docs/experimentation-platform.md`. Admin surfaces expose definition counts, SRM status, guardrail status, and sample gates. **No real uplift or significance is claimed** while templates remain DRAFT and public experimentation is disabled. FTD/revenue metrics remain unavailable.

## Calibration Intelligence metrics (Sprint 24)

See `docs/calibration-intelligence.md` and `docs/calibration-methodology.md`.

| Metric | Source | Notes |
|--------|--------|-------|
| Hit rate / W/L/void | Daily archives | Void excluded from hit-rate denominator |
| Confidence bands + gap | Archive confidence 0–100 | Sample-gated |
| Brier / log-loss / ECE | Archive W+L with confidence | Only when semantics allow |
| Builder generations | `acca_builder_*` analytics | Counts only |
| Combination settlement / ROI | — | **Unavailable** without durable snapshots + odds |
| Mode ordering | `RISK_MODE_RULES` | Config validation, not settlement proof |
