# Sprint 17 Phase E — Readiness audit

Date: 2026-07-25

## Remaining launch blockers

| Blocker | Type |
|---|---|
| Production domain unconfirmed | Ops / human |
| Live staging HTTPS origin not available in this session | Ops / infra |
| Staging restore not measured | Ops |
| Server-side artifact rollback not executed | Ops |
| Live smoke / incident drill | Ops |
| `FF_SIGNED_REDIRECT_REQUIRED` live flip | Ops (code ready) |

## Operational assumptions

- Single PM2 instance, memory rate limiter
- Shared `.env` outside release artifacts
- Migrations applied manually before promote
- No Redis/K8s/ORM/queue

## Automatable in-repo (done)

- Admin auth hardening
- `buildGoPath` CTA signing
- Release/rollback scripts + unit simulation
- Backup/migrate/restore rehearsal scripts
- Smoke expansion
- Docs + readiness decision template

## Destructive actions requiring backup

- `pg_restore --clean` into verify DB
- Migration apply on staging
- Symlink switch / rollback on live host

## Human approval required

- Production domain selection
- Staging/production secret installation
- First live restore sign-off
- Production promote