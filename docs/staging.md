# Staging

## Isolation

| Concern | Staging rule |
|---|---|
| `APP_ENV` | `staging` |
| `SITE_URL` | Real staging HTTPS origin |
| Secrets | Distinct from production |
| Database | Separate Postgres |
| robots | Disallow all |
| metadata | `noindex, nofollow` |
| Banner | `stagingBannerVisible` |
| Postbacks | Disabled |
| Analytics | Separate container or disabled |
| Cron | Off unless intentional + secret |

## Required env (example)

```
APP_ENV=staging
SITE_URL=https://staging.example-host.com
ADMIN_KEY=<strong>
AFFILIATE_REDIRECT_SECRET=<strong>
DIAGNOSTICS_SECRET=<strong>
CRON_SECRET=<strong>
ATTRIBUTION_DATABASE_URL=postgresql://...staging...
ENABLE_DIAGNOSTICS=false
ENABLE_CRON=false
FF_STAGING_BANNER_VISIBLE=true
STAGING_NOINDEX=true
```

## Smoke

```
APP_ENV=staging EXPECT_STAGING=1 npm run smoke:staging -- https://staging-host
```

Do not follow real affiliate destinations in automation.

## Phase E ops sequence

See `docs/staging-validation.md`. After signed CTA producers are verified live:

```
FF_SIGNED_REDIRECT_REQUIRED=true
```

on staging only — re-run smoke before production consideration.
