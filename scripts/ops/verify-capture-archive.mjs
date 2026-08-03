#!/usr/bin/env node
/**
 * Read-only report on the PRODUCTION evidence archive.
 *
 * Reads the durable NDJSON directly — no imports from the app, no writes, no provider calls, no
 * credentials. Safe to run at any time, including while capture is firing.
 *
 * Usage:
 *   node scripts/ops/verify-capture-archive.mjs [--dir <path>] [--since <ISO>]
 *
 * Defaults to /opt/rankwagers/shared/evidence-archive, the path `resolveEvidenceArchiveDir`
 * returns when NODE_ENV=production and EVIDENCE_ARCHIVE_DIR is unset.
 */
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const argOf = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};

const DIR = argOf("--dir") ?? "/opt/rankwagers/shared/evidence-archive";
const SINCE = argOf("--since");

/**
 * Read an NDJSON file, reporting unreadable lines rather than silently dropping them.
 *
 * Distinguishes the two cases the readers treat differently:
 *   torn     the final line is truncated and the file does not end in a newline — the
 *            signature of an append interrupted by SIGKILL (§3.11). Tolerated by the readers.
 *   corrupt  any other unparseable line. A second one of these makes the archive throw.
 */
function readNdjson(file) {
  if (!fs.existsSync(file)) return { rows: [], corrupt: [], torn: [], missing: true };
  const text = fs.readFileSync(file, "utf8");
  const endsWithNewline = text.endsWith("\n");
  const lines = text.split("\n");
  const rows = [];
  const corrupt = [];
  const torn = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "") continue;
    try {
      rows.push(JSON.parse(lines[i]));
    } catch {
      const isTrailingFragment = i === lines.length - 1 && !endsWithNewline;
      (isTrailingFragment ? torn : corrupt).push(i + 1);
    }
  }
  return { rows, corrupt, torn, missing: false };
}

const snapFile = path.join(DIR, "snapshots.ndjson");
const oddsFile = path.join(DIR, "odds-archive", "records.ndjson");
const valFile = path.join(DIR, "validations.ndjson");

const snaps = readNdjson(snapFile);
const odds = readNdjson(oddsFile);
const vals = readNdjson(valFile);

console.log(`archive dir : ${DIR}`);
if (snaps.missing) {
  console.log("\nsnapshots.ndjson does not exist — capture has not written yet.");
  process.exit(0);
}

const inWindow = (r) => !SINCE || (r.capturedAt ?? "") >= SINCE;
const rows = snaps.rows.filter(inWindow);

console.log(`\nROWS WRITTEN`);
console.log(`  snapshots   ${rows.length}${SINCE ? ` (capturedAt >= ${SINCE})` : ""} of ${snaps.rows.length} total`);
console.log(`  odds        ${odds.rows.length}`);
console.log(`  validations ${vals.rows.length}`);
/* Torn vs corrupt is the whole point of reporting this: one torn line is survivable and
   expected after a hard restart; a second unparseable line of any kind makes the readers throw
   and stops capture until someone looks. Report both, always, so neither is inferred. */
const tornTotal = snaps.torn.length + odds.torn.length + vals.torn.length;
const corruptTotal = snaps.corrupt.length + odds.corrupt.length + vals.corrupt.length;
console.log(`\nLINE INTEGRITY`);
console.log(
  `  torn (truncated final line, tolerated)  ${tornTotal}` +
    (tornTotal
      ? `  [snapshots ${JSON.stringify(snaps.torn)} odds ${JSON.stringify(odds.torn)} validations ${JSON.stringify(vals.torn)}]`
      : "")
);
console.log(
  `  other unparseable lines                ${corruptTotal}` +
    (corruptTotal
      ? `  [snapshots ${JSON.stringify(snaps.corrupt)} odds ${JSON.stringify(odds.corrupt)} validations ${JSON.stringify(vals.corrupt)}]`
      : "")
);
for (const [label, f] of [["snapshots", snaps], ["odds", odds], ["validations", vals]]) {
  const unparseable = f.torn.length + f.corrupt.length;
  if (unparseable > 1) {
    console.log(`  *** ${label}: ${unparseable} unparseable lines — this file THROWS on read; capture is blocked ***`);
  }
}

/* Identity dedup: a repeated fire must not add a second row for the same content hash, and must
   never mint two different ids for one (fixtureId, sequence). Both are reported as counts so a
   non-zero value is unambiguous rather than something to eyeball. */
const byHash = new Map();
const bySeq = new Map();
for (const r of snaps.rows) {
  byHash.set(r.contentHash, (byHash.get(r.contentHash) ?? 0) + 1);
  const k = `${r.fixtureId}#${r.sequence}`;
  if (!bySeq.has(k)) bySeq.set(k, new Set());
  bySeq.get(k).add(r.id);
}
const dupHashes = [...byHash.values()].filter((n) => n > 1).length;
const forked = [...bySeq.entries()].filter(([, ids]) => ids.size > 1);

console.log(`\nIDENTITY`);
console.log(`  distinct content hashes     ${byHash.size} / ${snaps.rows.length} rows`);
console.log(`  hashes appearing more than once ${dupHashes}  ${dupHashes === 0 ? "(no duplicate rows)" : "*** DUPLICATE ROWS ***"}`);
console.log(`  (fixtureId,sequence) with >1 id ${forked.length}  ${forked.length === 0 ? "(identity stable)" : "*** IDENTITY FORK ***"}`);

const fixtures = new Set(rows.map((r) => r.fixtureId));
const qual = {};
for (const r of rows) qual[r.qualification] = (qual[r.qualification] ?? 0) + 1;

console.log(`\nCONTENT`);
console.log(`  distinct fixtures ${fixtures.size}`);
console.log(`  qualification     ${JSON.stringify(qual)}`);
const scores = rows.map((r) => r.evidenceScore).filter((n) => typeof n === "number").sort((a, b) => a - b);
if (scores.length) {
  const med = scores[Math.floor(scores.length / 2)];
  console.log(`  evidenceScore     min=${scores[0]} median=${med} max=${scores[scores.length - 1]}`);
}
const versions = new Set(rows.map((r) => r.modelVersion));
console.log(`  modelVersion      ${[...versions].join(", ") || "-"}`);

const latest = rows.map((r) => r.capturedAt).sort().slice(-1)[0];
console.log(`  most recent capturedAt ${latest ?? "-"}`);

console.log(`\nPER-FIXTURE`);
for (const r of rows.slice(-25)) {
  console.log(
    `  ${r.capturedAt}  fixture ${r.fixtureId} seq=${r.sequence} score=${r.evidenceScore} ` +
      `qual=${r.qualification} signals=${r.signals?.length ?? 0} markets=${r.supportedMarkets?.length ?? 0}`
  );
}
