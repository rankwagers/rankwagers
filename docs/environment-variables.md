# Environment variables

See `.env.example` for placeholders (not usable secrets).

## Critical

| Name | Dev | Staging/Prod |
|---|---|---|
| `APP_ENV` | optional | `staging` / `production` |
| `SITE_URL` | defaults localhost | required HTTPS |
| `ADMIN_KEY` | weak ok | strong required |
| `AFFILIATE_REDIRECT_SECRET` | default ok | strong required |
| `AFFILIATE_REDIRECT_PREVIOUS_SECRET` | — | rotation only |
| `DIAGNOSTICS_SECRET` | — | required if diagnostics on |
| `CRON_SECRET` | — | required if cron on |
| `ATTRIBUTION_DATABASE_URL` | optional | recommended |
| `ENABLE_DIAGNOSTICS` | — | default false |
| `ENABLE_CRON` | — | default false |

Validation: `lib/config/env.ts` — never logs secret values.
