# Route inventory

Generated artifact: `docs/route-inventory.generated.md`

```
node scripts/route-inventory.mjs
```

Groups: public_page, public_api, affiliate_redirect, health, protected_diagnostics, protected_internal, admin, developer_only.

When disabled:

| Kind | Expected |
|---|---|
| diagnostics | 404 / 403 |
| cron | 404 / 403 / 405 |
| combo route flag off | 404 |
| affiliate flag off | safe `/not-available` |

**Decision (Family E, 2026-08-09):** `/today` is a deliberate, permanent redirect to `/{locale}` — the homepage is today's research page (one clock, one home for the current day). Not a placeholder; do not build a separate today page.

**Decision (language sweep, 2026-08-13):** `/how-we-rank` and `/methodology` are BOTH canonical — different subjects (operator-ordering criteria vs prediction methodology), deliberately separate per Sprint 33 so commercial criteria never sit inside the prediction-transparency page. A fold/redirect was considered and declined; the pages cross-link instead. Not duplicates; do not merge.
