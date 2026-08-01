# CI/CD

Workflow: `.github/workflows/ci.yml`

## Stages

1. `npm ci`
2. typecheck (`tsc --noEmit`)
3. lint
4. tests
5. security scan
6. route inventory
7. migration file presence
8. production build (safe CI profile / localhost SITE_URL)
9. post-build secret scan
10. client CTA signing boundary (`npm run scan:cta-boundary`)
11. staging environment gate (manual approval placeholder)

**No automatic production deploy.**

## Release gates

```
npx tsx scripts/validate-release.ts
npx tsx scripts/validate-release.ts --skip-build
```

## Branch protection (document for GitHub settings)

- Require CI green on `main`
- Require review
- No force-push to `main`
- Production environment: manual approvers only
