import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * THE LIVE DESK, PROVEN THE WAY THE HERO WAS PROVEN.
 *
 * Twice a pass "converted" this desk and the screen did not change, because the interior lived
 * behind a client fetch: no test could render it without a network, so deletions around it passed
 * a full suite while the old card kept painting the page. Three lessons are encoded here:
 *
 *   MOUNTED    the panel is RENDERED, with a feed injected through `initialFeed`, and the map's
 *              composition is asserted in the markup it produces. If the card is unmounted, or
 *              the panel stops accepting an injected feed, this fails.
 *   KILLED     the teaser strings and the old interior's components are asserted absent from the
 *              SOURCE of both live files — the strings, not the styling, because the styling is
 *              what survived the last two attempts.
 *   DERIVED    the arithmetic behind "N more goals settle it" is run, not read.
 */

/* eslint-disable @typescript-eslint/no-var-requires */
(globalThis as { React?: unknown }).React = require("react");
const React = require("react") as typeof import("react");
const { renderToStaticMarkup } = require("react-dom/server") as typeof import("react-dom/server");

const { LiveFeedPanel } =
  require("../components/predictions/LiveFeedPanel") as typeof import("../components/predictions/LiveFeedPanel");
const { goalsToSettle, thresholdLadder, formatCountdown } =
  require("../components/predictions/LiveDeskCard") as typeof import("../components/predictions/LiveDeskCard");
const { getDictionary } = require("../lib/dictionaries") as typeof import("../lib/dictionaries");

import type { LiveFeedResponse } from "../lib/live-feed/types";

const root = process.cwd();
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const src = (rel: string) => stripComments(readFileSync(path.join(root, rel), "utf8"));

/* ------------------------------------------------------------------ fixture */

function feed(): LiveFeedResponse {
  return {
    hourKey: "2026-08-04T19",
    featured: {
      id: "sig-1",
      strategy: "o25",
      home: "ABB",
      away: "Real Oruro",
      league: "LFPB",
      country: "Bolivia",
      homeScore: 1,
      awayScore: 0,
      minute: "61",
      marketLabel: "Over 2.5 Goals",
      status: "live",
      resultState: "live",
      signaledAt: "2026-08-04T19:23:00.000Z",
      featured: true,
    },
    locked: [],
    history: [],
    upcomingFeatured: {
      id: "up-1",
      strategy: "o25",
      strategies: ["o25"],
      home: "FarDU",
      away: "TerDU",
      league: "Pro League A",
      country: "uz",
      kickoffIso: "2026-08-04T12:30:00.000Z",
      startsInMinutes: 147,
      marketLabel: "Upcoming",
      predictionLabel: "1H 0.5+ · Over 2.5",
    },
    upcomingLocked: [],
    upcomingBatchKey: null,
    nextUpcomingRefreshAt: null,
    telegramBotUrl: null,
    source: "telegram-eng",
  };
}

function renderDesk(response: LiveFeedResponse = feed()): string {
  return renderToStaticMarkup(
    React.createElement(LiveFeedPanel, {
      dict: getDictionary("en"),
      initialFeed: response,
    })
  );
}

/* ------------------------------------------------------------------ *
 * MOUNTED — the map's composition, in rendered markup
 * ------------------------------------------------------------------ */

test("the desk renders the map's card: score, market, derivation, chips, timeline", () => {
  const html = renderDesk();

  assert.ok(html.includes("1–0"), "the provider score, at card scale");
  assert.ok(html.includes("Latest provider score"), "named as the provider's, not as truth");
  assert.ok(html.includes("Over 2.5 Goals"), "the market the signal is about");
  assert.ok(html.includes("2 more goals settle it"), "the derivation from line and score");
  assert.ok(html.includes("✓") && html.includes("cleared"), "the cleared rungs of the ladder");
  assert.ok(html.includes("pending"), "and the rung still open");
  assert.ok(html.includes("needs 2"), "with what it still needs");
  // The timeline: rail labels and the live minute in its reserved colour class.
  assert.ok(html.includes("HT") && html.includes("90′"), "the timeline is marked");
  assert.ok(html.includes("rw-live-minute"), "the minute carries the live colour class");
  assert.ok(html.includes("61′"), "at the provider's minute");
});

test("the desk renders the countdown upcoming row", () => {
  const html = renderDesk();
  assert.ok(html.includes("FarDU"), "the upcoming fixture is published, not teased");
  assert.ok(html.includes("1H 0.5+ · Over 2.5"), "with its prediction line");
  assert.ok(html.includes("2h 27m"), "and the countdown");
  assert.ok(html.includes("12:30 UTC"), "to a stated kick-off");
});

test("the league cell resolves a name and the country field survives both formats", () => {
  const html = renderDesk();
  assert.ok(html.includes("Bolivia"), "a full-name country renders as itself");
  assert.ok(html.includes("Uzbekistan"), "an ISO code resolves to its full name");
  assert.equal(/\bUZ\b/.test(html), false, "and the raw code never prints");
});

test("a feed with nothing live states the empty desk rather than teasing one", () => {
  const html = renderDesk({ ...feed(), featured: null, upcomingFeatured: null });
  const p = getDictionary("en").predictions;
  assert.ok(html.includes(p.liveEmpty), "the stated empty state renders");
  assert.equal(html.includes("1–0"), false, "and no card is drawn");
});

/* ------------------------------------------------------------------ *
 * KILLED — the old interior cannot return quietly
 * ------------------------------------------------------------------ */

test("the teaser strings are gone from both live files", () => {
  for (const rel of [
    "components/predictions/LiveFeedPanel.tsx",
    "components/predictions/LiveFeedParts.tsx",
    "components/predictions/LiveDeskCard.tsx",
  ]) {
    const code = src(rel);
    assert.doesNotMatch(
      code,
      /liveFeaturedMoreCta|liveTapTelegram|upcomingTapSeePick/,
      `a teaser string survives in ${rel}`
    );
    assert.doesNotMatch(code, /blur-\[|████|Home Team/, `blurred invention survives in ${rel}`);
  }
});

test("the old interior's components are deleted, not merely unmounted", () => {
  const parts = src("components/predictions/LiveFeedParts.tsx");
  for (const name of [
    "LiveFeaturedCard",
    "UpcomingFeaturedCard",
    "UpcomingLockedRow",
    "LiveUnlockModal",
    "LiveHistorySlider",
  ]) {
    assert.doesNotMatch(
      parts,
      new RegExp(`function ${name}`),
      `${name} still exists — an unmounted interior is one import away from returning`
    );
  }
});

test("one header, and the framing precedes any signal", () => {
  const panel = src("components/predictions/LiveFeedPanel.tsx");
  assert.equal((panel.match(/<LiveSignalsHeader/g) ?? []).length, 1);
  const html = renderDesk();
  const framingAt = html.indexOf("Not tips");
  const scoreAt = html.indexOf("1–0");
  assert.ok(framingAt > -1 && scoreAt > framingAt, "the reader meets the framing first");
});

/* ------------------------------------------------------------------ *
 * DERIVED — arithmetic run against real cases
 * ------------------------------------------------------------------ */

test("goalsToSettle is arithmetic on the line and the score, nothing else", () => {
  assert.equal(goalsToSettle("o25", 1, 0), 2);
  assert.equal(goalsToSettle("o25", 2, 1), 0, "a settled market needs nothing");
  assert.equal(goalsToSettle("o25", 4, 0), 0, "and never goes negative");
  assert.equal(goalsToSettle("fh05", 0, 0), 1);
  assert.equal(goalsToSettle("fh05", 1, 0), 0);
  assert.equal(goalsToSettle("o25", Number.NaN, 0), null, "garbage in, nothing out — never zero");
});

test("the threshold ladder reads the same two facts", () => {
  assert.deepEqual(thresholdLadder("o25", 1, 0), [
    { line: "0.5", cleared: true, needs: 0 },
    { line: "1.5", cleared: false, needs: 1 },
    { line: "2.5", cleared: false, needs: 2 },
  ]);
  assert.deepEqual(thresholdLadder("fh05", 0, 0), [{ line: "0.5", cleared: false, needs: 1 }]);
});

test("the countdown formats the feed's own minutes", () => {
  assert.equal(formatCountdown(147), "2h 27m");
  assert.equal(formatCountdown(27), "27m");
  assert.equal(formatCountdown(-3), null, "a kickoff in the past prints no countdown");
});
