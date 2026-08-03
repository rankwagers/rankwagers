import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildProofBandFigures, type ProofBandCopy } from "../lib/homepage/proofBand";
import { predictionsEn } from "../lib/translations/predictionsEn";
import type { HomepageVerifiedPerformance } from "../lib/homepage/types";

const root = path.join(__dirname, "..");

/**
 * S2 — the proof band.
 *
 * Two properties are protected here. First, that a figure the record cannot state is omitted
 * rather than rendered as a zero or a dash. Second, that no sentence reaches the page unless a
 * field produced it — the rule the removed ROI, average odds, "since 2020" and "rolling 12 months"
 * all failed.
 */

/** The real copy, so a test cannot pass against wording the page does not use. */
const COPY: ProofBandCopy = {
  published: predictionsEn.verifiedPublished,
  settled: predictionsEn.verifiedSettled,
  hitRate: predictionsEn.verifiedHitRateShort,
  open: predictionsEn.verifiedOpen,
  wonLost: predictionsEn.verifiedWonLost,
  stillOpen: predictionsEn.verifiedStillOpen,
};

function verified(
  over: Partial<HomepageVerifiedPerformance> = {}
): HomepageVerifiedPerformance {
  return {
    availability: "available",
    windowLabel: "Settled archive, 1 June – 2 August 2026",
    lastUpdatedAt: "2026-08-02T00:00:00.000Z",
    totalPredictions: 412,
    settledPredictions: 388,
    pendingPredictions: 20,
    voidPredictions: 4,
    won: 226,
    lost: 162,
    hitRatePct: 58,
    sampleNote: "Counts cover qualified goal-market lists only.",
    methodologyHref: "/en/methodology",
    archiveEntryHref: "/en/archive",
    ...over,
  };
}

/* ------------------------------------------------------------------ *
 * hitRatePct null — omitted, never zero, never a dash
 * ------------------------------------------------------------------ */

test("a null hit rate omits the figure entirely", () => {
  const figures = buildProofBandFigures(verified({ hitRatePct: null }), COPY);

  assert.equal(
    figures.find((figure) => figure.key === "hitRate"),
    undefined
  );
  assert.deepEqual(
    figures.map((figure) => figure.key),
    ["published", "settled", "open"]
  );
});

test("a null hit rate never renders as zero, a dash or the word null", () => {
  const figures = buildProofBandFigures(
    verified({ hitRatePct: null, settledPredictions: 0, won: 0, lost: 0 }),
    COPY
  );

  const emitted = figures.flatMap((figure) => [figure.value, figure.note, figure.audit]);
  for (const forbidden of ["0%", "—", "-", "null", "undefined", "NaN%"]) {
    assert.ok(
      !emitted.includes(forbidden),
      `a null hit rate must not surface as ${JSON.stringify(forbidden)}`
    );
  }
});

test("a hit rate of zero is a real reading and IS rendered", () => {
  // 0% is a measured rate — a record that settled and lost everything. Only null is absence.
  const figures = buildProofBandFigures(verified({ hitRatePct: 0 }), COPY);
  const hitRate = figures.find((figure) => figure.key === "hitRate");

  assert.ok(hitRate);
  assert.equal(hitRate.value, "0%");
});

test("the window label travels with the hit rate it qualifies", () => {
  const model = verified();
  const withRate = buildProofBandFigures(model, COPY);
  assert.equal(
    withRate.find((figure) => figure.key === "hitRate")?.note,
    model.windowLabel
  );

  // Absent rate, absent qualifier — the label describes nothing on its own.
  const withoutRate = buildProofBandFigures(verified({ hitRatePct: null }), COPY);
  const emitted = withoutRate.flatMap((figure) => [figure.value, figure.note, figure.audit]);
  assert.ok(!emitted.includes(model.windowLabel));
});

/* ------------------------------------------------------------------ *
 * Every emitted string traces to a field
 * ------------------------------------------------------------------ */

test("all four figures read their value from HomepageVerifiedPerformance", () => {
  const model = verified();
  const figures = buildProofBandFigures(model, COPY);
  const value = (key: string) => figures.find((figure) => figure.key === key)?.value;

  assert.equal(value("published"), String(model.totalPredictions));
  assert.equal(value("settled"), String(model.settledPredictions));
  assert.equal(value("hitRate"), `${model.hitRatePct}%`);
  assert.equal(value("open"), String(model.pendingPredictions));
});

test("the loss is stated in the always-visible note, never behind the hover reveal", () => {
  const model = verified();
  const settled = buildProofBandFigures(model, COPY).find((figure) => figure.key === "settled");

  assert.ok(settled);
  assert.ok(settled.note?.includes(String(model.lost)));
  assert.ok(settled.note?.includes(String(model.won)));
  // The audit is aria-hidden and pointer-gated, so it may never be the only place a loss appears.
  assert.ok(!settled.audit?.includes(String(model.lost)));
});

test("the hover reveal only ever repeats a figure stated elsewhere on the band", () => {
  const model = verified();
  const figures = buildProofBandFigures(model, COPY);
  const settled = figures.find((figure) => figure.key === "settled");
  const open = figures.find((figure) => figure.key === "open");

  assert.ok(settled?.audit?.includes(String(model.pendingPredictions)));
  assert.equal(open?.value, String(model.pendingPredictions));
});

test("no unsourced figure or window reaches the band", () => {
  const figures = buildProofBandFigures(verified(), COPY);
  const rendered = figures
    .flatMap((figure) => [figure.label, figure.value, figure.note, figure.audit])
    .filter(Boolean)
    .join(" | ")
    .toLowerCase();

  // Each of these needs a field the product does not carry (rwbible §3.2).
  for (const forbidden of [
    "roi",
    "average odds",
    "since 2020",
    "rolling 12 months",
    "closing price",
    "worst month",
    "level stakes",
    "european league",
  ]) {
    assert.ok(!rendered.includes(forbidden), `"${forbidden}" has no source and must not render`);
  }
});

test("every template placeholder is substituted, never printed raw", () => {
  const figures = buildProofBandFigures(verified(), COPY);
  for (const figure of figures) {
    for (const value of [figure.label, figure.value, figure.note, figure.audit]) {
      if (!value) continue;
      assert.ok(!/\{[a-z]+\}/i.test(value), `unsubstituted placeholder in ${JSON.stringify(value)}`);
    }
  }
});

/* ------------------------------------------------------------------ *
 * Source guards — the band's markup and copy
 * ------------------------------------------------------------------ */

/**
 * Comments are stripped before matching. Explaining why a figure was removed is worth keeping in
 * the source; the guard is about what can reach a reader, not about what the file may discuss.
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("the removed figures are absent from the homepage code and its copy", () => {
  const home = withoutComments(
    readFileSync(path.join(root, "components/bible/RankWagersHome.tsx"), "utf8")
  );
  const copy = withoutComments(
    readFileSync(path.join(root, "lib/translations/predictionsEn.ts"), "utf8")
  );

  for (const forbidden of [/Average odds/i, /Since 2020/i, /Rolling 12 months/i, /closing price/i]) {
    assert.doesNotMatch(home, forbidden);
    assert.doesNotMatch(copy, forbidden);
  }

  // And the guard itself is honest: the prose it ignores really is still in the file.
  const raw = readFileSync(path.join(root, "components/bible/RankWagersHome.tsx"), "utf8");
  assert.match(raw, /average odds/i);
});

test("S2 carries no state colour", () => {
  const home = readFileSync(path.join(root, "components/bible/RankWagersHome.tsx"), "utf8");

  // The band is the record, and the brief assigns grey to Historical. The won/lost dots, the
  // proportional rule and the form strip all read from the hero's ink ramp now.
  for (const token of ["--status-won-fg", "--status-lost-fg"]) {
    assert.ok(!home.includes(token), `${token} must not appear in the proof band`);
  }
});

test("S2 renders inside the hero scope rather than duplicating its tokens", () => {
  const home = readFileSync(path.join(root, "components/bible/RankWagersHome.tsx"), "utf8");
  const css = readFileSync(path.join(root, "app/globals.css"), "utf8");

  assert.match(home, /id="verified-performance"[\s\S]{0,400}rw-hero/);
  // One declaration of the ramp, in one place.
  assert.equal((css.match(/--hero-ink-3:/g) ?? []).length, 1);
  assert.match(css, /--hero-ink-3: #6b6f78/);

  // The prototype's ink may be named in the note that records why it was replaced; it may never
  // be the value of a token.
  assert.doesNotMatch(withoutComments(css), /#82868f/i);
});
