# Growth Measurement Infrastructure (RankWagers)

**Goal:** when traffic starts arriving, every important event is measurable — we can
see exactly *how a visitor found us* and *what they did*. Measurement only; no
CTA/conversion optimisation, no experiments.

This layers on the existing stack (GTM + GA4, server-side event log
`data/events.log`, affiliate `/go/` redirects + S2S postbacks, traffic-classification
dashboards) and fills the four gaps that were missing.

## What is now instrumented

| Signal | Where it goes | Files |
|---|---|---|
| **Consent Mode v2** (default before GTM) | GA4/GTM initialise consent-aware; returning-visitor choice re-applied from `rw_consent` cookie | `components/ConsentMode.tsx`, `lib/consent/consent.ts` |
| **Core Web Vitals** (LCP/INP/CLS/FCP/TTFB) | `dataLayer → GA4` (`web_vitals` event) **and** `/api/vitals → data/web-vitals.log` (internal p75) | `components/WebVitals.tsx`, `app/api/vitals/route.ts`, `lib/webVitals/store.ts` |
| **UTM + click-id attribution** | first-touch (`rw_ft`) + last-touch (`rw_lt`) cookies + `dataLayer` (`attribution` event) | `components/AttributionTracker.tsx`, `lib/attribution/attribution.ts` |
| **GSC / Bing / Yandex verification** | `<meta>` verification tags (env-driven) | `app/layout.tsx` `generateMetadata()` |
| **Readiness dashboard** | `/admin/growth` — instrumentation status + live CWV p75 | `app/admin/growth/page.tsx`, `lib/growth/readiness.ts` |

Nothing double-counts: GA4 stays **inside GTM** (no on-page `gtag.js`) — see
`docs/ga4-gtm-setup.md`.

## One-time operator setup

1. **Search Console / Bing verification.** Paste the verification token from each
   console into `.env` and restart:
   ```
   NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=<google token>
   NEXT_PUBLIC_BING_SITE_VERIFICATION=<msvalidate.01 token>
   ```
   `npm run build && pm2 restart aff-site --update-env`. Then confirm in each
   console and submit `https://<host>/sitemap.xml`. (`robots.ts` already declares
   the sitemap + host and noindexes staging.)

2. **Consent default.** `NEXT_PUBLIC_CONSENT_DEFAULT` = `balanced` (default:
   analytics granted, advertising denied), `strict` (all denied — EEA-safe until a
   banner grants), or `granted`. A future consent banner only needs to call
   `updateConsent({...})` from `lib/consent/consent.ts`; the choice persists and is
   re-applied before tags on the next visit.

3. **GTM tags to publish** (in container `GTM-5D4FPZ99`), so the new dataLayer
   events reach GA4:
   - **Web Vitals** → GA4 Event tag on Custom Event `web_vitals`; params
     `metric`, `value`, `rating`, `path` (map to GA4 event params). (GA4 also has a
     built-in Web Vitals report once events flow.)
   - **Attribution** → GA4 Event tag on Custom Event `attribution`; map
     `lt_source`/`lt_medium`/`lt_campaign`/`lt_gclid`/`lt_msclkid` to user/session
     params for acquisition reporting.
   - **Affiliate click** → already documented (`Click URL contains /go/` →
     `affiliate_click`), see `docs/ga4-gtm-setup.md`.

## How "how did they find us?" is answered

- **Server:** `data/events.log` records views/clicks with referer + country +
  page; `lib/analyticsTraffic` / `trafficClassify` classify organic vs referral.
- **First/last touch:** `rw_ft` (persist-once) and `rw_lt` (refreshed) cookies hold
  `utm_*`, `gclid`, `msclkid`, `fbclid`, referrer and landing path.
- **First-party server capture:** every pageview (`/api/track`) and affiliate click
  (`/go/[brand]`) now stamps `source` / `medium` / `campaign` onto the `SiteEvent`
  (from the last-touch cookie, first-touch fallback — `attributionFromCookies`). This
  closes the loop **in our own log** — "came from google/cpc → viewed X → clicked
  operator Y" — independent of GA4, so it survives consent denial and ad-blockers.
  Visible at `/admin/growth` (source/medium breakdown + attributed share).
- **GA4:** acquisition/engagement/attribution reports (via GTM), Consent-Mode-aware.
- **Conversions:** affiliate `/go/` click events + operator S2S postbacks
  (`lib/affiliate/postbacks/*`) close the loop to deposits/registrations.

## Privacy / correctness notes

- Consent Mode default loads **before** GTM (plain inline script) so no tag fires
  outside the granted state; ad storage is denied by default.
- Web Vitals + attribution are first-party, non-PII, and reuse the same
  bot/internal-traffic filters as the event log (`shouldRecordPath`,
  `shouldLogUserAgent`).
- `data/web-vitals.log` is git-ignored (`/data/*.log`) and kept **separate** from
  the frozen `SiteEvent` schema, so performance telemetry never couples into the
  affiliate event contract.
- All new client trackers are best-effort and wrapped in try/catch — measurement
  can never break a page render.

## Verifying it works

- `/admin/growth` → all instrumentation ✅ and live CWV p75 once traffic loads.
- GA4 → Realtime: navigate the site; `web_vitals` / `attribution` / `affiliate_click`
  events should appear.
- GTM Preview (Tag Assistant) → confirm the Consent default fires first, then GA4.
