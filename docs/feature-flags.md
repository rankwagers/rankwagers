# Feature flags

Source: `lib/config/featureFlags.ts` (server truth).

| Flag | Env override | Prod default |
|---|---|---|
| comboHomepageVisible | `FF_COMBO_HOMEPAGE_VISIBLE` | true |
| comboRouteEnabled | `FF_COMBO_ROUTE_ENABLED` | true |
| affiliateOperatorsVisible | `FF_AFFILIATE_OPERATORS_VISIBLE` | true |
| signedRedirectRequired | `FF_SIGNED_REDIRECT_REQUIRED` | false* |
| attributionPersistenceEnabled | `FF_ATTRIBUTION_PERSISTENCE_ENABLED` | true (deployed) |
| postbackIngestionEnabled | `FF_POSTBACK_INGESTION_ENABLED` | false |
| optionalAnalyticsEnabled | `FF_OPTIONAL_ANALYTICS_ENABLED` | true |
| experimentationEnabled | `FF_EXPERIMENTATION_ENABLED` | **false** (Sprint 25) |
| operatorApprovalEnabled | `FF_OPERATOR_APPROVAL_ENABLED` | **false** (Sprint 20B-A/B) |
| publicAccaPagesEnabled | `FF_PUBLIC_ACCA_PAGES_ENABLED` | true (Sprint 24) |
| developerDiagnosticsEnabled | `ENABLE_DIAGNOSTICS` / `FF_DEVELOPER_DIAGNOSTICS_ENABLED` | false (deployed) |
| internalCronEnabled | `ENABLE_CRON` / `FF_INTERNAL_CRON_ENABLED` | false |
| stagingBannerVisible | `FF_STAGING_BANNER_VISIBLE` | true on staging |

\* Enable `FF_SIGNED_REDIRECT_REQUIRED=true` only after all outbound `/go` CTAs include signed `ctx`.

Emergency:

- `FF_EMERGENCY_DISABLE_COMBO=true`
- `FF_EMERGENCY_DISABLE_AFFILIATE=true`
- `FF_EMERGENCY_DISABLE_APPROVAL=true` — forces `operatorApprovalEnabled` off

## Acca flags — how the two interact

`operatorApprovalEnabled` gates the **admin publication backend**: candidate review, Acca creation,
publish and archive. `publicAccaPagesEnabled` gates the **public reader surface**. They are
independent in both directions, which is deliberate.

| approval | public | Result |
|---|---|---|
| off | on | **Current default.** Nothing can be published, so the public index renders its honest empty state and the Acca sitemap shard is empty. Nothing leaks, because a public page can only ever show a PUBLISHED record. |
| on | off | Operators can prepare and publish; readers see 404. The state a launch rehearsal needs. |
| on | on | Fully live. |
| off | off | Everything closed; stored records untouched. |

With `publicAccaPagesEnabled=false`:

- `/{locale}/accas` and `/{locale}/accas/{slug}` return **404**, indistinguishable from a route
  that does not exist.
- The homepage published-Acca section renders nothing.
- The `accas` sitemap shard emits nothing — sitemap inclusion follows public visibility.
- **No stored record changes.** The flag hides; it does not unpublish. Withdrawing one specific
  Acca is `archive`, not a flag.

The check lives in `lib/acca-publication/public.ts` alongside the status and locale filters, so one
switch closes every reader path at once rather than each route remembering to ask.

`FF_EMERGENCY_DISABLE_APPROVAL` does **not** close the public pages. Killing the admin surface in an
incident should not 404 URLs a crawler already holds; set `FF_PUBLIC_ACCA_PAGES_ENABLED=false`
explicitly when the reader surface must go dark too.

The Builder entry point on the public Acca index follows the existing `comboRouteEnabled` flag, so
the index never links to a generation surface that is switched off.

Client may receive only `publicFeatureFlags()` booleans for rendering.
