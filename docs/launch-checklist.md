# Launch checklist — RankWagers (Sprint 19/19.5/20/20B/21/22)

Legend: **passed** | **failed** | **blocked** | **accepted limitation**

Use with `docs/manual-production-launch.md`, `docs/deployment.md`, `docs/rollback.md`, `docs/sprint-20b-staging-ops-checklist.md`.

**Launch status: PRODUCT READY FOR STAGING OPERATIONS**

- Product functionality is accepted on localhost.
- Automatic Acca Builder acceptance is complete (Sprint 19.5 closed).
- Production deployment has **not** occurred.
- Staging and production remain **operator-gated**.
- Real domain, `SITE_URL`, server credentials, and external platform access are still required.
- No launch-readiness claim may be made until staging evidence is collected (Sprint 20B).

---

## 0. Product gate (Sprint 19.5) — CLOSED

| Item | Status | Evidence |
|---|---|---|
| Acca Builder localhost acceptance | **passed** (approved) | `docs/acca-builder-localhost-acceptance.md` |
| Real fixtures + published predictions | **passed** | Builder runtime on localhost |
| Studio transfer merge/replace | **passed** | Localhost scenarios 23–28 |
| Sprint 20 ops package preserved | **passed** | `ops:sprint20-*` scripts |

Next ops phase (not started): **Sprint 20B — Staging Deployment & Live Operations Verification** → `docs/sprint-20b-staging-ops-checklist.md`

Product SEO governance (localhost, closed): **Sprint 22 — SEO Intelligence** → `/admin/seo`, `docs/sprint-22-completion-report.md`. Does not unblock staging.

Affiliate governance (localhost, closed): **Sprint 23 — Affiliate Intelligence** → `/admin/affiliate`, `docs/sprint-23-completion-report.md`. Does not unblock staging.

Calibration governance (localhost, closed): **Sprint 24 — Calibration Intelligence** → `/admin/calibration`, `docs/sprint-24-completion-report.md`. Does not unblock staging. No auto-tuning of prediction/Builder thresholds.

Experimentation platform (localhost, closed): **Sprint 25** → `/admin/experiments`, `docs/sprint-25-completion-report.md`. Disabled by default; no production activation; no fabricated results. Does not unblock staging.

---

## 1. Environment variables

| Item | Status | Evidence / action |
|---|---|---|
| Production domain confirmed | blocked | Still placeholder `gercek-domainin.com` on this workstation |
| `SITE_URL` production (https, no trailing slash) | blocked | Replace placeholder after staging proof |
| Staging `SITE_URL` distinct | blocked | Operator must provide; `STAGING_BASE_URL` unset |
| `APP_ENV=staging` / `production` | blocked | Ops |
| Database URLs (staging ≠ prod) | blocked | Credentials |
| Secrets distinct staging/prod | blocked | Ops verify |
| Redirect signing secrets (`REDIRECT_TOKEN_*`) | passed | Env validation + rotation |
| Provider keys | accepted limitation | Optional for LKG-only staging |
| Feature flags defaults | passed | `lib/config/featureFlags.ts` |
| `FF_SIGNED_REDIRECT_REQUIRED` | blocked (live) | Flip after staging CTA smoke |
| GTM / analytics IDs | accepted limitation | Optional until marketing ready |
| Retention / cleanup flags | passed | Docs + cron jobs |

---

## 2. Production secrets

| Item | Status | Notes |
|---|---|---|
| No secrets in git | passed | `security:scan` |
| Admin session secret strength | passed | Env validators |
| Diagnostics / cron secrets fail-closed | passed | Phase D/E |
| Query-string admin keys rejected | passed | Phase E |

---

## 3. Deployment steps

1. Build artifact via `deploy/release-deploy.sh` (versioned under `/opt/rankwagers`)  
2. Symlink `current` → release  
3. Reload PM2 (`deploy/` examples)  
4. Apply nginx from `deploy/nginx-site.conf.example`  
5. Verify TLS  
6. Warm caches: hit `/en`, `/en/archive`, `/en/methodology`, `/api/health/ready`  

Docs: `docs/deployment.md`

| Item | Status |
|---|---|
| Versioned deploy script | passed |
| Live promote executed | blocked |

---

## 4. Rollback plan

| Item | Status | Evidence |
|---|---|---|
| Artifact rollback script | passed | `scripts/rollback-release.sh` / `npm run deploy:rollback` |
| Live rollback drill | blocked | Run on staging server |
| DB restore rehearsal | blocked | `npm run ops:restore-rehearse` |

Docs: `docs/rollback.md`, `docs/backup-recovery.md`

---

## 5. Health verification

```bash
curl -sS "$SITE_URL/api/health"
curl -sS "$SITE_URL/api/health/ready"
```

Expect: liveness `200` + `{"status":"ok"}`; ready `200` or accepted `503` with documented degraded checks.  
Responses include `x-request-id` for correlation (Sprint 19).

| Item | Status |
|---|---|
| Health/ready code | passed |
| Live health on staging | blocked |

---

## 6. Search Console

| Item | Status | Action |
|---|---|---|
| Property created for prod domain | blocked | Ops |
| Sitemap submitted (`/sitemap/static.xml` index) | blocked | After DNS/TLS |
| Coverage spot-check (home, archive, methodology) | blocked | After index |

---

## 7. Analytics verification

| Item | Status | Action |
|---|---|---|
| Console provider local | passed | Dev default |
| Production provider wired (GTM/PostHog/etc.) | blocked | Optional marketing |
| Spot-check events: homepage, archive, methodology, Acca, `/go` | blocked | Staging |

Event catalog: `docs/analytics-tracking-plan.md`

---

## 8. Affiliate verification

| Item | Status |
|---|---|
| Server-only `buildGoPath` | passed |
| CTA boundary in CI + `validate:release` | passed (Sprint 19) |
| Open-redirect protections | passed |
| Attribution fail-open | passed |
| Staging `FF_SIGNED_REDIRECT_REQUIRED=true` smoke | blocked |
| Partner postbacks | accepted limitation | Disabled until specs |

---

## 9. Monitoring verification

| Item | Status |
|---|---|
| Structured logs + redaction | passed |
| In-process metrics | passed |
| Request IDs on middleware responses | passed (Sprint 19) |
| External APM / paging | accepted limitation | Not required for launch |
| Incident response doc | passed | `docs/incident-response.md` |
| Incident drill timestamp | blocked | Operator |

---

## 10. Cache warmup

After deploy, sequentially request:

- `/{locale}` homepage  
- `/{locale}/archive`  
- `/{locale}/methodology`  
- `/{locale}/competitions`, `/markets`, `/operators`  
- `/api/health/ready`  

| Item | Status |
|---|---|
| Warmup procedure documented | passed |
| Executed on live | blocked |

---

## 11. Sitemap submission

| Item | Status |
|---|---|
| Sitemap shards generate | passed |
| Includes `/archive`, `/methodology` | passed |
| Submitted to Search Console | blocked |

---

## 12. Robots verification

| Item | Status |
|---|---|
| Staging isolation (code) | passed |
| Staging live Disallow | blocked | `npm run smoke:staging` with `EXPECT_STAGING=1` |
| Production allows public research URLs | blocked | Live prove |

---

## 13. Engineering gates (pre-promote)

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run security:scan
npm run scan:cta-boundary
npx tsx scripts/validate-release.ts
```

| Item | Status |
|---|---|
| Local/CI gates green | passed when CI green |
| Live staging smoke | blocked |

---

## Decision

**NOT READY for production promote** until blocked ops items clear.

Engineering readiness (Sprint 19): **READY WITH ACCEPTED LIMITATIONS** — see `docs/production-readiness-report.md` and `docs/sprint-19-completion-report.md`.
