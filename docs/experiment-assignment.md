# Experiment assignment

## Algorithm

`sha256(experimentId|assignmentVersion|assignmentKey)` → uniform `[0,1)` bucket.  
Traffic % uses a separate salt (`experimentId:traffic`).

Never `Math.random()` for persistent assignment.

## Exposure units

| Unit | Stability | Notes |
|------|-----------|-------|
| session | Tab-scoped | Uses analytics `session_id` when available |
| request | Per request | Not sticky |
| admin_test_identity | Admin only | Preview |
| anonymous_visitor | Unavailable | No durable consent-aware ID yet |
| device_like_anonymous | Unavailable | No fingerprinting |
| locale_session | Partial | Locale + session composite possible later |

## SSR / hydration

Prefer server-derived assignment for SSR content. Disabled flag → always CONTROL. Avoid CDN caching personalized HTML without Vary.
