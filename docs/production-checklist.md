# RankWagers — Production Launch Checklist

Use this before public launch. No new product features — quality, stability, trust.

## Environment

- [ ] `SITE_URL` is the public HTTPS origin (not localhost / not example.com)
- [ ] `APP_ENV=production` (or staging) set explicitly when needed
- [ ] `AFFILIATE_REDIRECT_SECRET` and `ADMIN_KEY` are strong (non-default)
- [ ] `SITE_CONTENT_DATE` set for stable sitemap lastmod (optional)
- [ ] Affiliate / brand env vars configured for live partners
- [ ] `NEXT_PUBLIC_GTM_ID` set for production analytics
- [ ] `ODDS_HISTORY_DATABASE_URL` + attribution migration applied
- [ ] `ATTRIBUTION_DATABASE_URL` set (or shared with odds history URL)
- [ ] Diagnostics flag off in public prod (`ENABLE_DIAGNOSTICS` unset/false) unless intentionally gated
- [ ] Country personalization cookies work behind Cloudflare (`CF-IPCountry`)
- [ ] Read `docs/deployment-assumptions.md` (single-instance PM2)

## Build & deploy

- [ ] `npm ci`
- [ ] `npm test` — 100% pass
- [ ] `npm run build:verify` (or `npm run build` with production `SITE_URL`)
- [ ] PM2 reload via `deploy/update-server.sh`
- [ ] Nginx config includes security headers + `/go` + `/api` rate zones
- [ ] `/api/health` returns `200` `{ "status": "ok" }` (liveness)
- [ ] `/api/health/ready` returns `200` (readiness) — investigate any `fail` checks before promote
- [ ] Rollback: keep previous `.next` / PM2 release; redeploy prior artifact if ready fails

## SEO / Search Console

- [ ] Submit `https://rankwagers.com/sitemap.xml` (index) in Search Console
- [ ] Confirm child sitemaps: static, operators, markets, competitions, compare
- [ ] `robots.txt` allows public pages; blocks `/admin`, `/developer`, `/go/`, `/api/`
- [ ] Spot-check canonical + hreflang on home, operator, market, competition, match detail (`/fixtures/{matchId}`)
- [ ] Rich Results / schema: BreadcrumbList, FAQPage (markets), CollectionPage, Organization, ItemList, SportsEvent (match pages when kickoff+teams known)
- [ ] No accidental `noindex` on money pages

## Performance

- [ ] Lighthouse Performance target 95+ on home + one entity page (mobile)
- [ ] LCP / INP / CLS within Core Web Vitals “good”
- [ ] Images served AVIF/WebP via Next Image
- [ ] Odds intelligence panel is code-split (dynamic import)

## Accessibility

- [ ] Single `#main-content` landmark per page
- [ ] Skip link reaches main content
- [ ] Keyboard focus visible; headings logical
- [ ] Loading / error / empty / 404 states announce status

## Security

- [ ] Security headers present (CSP, HSTS, XFO, nosniff, Referrer-Policy)
- [ ] `/go/*` only redirects to registry affiliate URLs (no open redirect)
- [ ] Rate limits active on `/go`, `/api/analytics`, `/api/track`
- [ ] Admin IP allowlist enforced in nginx
- [ ] Secrets not committed; `upload-exclude.txt` respected

## Monitoring

- [ ] Liveness check → `/api/health`
- [ ] Readiness check → `/api/health/ready` (db / env / migration / signing secret)
- [ ] Process logs capture `unhandled_rejection` / `uncaught_exception`
- [ ] Analytics 429/503 failures visible in logs
- [ ] Affiliate click path (`/go`) smoke-tested for top partners
- [ ] Attribution DB outage still allows `/go` redirect (log-only failure)

## Manual QA

- [ ] Homepage fixtures expand; odds panel loads
- [ ] Operator / market / competition pages + graph “Connected research”
- [ ] Country override (`?country=NG`) personalizes operators
- [ ] Locale switch preserves path
- [ ] Mobile nav + sticky CTA
- [ ] Age gate / responsible gambling links present
