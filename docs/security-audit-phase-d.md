# Sprint 17 Phase D — Security & release audit

Date: 2026-07-25

## Public operational surfaces

| Surface | Risk before Phase D |
|---|---|
| `/api/health`, `/api/health/ready` | Public (intentional) |
| `/api/*/diagnostics` | Gated by diagnostics flag/secret (Phase B) |
| `/api/internal/cron/*`, `/api/internal/metrics` | Gated (Phase C) |
| `/developer/*` | Middleware gate + noindex (not sufficient alone historically) |
| `/admin` | Query-key auth + weak default `ADMIN_KEY` |
| `/go/[brand]` | Signed ctx optional; destination from registry |

## Critical gaps to close in Phase D

1. No typed feature-flag module — security toggles scattered across env — **closed**
2. Redirect tokens: single secret, no previous-secret rotation window — **closed**
3. HSTS `preload` enabled before domain readiness confirmation — **closed** (preload off by default)
4. CSP includes `unsafe-eval` + broad `https:` img-src — **narrowed** (prod omits unsafe-eval; img hosts restricted)
5. No CI workflow in repo root — **closed**
6. No machine-readable release gates — **closed**
7. Staging not isolated in robots (would allow indexing if deployed) — **closed**
8. Combo APIs `req.json()` without explicit body size guard — **closed**
9. Weak/default secrets still possible if validation skipped — **closed** for deployed envs
10. No route inventory / client-bundle secret scan scripts — **closed**
11. Public `/api/crawl-quality` + `/api/data-quality` (robots-only) — **closed** (diagnostics gate)

## Residual (Phase E / ops)

- Admin `?key=` / non-HttpOnly cookie hardening (nginx IP remain primary edge control)
- Deploy script artifact retention for rollback
- Staging restore rehearsal
- CTA signing → enable `FF_SIGNED_REDIRECT_REQUIRED`

## Non-blockers

- Single-instance PM2 remains valid
- No Redis required
- Bookmaker mappings may stay unverified under honesty rules
