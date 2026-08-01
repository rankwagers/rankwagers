# Rollback

## Artifact rollback

1. Confirm `previous` symlink exists  
2. Review migration inventory mismatch (`ALLOW_MIGRATION_MISMATCH=1` only after approval)  
3. `./scripts/rollback-release.sh`  
4. Check `/api/health` (200) and `/api/health/ready` (200 or accepted 503)  
5. Run smoke subset  
6. Read `shared/logs/rollback-last.json`

If post-rollback liveness fails, script attempts to restore the prior `current`.

## Feature-flag emergency (no deploy)

| Flag | Effect |
|---|---|
| `FF_EMERGENCY_DISABLE_COMBO` | Hides combo surfaces |
| `FF_EMERGENCY_DISABLE_AFFILIATE` | Hides affiliate CTAs |
| `FF_EMERGENCY_DISABLE_ADMIN` | Admin 404 |
| `FF_SIGNED_REDIRECT_REQUIRED=false` | Temporarily allow unsigned `/go` during incident |

## Database

Schema forward-only → restore from backup for data rollback (`docs/backup-recovery.md`).
