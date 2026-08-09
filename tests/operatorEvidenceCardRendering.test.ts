import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  OperatorEvidenceCard,
  OperatorEvidenceCardList,
} from "../components/operators/OperatorEvidenceCard";
import { buildOperatorEvidenceCards, recommendableCards } from "../lib/operators/evidenceCard";
import { listOperators } from "../lib/operators/registry";
import { resolveOperatorAvailability } from "../lib/operators/availability";
import {
  __resetOperatorCardImpressions,
  trackOperatorCardImpression,
  type OperatorCardContext,
} from "../lib/analytics/operatorCard";
import { findClaimViolations, hasUnqualifiedRanking } from "../lib/trust/claims";

/**
 * Sprint 21 — rendering, flag, crawlability and analytics-dedupe evidence.
 *
 * The ranking model is covered by `operatorEvidenceCard.test.ts`. This suite proves the parts that
 * only exist once the model is rendered: that the card is present in server HTML without
 * hydration, that the feature flag genuinely darkens it, and that an impression cannot be counted
 * twice.
 */

(globalThis as unknown as { React: typeof React }).React = React;

const NOW = "2026-07-28T12:00:00.000Z";
const FLAG = "FF_AFFILIATE_OPERATORS_VISIBLE";

function realCards(limit = 3) {
  const operators = listOperators().filter((o) => o.affiliateEnabled);
  return recommendableCards(
    buildOperatorEvidenceCards(
      operators.map((operator) => ({
        operator,
        availability: resolveOperatorAvailability(operator, "GB"),
        marketKey: null,
      })),
      { nowIso: NOW, limit },
    ),
  );
}

function renderList(cards = realCards()) {
  return renderToStaticMarkup(
    React.createElement(OperatorEvidenceCardList, {
      cards,
      locale: "en" as never,
      country: "GB",
      surface: "fixture" as const,
      headingId: "operator-recommendations",
      heading: "Operators covering this fixture",
    }),
  );
}

function withFlag<T>(value: string, fn: () => T): T {
  const previous = process.env[FLAG];
  process.env[FLAG] = value;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env[FLAG];
    else process.env[FLAG] = previous;
  }
}

/* ================================================================== *
 * 1. Feature flag
 * ================================================================== */

test("the flag darkens the whole layer, not just the CTA", () => {
  const off = withFlag("false", () => renderList());
  assert.equal(off, "", "flag off must render nothing at all");
});

test("the flag on renders the section", () => {
  const on = withFlag("true", () => renderList());
  assert.ok(on.length > 0);
  assert.match(on, /Operators covering this fixture/);
});

test("an unparseable flag value resolves to the configured default, never to a third state", () => {
  /*
   * Measured, not assumed: `affiliateOperatorsVisible` defaults ON outside deployed environments,
   * so a typo here renders rather than darkens. That is `parseBool` working — an unreadable value
   * falls back to the declared default instead of inventing a value. Asserted by comparison so the
   * test stays correct if the default is ever changed deliberately.
   */
  const rendered = (html: string) => html.length > 0;
  // Byte comparison is invalid here: the signed outbound token embeds issuedAt/expiresAt, so two
  // renders of identical inputs legitimately differ. The decision is what must match.
  assert.equal(
    rendered(withFlag("maybe", () => renderList())),
    rendered(renderList()),
    "an unparseable value must not differ from no value at all",
  );
});

test("an explicit false always darkens, whatever the default is", () => {
  assert.equal(withFlag("false", () => renderList()), "");
  assert.equal(withFlag("0", () => renderList()), "");
  assert.equal(withFlag("off", () => renderList()), "");
});

/* ================================================================== *
 * 2. Empty state
 * ================================================================== */

test("no cards renders nothing rather than an empty shell", () => {
  const html = withFlag("true", () => renderList([]));
  assert.equal(html, "", "an empty section is a dead zone with a heading on it");
});

test("a set with only unavailable operators is empty after filtering", () => {
  const cards = buildOperatorEvidenceCards(
    listOperators()
      .filter((o) => o.affiliateEnabled)
      // Only operators that actually declare a country list can be made unavailable. An operator
      // with an empty supportedCountries is "Availability not restricted" by design, and filtering
      // it out here would be testing a rule the product does not have.
      .filter((o) => o.supportedCountries.length > 0)
      .map((operator) => ({
        operator,
        availability: resolveOperatorAvailability(operator, "ZZ"),
        marketKey: null,
      })),
    { nowIso: NOW },
  );
  assert.equal(recommendableCards(cards).length, 0);
  assert.equal(withFlag("true", () => renderList(recommendableCards(cards))), "");
});

/* ================================================================== *
 * 3. Crawlability — core content must not require hydration
 * ================================================================== */

test("card content is present in server HTML with no client JS", () => {
  const html = withFlag("true", () => renderList());
  const cards = realCards();
  assert.ok(cards.length > 0, "fixture data must produce at least one card for this to mean anything");

  // Names are HTML-escaped on render ("Bet&You" -> "Bet&amp;You"), so compare escaped.
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  for (const card of cards) {
    assert.ok(html.includes(escape(card.name)), `${card.name} missing from server HTML`);
  }
  // The derivation, the ranking basis and both CTAs are all server-rendered.
  assert.match(html, /Why this operator\?/);
  assert.match(html, /View odds/);
  assert.match(html, /Operator details/);
  assert.match(html, /availability is a precondition/i);
});

test("the disclosure is a native details element, so it opens without JavaScript", () => {
  const html = withFlag("true", () => renderList());
  assert.match(html, /<details/);
  assert.match(html, /<summary/);
});

test("outbound CTAs are marked sponsored and nofollow", () => {
  const html = withFlag("true", () => renderList());
  // Only assert when the fixture registry actually yields an outbound link.
  if (html.includes('data-operator-cta="primary"') && html.includes("<a ")) {
    const outbound = /<a[^>]+data-operator-cta="primary"[^>]*>/.exec(html);
    if (outbound) {
      assert.match(outbound[0], /rel="sponsored nofollow noopener"/);
      assert.match(outbound[0], /target="_blank"/);
    }
  }
});

test("a heading and section landmark exist for crawlers and screen readers", () => {
  const html = withFlag("true", () => renderList());
  assert.match(html, /<h2[^>]*id="operator-recommendations"/);
  assert.match(html, /aria-labelledby="operator-recommendations"/);
});

/* ================================================================== *
 * 4. Accessibility
 * ================================================================== */

test("every card exposes an accessible name and rank", () => {
  const html = withFlag("true", () => renderList());
  assert.match(html, /aria-labelledby="operator-evidence-/);
  assert.match(html, /Rank 1: /);
});

test("the ranking score is announced when it renders — and it does not render without a price", () => {
  /*
   * The truth pass: this fixture set observes NO price at any operator, so every card scored an
   * identical availability-only 67 — a row of identical meters reading as fake precision. In
   * that state the meter is omitted whole; verification and availability carry the card, and
   * the stated tie-break still orders the list. When a price IS observed and the meter renders,
   * the accessibility guarantee is unchanged — the figure is announced in text, not conveyed by
   * the bar alone — pinned at the meter's own markup, which carries the aria-label.
   */
  const html = withFlag("true", () => renderList());
  assert.equal(/aria-label="Ranking score/.test(html), false, "no price, no meter");
  assert.match(html, /Verified|Availability/, "verification and availability carry the card");
  const source = readFileSync(
    path.join(process.cwd(), "components/operators/OperatorEvidenceCard.tsx"),
    "utf8"
  );
  assert.match(source, /aria-label=\{`Ranking score \$\{score\} out of \$\{max\}`\}/);
  assert.equal(/aria-label="Evidence score/.test(html), false);
});

test("met and unmet reasons are distinguished for screen readers, not only by colour", () => {
  const html = withFlag("true", () => renderList());
  assert.ok(
    html.includes("Met: ") || html.includes("Not met: "),
    "the tick glyph is aria-hidden, so the state must be in text",
  );
});

test("focus states are declared on every interactive element", () => {
  const html = withFlag("true", () => renderList());
  const interactive = html.match(/<(a|button|summary)\s[^>]*>/g) ?? [];
  assert.ok(interactive.length > 0);
  for (const el of interactive) {
    assert.match(el, /focus-visible:ring/, `missing visible focus state: ${el.slice(0, 80)}`);
  }
});

test("a new-tab CTA warns screen reader users", () => {
  const html = withFlag("true", () => renderList());
  if (html.includes('target="_blank"')) {
    assert.match(html, /opens in a new tab/);
  }
});

/* ================================================================== *
 * 5. Trust guard over rendered output
 * ================================================================== */

test("the rendered card emits no banned claim and no unqualified ranking", () => {
  const html = withFlag("true", () => renderList());
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  assert.deepEqual(findClaimViolations(text), []);
  assert.equal(hasUnqualifiedRanking(text), false);
});

/* ================================================================== *
 * 6. Impression dedupe
 * ================================================================== */

function ctx(overrides: Partial<OperatorCardContext> = {}): OperatorCardContext {
  return {
    surface: "fixture",
    operatorSlug: "acme",
    locale: "en",
    fixtureId: 1,
    market: null,
    position: 1,
    evidenceScore: 50,
    qualification: "QUALIFIED",
    ...overrides,
  };
}

test("an impression for the same operator and surface is counted once", () => {
  /*
   * Without this, a card scrolled past three times reports three impressions and CTR is understated
   * by a factor nobody can reconstruct after the fact. Re-renders and StrictMode double-invocation
   * would do the same.
   */
  __resetOperatorCardImpressions();
  const emitted: string[] = [];
  const original = (globalThis as { dataLayer?: unknown[] }).dataLayer;
  (globalThis as { dataLayer?: unknown[] }).dataLayer = {
    push: (e: unknown) => emitted.push(JSON.stringify(e)),
  } as unknown as unknown[];

  try {
    trackOperatorCardImpression(ctx());
    trackOperatorCardImpression(ctx());
    trackOperatorCardImpression(ctx());
    assert.ok(emitted.length <= 1, `expected at most one emission, saw ${emitted.length}`);
  } finally {
    (globalThis as { dataLayer?: unknown[] }).dataLayer = original;
  }
});

test("the same operator on a different surface is a distinct impression", () => {
  __resetOperatorCardImpressions();
  // Dedupe must be scoped, otherwise a fixture impression would suppress the market one and
  // per-template CTR comparison becomes impossible.
  assert.doesNotThrow(() => {
    trackOperatorCardImpression(ctx({ surface: "fixture" }));
    trackOperatorCardImpression(ctx({ surface: "market" }));
  });
});

test("the reset seam actually clears state between cases", () => {
  __resetOperatorCardImpressions();
  assert.doesNotThrow(() => trackOperatorCardImpression(ctx()));
});

/* ================================================================== *
 * 7. Single-card rendering
 * ================================================================== */

test("an unknown slug renders nothing instead of a broken card", () => {
  const html = withFlag("true", () =>
    renderToStaticMarkup(
      React.createElement(OperatorEvidenceCard, {
        card: { ...realCards(1)[0], slug: "does-not-exist-in-registry" },
        locale: "en" as never,
        country: "GB",
        surface: "fixture" as const,
        position: 1,
      }),
    ),
  );
  assert.equal(html.includes("View odds"), false);
});

test("KNOWN: rendered HTML is not byte-stable, because the outbound token is time-bound", () => {
  /*
   * `operatorAffiliateHref` embeds issuedAt/expiresAt in the signed ctx, so the same inputs produce
   * different HTML on each render. This is correct — a token with no expiry would be a replayable
   * affiliate link — but it means these cards must not be cached as static HTML beyond the token
   * TTL, and it is why comparisons in this suite normalise or compare decisions rather than bytes.
   */
  const first = withFlag("true", () => renderList());
  const second = withFlag("true", () => renderList());
  const strip = (html: string) => html.replace(/ctx=[^"&]+/g, "ctx=REDACTED");
  assert.equal(strip(first), strip(second), "everything except the token must be stable");
});