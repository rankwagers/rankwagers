import {
  CONSENT_COOKIE,
  defaultConsentState,
  resolveConsentDefaultMode,
} from "@/lib/consent/consent";

/**
 * Google Consent Mode v2 default signal — MUST render before GTM
 * (`GoogleTagManagerHead`) so GA4/GTM initialise consent-aware.
 *
 * Emits `gtag('consent','default', …)` with the site default policy, then
 * re-applies a returning visitor's stored choice (`rw_consent` cookie) as an
 * `update` so their prior decision wins before any tag fires. No banner UI is
 * rendered here — a future banner only needs to call `updateConsent()`
 * (`lib/consent/consent.ts`). See docs/growth-measurement.md.
 */
export function ConsentMode() {
  const mode = resolveConsentDefaultMode();
  const state = defaultConsentState(mode);

  // Inline, runs before GTM. Reads the returning-visitor cookie at runtime so a
  // prior choice is authoritative pre-tag. `wait_for_update` gives an async
  // banner a brief window to update before tags decide.
  const html = `
(function(){
  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  var def = ${JSON.stringify({ ...state, wait_for_update: 500 })};
  gtag('consent','default', def);
  gtag('set','ads_data_redaction', true);
  gtag('set','url_passthrough', true);
  try {
    var m = document.cookie.match(/(?:^|;\\s*)${CONSENT_COOKIE}=([^;]+)/);
    if (m) {
      var prior = JSON.parse(decodeURIComponent(m[1]));
      if (prior && typeof prior === 'object') gtag('consent','update', prior);
    }
  } catch (e) {}
})();`;

  // Plain inline script (Google's canonical Consent Mode install): it executes
  // during HTML parse, before GTM's afterInteractive injection — guaranteeing
  // the default signal precedes every tag.
  return (
    <script
      id="consent-mode-default"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
