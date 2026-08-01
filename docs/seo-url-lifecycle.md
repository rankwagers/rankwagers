# SEO URL lifecycle (match / prediction pages)

Policies: `lib/seo-intelligence/lifecycle.ts`

| State | Preferred decision | Guidance |
|-------|-------------------|----------|
| pre_match | INDEX | When published prediction + complete identity |
| live | INDEX | While prediction/context valid |
| recently_completed | INDEX | While settlement forming |
| settled | INDEX | Keep factual settled pages — do not delete because match ended |
| archived | INDEX | Enduring archive value |
| stale | NOINDEX | Without archive value → noindex or canonicalize to archive |
| invalid | NOINDEX | Empty shells; 404/410 when defensible |
| cancelled | NOINDEX | Without enduring value |
| postponed | REVIEW_REQUIRED | NOINDEX without value; may INDEX if rescheduled + prediction |
| abandoned | NOINDEX | Without settlement |

**Automation rule:** No automatic destructive delete/redirect without documented policy. Sprint 22 audits and recommends; it does not mass-mutate public URLs.
