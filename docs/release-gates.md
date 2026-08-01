# Release gates

Script: `scripts/validate-release.ts`

Fails when tests/lint/typecheck/build/security-scan/**CTA boundary scan** fail, example.com fallback present, production diagnostics/cron default on, migrations missing, or staging robots isolation absent.

CTA gate: `node scripts/scan-client-cta-boundary.mjs` (also required in CI post-build).

Output is JSON with stable `code` per gate — no secrets.

Promotion blocked until `ok: true`.
