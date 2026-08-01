# Sprint 19 — Performance audit (code + CWV readiness)

**Scope:** In-repo performance review. Live Lighthouse numbers require a staging origin (ops-blocked until `SITE_URL` is provided).

## Architecture findings

| Area | Status | Notes |
|------|--------|-------|
| Server Components default | OK | Entity/archive/methodology pages are RSC |
| Client islands | OK | Acca, search, explorer, archive table/filters are intentional clients |
| Images | Improved (19) | AVIF/WebP + `remotePatterns` for FootyStats / API-Sports CDNs |
| Package imports | Improved (19) | `optimizePackageImports: ["lucide-react"]` |
| Caching | OK | Sitemap `revalidate=3600`; match pages `revalidate=60`; go/diagnostics `no-store` |
| Compression | OK | `compress: true` in `next.config.js` |
| Powered-By | OK | Disabled |
| Hydration | Acceptable | Heavy research UI remains client; no redesign in Sprint 19 |

## CWV preparation

| Vital | Engineering posture |
|-------|---------------------|
| LCP | Hero/SSR first paint; optimize images; avoid blocking client bundles on first viewport |
| INP | Keep interactive islands focused; lucide tree-shaking reduces JS |
| CLS | Design tokens + skeletons (`PageSkeleton`); avoid inserting late layout without reserved space |

## Budgets

See `docs/performance-budgets.md` — **warn-only** until staging baselines are measured:

```bash
npm run load:phase-c -- https://staging-host
npm run smoke:staging -- https://staging-host
```

## Explicitly not changed

- No removal of evidence UI to chase scores  
- No Acca/Combo UX redesign  
- No hard-fail CI budgets without measured data  

## Follow-up (ops)

1. Measure staging p50/p95 for homepage, combo LKG, ready, `/go`  
2. Fill the table in `docs/performance-budgets.md`  
3. Run Lighthouse (Performance / A11y / Best Practices / SEO) on homepage, match, archive, methodology  
