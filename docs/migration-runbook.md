# Migration runbook

## Order

1. Backup staging DB (`npm run ops:backup`)
2. Record migration files present under `db/migrations/`
3. Apply with the same tool used in deploy (`psql -f` via `npm run ops:migrate-rehearse`)
4. Run readiness + attribution/snapshot smoke
5. Only then promote application artifact

## Rules

- Staging database only for rehearsal
- No destructive DROP in Phase E migrations
- Do not auto-run migrations on `next start`
- Failed migration blocks promotion
- Application must not run against incompatible schema

## Commands

```bash
export STAGING_DATABASE_URL=postgres://…staging…
npm run ops:backup
npm run ops:migrate-rehearse
# Evidence: docs/evidence/migration-rehearsal.json
```

## Rollback feasibility

Forward-only SQL. Data rollback uses restore from backup + optional app artifact rollback.
