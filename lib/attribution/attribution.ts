/**
 * Traffic attribution model — pure parsing (no DOM), so it is testable and
 * reusable server-side later. Captures a "touch": the campaign params and click
 * identifiers that answer "how did this visitor find us?".
 *
 * First-touch (rw_ft) is persisted ONCE and never overwritten (acquisition
 * credit). Last-touch (rw_lt) is refreshed each visit (conversion path).
 * Consumed by GA4 via the dataLayer and readable server-side from the cookies.
 */

export const FIRST_TOUCH_COOKIE = "rw_ft";
export const LAST_TOUCH_COOKIE = "rw_lt";
export const FIRST_TOUCH_MAX_AGE = 60 * 60 * 24 * 180; // 180 days
export const LAST_TOUCH_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

export type Touch = {
  source: string;
  medium: string;
  campaign: string;
  term: string;
  content: string;
  gclid: string;
  msclkid: string;
  fbclid: string;
  referrer: string;
  landing: string;
  ts: string;
};

function pick(params: URLSearchParams, key: string): string {
  return (params.get(key) || "").slice(0, 128).trim();
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Derive a touch from the landing URL query + referrer. Attribution precedence:
 * explicit UTM > click-id inference (gclid/msclkid/fbclid) > referrer host >
 * direct. Never throws.
 */
export function parseTouch(input: {
  search: string;
  referrer: string;
  landingPath: string;
  currentHost: string;
  now: string;
}): Touch {
  const params = new URLSearchParams(input.search || "");
  const gclid = pick(params, "gclid");
  const msclkid = pick(params, "msclkid");
  const fbclid = pick(params, "fbclid");

  let source = pick(params, "utm_source");
  let medium = pick(params, "utm_medium");
  const campaign = pick(params, "utm_campaign");
  const term = pick(params, "utm_term");
  const content = pick(params, "utm_content");

  const refHost = hostOf(input.referrer);
  const internalRef = refHost !== "" && refHost === input.currentHost;

  if (!source || !medium) {
    if (gclid) {
      source = source || "google";
      medium = medium || "cpc";
    } else if (msclkid) {
      source = source || "bing";
      medium = medium || "cpc";
    } else if (fbclid) {
      source = source || "facebook";
      medium = medium || "paid_social";
    } else if (refHost && !internalRef) {
      source = source || refHost;
      medium = medium || "referral";
    } else {
      source = source || "(direct)";
      medium = medium || "(none)";
    }
  }

  return {
    source,
    medium,
    campaign,
    term,
    content,
    gclid,
    msclkid,
    fbclid,
    referrer: internalRef ? "" : input.referrer.slice(0, 256),
    landing: input.landingPath.slice(0, 256),
    ts: input.now,
  };
}

/** True when a touch carries no acquisition signal (pure internal navigation). */
export function isEmptyTouch(t: Touch): boolean {
  return (
    t.source === "(direct)" &&
    t.medium === "(none)" &&
    !t.gclid &&
    !t.msclkid &&
    !t.fbclid &&
    !t.referrer
  );
}

export function safeParseTouch(value: string | undefined): Touch | null {
  if (!value) return null;
  try {
    const t = JSON.parse(decodeURIComponent(value)) as Touch;
    return t && typeof t === "object" && typeof t.source === "string" ? t : null;
  } catch {
    return null;
  }
}

export type AttributionFields = {
  source?: string;
  medium?: string;
  campaign?: string;
};

/**
 * Server-side: resolve last-touch (preferred — what drove this action), falling
 * back to first-touch, from a cookie accessor. Returns only the fields the event
 * log records. Empty object when no attribution cookie is present.
 */
export function attributionFromCookies(
  get: (name: string) => string | undefined
): AttributionFields {
  const touch =
    safeParseTouch(get(LAST_TOUCH_COOKIE)) ?? safeParseTouch(get(FIRST_TOUCH_COOKIE));
  if (!touch) return {};
  const out: AttributionFields = {};
  if (touch.source) out.source = touch.source;
  if (touch.medium) out.medium = touch.medium;
  if (touch.campaign) out.campaign = touch.campaign;
  return out;
}
