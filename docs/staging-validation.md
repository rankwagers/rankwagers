# Staging validation

## Prerequisites (operator)

- Real staging HTTPS origin + TLS
- Separate Postgres
- Distinct secrets from production
- `APP_ENV=staging`
- `SITE_URL=https://<staging-host>`
- `FF_STAGING_BANNER_VISIBLE=true` (default on staging)
- Diagnostics/cron off unless explicitly testing

## Automated (in-repo)

```bash
npm run validate:release:fast
npm run smoke:staging -- https://staging.example
npm run ops:migrate-rehearse   # needs STAGING_DATABASE_URL
npm run ops:restore-rehearse   # needs STAGING + RESTORE_VERIFY URLs
npm run load:phase-c -- https://staging.example
```

## CTA signing enforcement

1. Confirm all producers use `buildGoPath` (signed `r2` ctx)
2. Set `FF_SIGNED_REDIRECT_REQUIRED=true` on staging only
3. Re-run smoke — legitimate CTAs must still redirect safely
4. Do **not** enable in production until launch approval

## Evidence files

- `docs/evidence/migration-rehearsal.json`
- `docs/evidence/restore-rehearsal.json`
- `docs/evidence/incident-drill.json` (operator-filled)
