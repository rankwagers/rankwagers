/**
 * Google Consent Mode v2 — client helpers + shared defaults.
 *
 * Measurement infrastructure only. This module does NOT render a banner UI; it
 * plumbs the consent signal so that (a) GA4/GTM measure correctly and
 * consent-aware from the first visit, and (b) a future consent banner only has
 * to call `updateConsent(...)`. The default signal is emitted before GTM by
 * `components/ConsentMode.tsx`.
 *
 * Default policy (`balanced`): analytics granted (first-party measurement),
 * advertising + personalization denied (this is an affiliate site, not an ad
 * retargeter), functionality + security granted. Override with
 * `NEXT_PUBLIC_CONSENT_DEFAULT = balanced | strict | granted`.
 */

export type ConsentSignal = "granted" | "denied";

export type ConsentState = {
  ad_storage: ConsentSignal;
  ad_user_data: ConsentSignal;
  ad_personalization: ConsentSignal;
  analytics_storage: ConsentSignal;
  functionality_storage: ConsentSignal;
  personalization_storage: ConsentSignal;
  security_storage: ConsentSignal;
};

export type ConsentDefaultMode = "balanced" | "strict" | "granted";

export const CONSENT_COOKIE = "rw_consent";
export const CONSENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

export function resolveConsentDefaultMode(
  raw: string | undefined = process.env.NEXT_PUBLIC_CONSENT_DEFAULT
): ConsentDefaultMode {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "strict" || v === "granted") return v;
  return "balanced";
}

/** The default consent state for a first-time (no prior choice) visitor. */
export function defaultConsentState(mode: ConsentDefaultMode): ConsentState {
  if (mode === "granted") {
    return {
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
      analytics_storage: "granted",
      functionality_storage: "granted",
      personalization_storage: "granted",
      security_storage: "granted",
    };
  }
  if (mode === "strict") {
    return {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
      functionality_storage: "granted",
      personalization_storage: "denied",
      security_storage: "granted",
    };
  }
  // balanced (default): measure, don't retarget.
  return {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "granted",
    functionality_storage: "granted",
    personalization_storage: "denied",
    security_storage: "granted",
  };
}

/**
 * Client-side: apply a consent decision (e.g. from a future banner). Pushes a
 * Consent Mode `update` into the dataLayer and persists the choice so the next
 * visit resolves it before GTM loads. Safe no-op on the server.
 */
export function updateConsent(next: Partial<ConsentState>): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  // ConsentMode defines the gtag() shim before GTM loads, so it is present here.
  if (typeof w.gtag === "function") {
    w.gtag("consent", "update", next);
  }
  try {
    document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(
      JSON.stringify(next)
    )}; path=/; max-age=${CONSENT_COOKIE_MAX_AGE}; SameSite=Lax`;
  } catch {
    /* cookie write best-effort */
  }
}
