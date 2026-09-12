import assert from "node:assert/strict";
import test from "node:test";

import { buildVerifiedRecordCard } from "../lib/v3/verifiedRecord.server";
import { queryArchive } from "../lib/archive/load";

/**
 * V3 POLISH — group 7's probe: the homepage's verified card IS the archive
 * summary. Same query, same window, same numbers /archive prints — asserted
 * functionally against the live archive store, so the card cannot drift
 * from the page it links to.
 */

test("card == archive summary: pct, won, lost, settled, and the stated window", async () => {
  const [card, { metrics, dates }] = await Promise.all([
    buildVerifiedRecordCard("en", "today"),
    queryArchive("en", {}, { dateLimit: 60 }),
  ]);
  const settled = metrics.won + metrics.lost;
  if (settled === 0 || metrics.hitRatePct === null) {
    assert.equal(card, null, "zero settled → the card is omitted whole");
    return;
  }
  assert.ok(card, "settled records exist → the card renders");
  assert.equal(card.won, metrics.won);
  assert.equal(card.lost, metrics.lost);
  assert.equal(card.settled, settled);
  assert.equal(card.hitRatePct, Math.round(metrics.hitRatePct), "integer pct (group 9)");
  assert.ok(Number.isInteger(card.hitRatePct));
  // Group 3: the window speaks months, not wrapping ISO dates — the
  // from-bound as a locale month+year, the to-bound as "today" whenever
  // the window reaches the present day.
  assert.doesNotMatch(card.windowLabel, /\d{4}-\d{2}-\d{2}/, "no ISO date in the label");
  const oldest = dates[dates.length - 1];
  if (oldest) {
    const month = new Intl.DateTimeFormat("en", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${oldest}T00:00:00.000Z`));
    assert.ok(
      card.windowLabel.startsWith(month),
      `the from-bound is the oldest month (${month} ∉ "${card.windowLabel}")`
    );
  }
  const todayIso = new Date().toISOString().slice(0, 10);
  if (dates[0] && dates[0] >= todayIso) {
    assert.match(card.windowLabel, /today$/, "an open window ends at 'today'");
  }
});

test("the homepage sources the card from the archive builder, not a private window", () => {
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  const page = readFileSync(
    require("node:path").join(process.cwd(), "app/[locale]/page.tsx"),
    "utf8"
  );
  assert.match(page, /buildVerifiedRecordCard\(/);
  assert.doesNotMatch(
    page,
    /buildHomepageTrustModel/,
    "the 3-day trust-window aggregate no longer feeds the reader-facing card"
  );
});
