# Launch report — RankWagers

**Updated:** 2026-07-26 (UTC)  
**Decision:** **PRODUCT READY FOR STAGING OPERATIONS**

## Status statements (authoritative)

| Statement | Status |
|-----------|--------|
| Product functionality accepted on localhost | **Yes** |
| Automatic Acca Builder acceptance complete (Sprint 19.5) | **Yes — approved & closed** |
| Production deployment occurred | **No** |
| Staging / production operator-gated | **Yes** |
| Real domain, `SITE_URL`, server credentials, external platforms required | **Yes — still outstanding** |
| Launch-ready / production-ready claim allowed | **No** — not until Sprint 20B staging evidence is collected |

Sprint 19.5 implementation and Sprint 20 operational tooling are **preserved**. Deployment was **not** executed.

---

## Deployment summary

| Field | Value |
|-------|--------|
| Deployment time | Local rehearsal only — **not** a public promote |
| Version / release id | Clean `npm run build` + local `next start` |
| Commit | Unavailable — Git CLI / `.git` not present on this machine |
| Rollback point | Local layout rehearsal **PASS** → `docs/sprint-20-rollback-rehearsal.generated.json` |
| Production host | **not deployed** — placeholder `gercek-domainin.com` |
| Staging host | **not deployed** — `STAGING_BASE_URL` unset |
| Local origin verify | Pass (Sprint 20 `:3456` 14/14; Sprint 19.5 `:3460` 14/14) |
| Acca Builder localhost | **Approved** — `docs/acca-builder-localhost-acceptance.md` |

### What was executed here

1. Sprint 20 ops package + local origin verify  
2. Sprint 19.5 Acca Builder implementation + localhost acceptance (owner-approved)  
3. Engineering gates (tests, lint, typecheck, build, security, CTA boundary)  

### What was not executed

- Staging deploy  
- Production deploy  
- DNS / TLS / Search Console / Bing activation  
- Live `FF_SIGNED_REDIRECT_REQUIRED` flip  

---

## Immediate follow-up — Sprint 20B (prepare only; do not execute without operator infra)

Operator checklist: `docs/sprint-20b-staging-ops-checklist.md`

1. Collect operator infrastructure details (domain, DNS, TLS, secrets, deploy access)  
2. Staging deploy + health / origin verify  
3. Acca Builder + Studio + signed redirect smokes on staging  
4. Staging robots/noindex policy proof  
5. Rollback + restore drills  
6. Only then: production promotion decision  

---

## Post-launch roadmap (not started)

- Roadmap v1.1 / new product features — **locked** until staging evidence + explicit approval  
- Flutter app, dark mode — **locked**  
