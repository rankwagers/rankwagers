import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * V3 POLISH — group 5's truth pins. The "By rate" order IS the engine's
 * reliability weighting, and a small sample can never top a list. The
 * builders run against live provider state, so the LAW is pinned at source
 * level: the formula, the n<5 flag, and the bucket ordering that puts
 * small-sample rows behind every reliable one.
 */

const root = process.cwd();
const SRC = (rel: string) => readFileSync(path.join(root, rel), "utf8");

test("the table's weighted score is |rate−baseline|×n/(n+5), both halves real", () => {
  const src = SRC("lib/v3/homeTable.server.ts");
  assert.match(src, /Math\.abs\(paired\.ratePct - baselinePct\) \/ 100\) \* \(played \/ \(played \+ 5\)\)/);
  assert.match(src, /Number\.isFinite\(baselinePct\)/, "no baseline → score 0, never a stand-in");
  assert.match(src, /smallSample: paired\.ratePct !== null && played > 0 && played < 5/);
});

test("small-sample rows can never top the table's weighted order", () => {
  const src = SRC("lib/v3/homeTable.server.ts");
  assert.match(
    src,
    /row\.ratePct === null \? 2 : row\.smallSample \? 1 : 0/,
    "bucket order: reliable, then small-sample, then unscorable"
  );
  assert.match(src, /bucket\(a\) - bucket\(b\) \|\|\s*b\.weightedScore - a\.weightedScore/);
});

test("the high-potential rail weights against the archive's own overall rate", () => {
  const src = SRC("lib/v3/homeRails.server.ts");
  assert.match(src, /loadOverallRecord/, "the baseline is the whole archive's settled rate");
  assert.match(src, /\(n \/ \(n \+ 5\)\)/);
  assert.match(
    src,
    /Number\(a\.smallSample\) - Number\(b\.smallSample\) \|\|/,
    "small-sample markets sort behind every n≥5 market"
  );
  assert.match(src, /record\.won \+ record\.lost < 5/);
});

test("the band auto-fill already rides the engine's weighted score (no second scorer)", () => {
  const src = SRC("lib/v3/editorPicks.server.ts");
  assert.match(src, /scored\.sort\(\(a, b\) => b\.lead\.score - a\.lead\.score\)/);
  // The engine's score IS |rate−baseline|×reliability with a 5-sample floor
  // (lib/fixtureSignals) — pinned there; here we pin that the band uses it.
  const engine = SRC("lib/fixtureSignals.ts");
  assert.match(engine, /n\/\(n\+5\)|sample \/ \(sample \+ 5\)|reliability/i);
});

test("the reader is told: small samples render muted with the label", () => {
  for (const rel of [
    "components/v3/home/PredictionTable.tsx",
    "components/v3/rails/RightRail.tsx",
  ]) {
    const src = SRC(rel);
    assert.match(src, /smallSample/, `${rel} carries the flag`);
    assert.match(src, /strings\.smallSample/, `${rel} renders the dictionary label`);
    assert.match(src, /var\(--muted\)/, `${rel} mutes the small-sample pct`);
  }
});
