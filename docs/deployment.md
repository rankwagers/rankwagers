# Deployment

## Layout (`/opt/rankwagers`)

```
releases/<release-id>/   # immutable build (.next, package.json, …)
current -> releases/<id>
previous -> releases/<prev>
shared/.env              # secrets (never baked into artifact)
shared/logs/
```

## Deploy

```bash
# On build host: npm ci && npm run build
export RW_ROOT=/opt/rankwagers
export SOURCE_DIR=/path/to/built/tree
./deploy/release-deploy.sh
```

Failed deploy must not move `current` until the new release is prepared; symlink switch is last step.

Legacy in-place update (no artifact retention): `./deploy/update-server.sh` — prefer `release-deploy.sh` for staging/prod.

## Rollback

```bash
export RW_ROOT=/opt/rankwagers
export BASE_URL=https://staging.example
./scripts/rollback-release.sh
```

No git checkout, no rebuild. Feature-flag emergency disables remain independent.

## Assumptions

- Single PM2 fork instance
- Shared `.env` outside release tree
- Migrations applied explicitly before promote
- Production deploy is always manual
