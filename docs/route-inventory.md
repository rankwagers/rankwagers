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

**Decision (v3 reskin, session 1, 2026-09-09):** the tip-vocabulary ban is retired. Bible V3 (docs/design/bible-v3.md) positions the product as an affiliate-first predictions site whose primary nav says "Betting Tips"; "tips", "free bets", "bonuses" and "offers" are allowed vocabulary in every register. Retired with it: the TIP_DEBT sweep machinery (tests/localeVocabularySweep.test.ts is now a tombstone) and the tip-as-product patterns in lib/trust/claims.ts. Unchanged: every honesty law — certainty, guaranteed outcomes, impossible precision, privileged information, effortless profit remain banned, and the claim-integrity and label scans stay in force. Do not re-open without a positioning change as explicit as the one that closed it.
