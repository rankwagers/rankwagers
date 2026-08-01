# Production readiness report — Sprint 19

**Engineering decision: READY WITH ACCEPTED LIMITATIONS**  
**Production promote decision: NOT READY** (ops evidence still required)

Date: 2026-07-25  
Scope: Production readiness, performance/security/SEO hardening, launch documentation — **no new product features**

## Executive summary

Sprint 19 hardens release gates, observability, error/a11y recovery, image/JS performance posture, SEO schema coverage for archive/methodology, and expands the launch checklist.

Live staging infrastructure (HTTPS origin, DB restore timings, rollback drill on server, Search Console) has **not** been executed from this workstation. Production promote remains blocked on operator ops evidence listed below.

## Test evidence

| Check | Result |
|---|---|
| Unit/integration suite | See latest `npm test` (`tests/sprint19Production.test.ts`) |
| Typecheck / lint / build / security / CTA | Required green before promote |
| CTA boundary in `validate:release` + CI | Pass (Sprint 19) |
| Structured data validation (incl. archive/methodology) | Pass |
| Request ID middleware header | Pass (code + smoke expectation) |
| Live staging smoke | **Blocked** — no staging origin |
| Staging restore / rollback drills | **Blocked** |

## Security evidence

- CSP/HSTS/Referrer/Permissions/COOP/CORP — Phase D; prod omits `unsafe-eval`  
- HSTS preload still **off** until domain readiness  
- Admin: Bearer + HttpOnly; query key rejected  
- Diagnostics/cron gated  
- Client secret scan + CTA boundary scan  
- CSP nonce migration remains backlog (accepted)

## Performance evidence

- Code audit: `docs/sprint-19-performance-audit.md`  
- `optimizePackageImports` for `lucide-react`  
- `next/image` remotePatterns for provider CDNs  
- Budgets remain warn-only until staging measure (`docs/performance-budgets.md`)

## SEO / structured data evidence

- Audit: `docs/sprint-19-seo-audit.md`  
- Archive + methodology schema validation wired into `lib/seo/validate.ts`  
- Sitemap/inventory include archive + methodology hubs  

## Accessibility evidence

- Audit: `docs/sprint-19-accessibility-audit.md`  
- 404/error recovery locale-aware + SR status/alert roles  

## Affiliate evidence

- Server-only signing unchanged  
- CTA boundary now a hard release + CI gate  
- Signed-redirect enforcement flag flip still requires staging smoke  

## Unresolved blockers (production promote)

1. Production domain + `SITE_URL`  
2. Staging HTTPS origin + distinct secrets/DB  
3. Live `npm run smoke:staging` (`EXPECT_STAGING=1`)  
4. Restore rehearsal + measured RPO/RTO  
5. Server artifact rollback drill  
6. `FF_SIGNED_REDIRECT_REQUIRED=true` proven live  
7. Search Console property + sitemap submit  
8. Incident drill timestamp  

## Accepted limitations

- Zero verified bookmaker IDs → availability **unknown** honesty  
- Postbacks disabled until provider specs  
- Single PM2 + memory rate limiter  
- No external APM vendor  
- HSTS preload disabled  
- Performance budgets warn-only until measured  
- CSP `'unsafe-inline'` until nonce migration  

## Manual launch steps

Only after blockers clear: `docs/manual-production-launch.md` + `docs/launch-checklist.md`.
