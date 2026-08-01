# Backup & recovery

## Provisional targets (until measured)

| Metric | Provisional | Measured |
|---|---|---|
| RPO | ≤ 24h | **blocked — restore rehearsal not run** |
| RTO | ≤ 4h | **blocked** |
| Backup frequency | Daily + pre-deploy | Ops |
| Retention | 14 days | Ops |
| Restore test | Monthly staging | **not completed** |

## Commands

```bash
export STAGING_DATABASE_URL=postgres://…staging…
npm run ops:backup
export RESTORE_VERIFY_DATABASE_URL=postgres://…temp-verify…
npm run ops:restore-rehearse
```

Evidence: `docs/evidence/restore-rehearsal.json`, `backups/backup-last.json`.

## Validation after restore

- affiliate clicks / conversions counts  
- provider snapshots + active pointer  
- readiness  
- destroy temporary verify DB after recording evidence  

## Status

**Backup readiness is NOT complete** until a staging restore succeeds and timings are recorded below:

| Field | Value |
|---|---|
| Backup duration | _pending_ |
| Restore duration | _pending_ |
| Backup size | _pending_ |
| Row/checksum checks | _pending_ |
