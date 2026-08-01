# Product marketing context — RankWagers (aff-site)

> Living doc for marketing-skills workflows. Update when positioning or KPIs change.

## Product overview

- **One line:** RankWagers is a football betting decision-support platform: evidence-backed goal-market research, transparent prediction records, Acca building, and trusted bookmaker handoff.
- **What it does:** Combines focused match intelligence (not a live-score clone), explainable predictions with settlement history, Acca Studio, and affiliate comparison (reviews, bonuses, fiat + crypto) via secure `/go` redirects. Powered by FootyStats (+ API-Football where configured) and Live Signals (Telegram engine + FootyStats fallback).
- **Category:** Sports betting decision-support / affiliate media — not a bookmaker; not SofaScore/Flashscore.
- **Model:** Affiliate commissions from partner operators; no direct gambling product.
- **Strategic distinction:** Flashscore = what is happening; SofaScore = how the match is played; RankWagers = what the evidence means for a betting decision, how it performed historically, and how to turn it into a transparent Acca.

## Primary conversion paths (CRO)

1. **Research → Acca → handoff** — Landing/home → fixture/prediction → evidence & trust → live/final verification → Add to Acca → bookmaker compare → secure `/go/[brand]`.
2. **Affiliate hub** — `/best-betting-sites` (fiat), `/best-crypto-betting-sites`, `/bonuses`, `/reviews/[brand]`, `/operators`.
3. **Telegram** — `NEXT_PUBLIC_TELEGRAM_URL` (channel) and optional `NEXT_PUBLIC_TELEGRAM_BOT_URL` (bot); bot URL falls back to channel for live-feed unlock links.

## Target audience

- Adults 18+ interested in football betting and goal markets who want **explainable** research, not tipster certainty.
- Geo: multi-locale (EN + EU + AR + growth locales); Turkey blocked at middleware; regional landings only with unique value.
- Jobs: evaluate a market with evidence, verify prediction outcomes, build an Acca, pick a permitted bookmaker, compare bonuses/crypto.

## Positioning & trust

- **Promise:** Decision support from real evidence and transparent records — we do not take bets; we do not guarantee wins.
- **Trust:** GambleAware, 18+ gate, affiliate disclosure, methodology, verified settled W/L history (no selective loss hiding), honest unknown availability.
- **Compliance:** Eligibility notice; operator decides registration by country; no fabricated performance claims.
- **Roadmap:** See `docs/product-sprint-plan.md` (18B match intelligence → 18E Acca Studio → 18G transparency/SEO).

## SEO checklist (production)

- Set `SITE_URL` to the live HTTPS origin (canonical, hreflang, OG). Missing/invalid in production fails startup — there is no `example.com` fallback.
- Default OG image: `/opengraph-image` (1200×630).
- Predictions home: WebSite + Organization + WebPage JSON-LD.
- `/best-betting-sites`: `meta.bestBettingTitle` / `bestBettingDescription` (not crypto home title).
- Homepage URLs in `/sitemap.xml` use `changeFrequency: daily` and fresh `lastModified` (dynamic sitemap).
- UI tokens: Design Bible light ivory (`design/src/styles/theme.css`); full component rebuild in progress.

## Analytics (production)

- **GTM container:** `GTM-5D4FPZ99` (root layout; do not add separate `gtag.js` on pages).
- **GA4 measurement ID:** `G-089KXEMR0R` — configure only as a **GA4 Configuration** tag inside GTM; see `docs/ga4-gtm-setup.md`.
- North-star events: GA4 `affiliate_click` on `/go/` link clicks (GTM trigger); server-side `/api/track` remains for admin logs.

## Key pages

| Route | Role |
|-------|------|
| `/[locale]` | Predictions home — lists + live feed |
| `/[locale]/best-betting-sites` | Main affiliate landing (all brands) |
| `/[locale]/best-crypto-betting-sites` | Crypto-filtered list |
| `/[locale]/bonuses` | Bonus hub |
| `/[locale]/reviews/*`, `/compare/*` | Depth + SEO |

## Technical notes

- Next.js 14 App Router — project folder `aff-site`.
- Env: `SITE_URL`, `FOOTYSTATS_API_KEY`, `API_FOOTBALL_KEY`, `NEXT_PUBLIC_TELEGRAM_URL`, `NEXT_PUBLIC_TELEGRAM_BOT_URL`, `ADMIN_KEY`.

## Open questions

- Single north-star KPI: affiliate clicks vs Telegram joins?
- Priority growth locales and operator focus.
- Competitor set for compare pages and copy benchmarks.
