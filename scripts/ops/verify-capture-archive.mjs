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

/** Read an NDJSON file, reporting unreadable lines rather than silently dropping them. */
function readNdjson(file) {
  if (!fs.existsSync(file)) return { rows: [], corrupt: 0, missing: true };
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split("\n").filter((l) => l.trim() !== "");
  const rows = [];
  let corrupt = 0;
  for (const line of lines) {
    try {
      rows.push(JSON.parse(line));
    } catch {
      corrupt += 1;
    }
  }
  return { rows, corrupt, missing: false };
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
if (snaps.corrupt || odds.corrupt || vals.corrupt) {
  console.log(`  UNPARSEABLE LINES: snapshots=${snaps.corrupt} odds=${odds.corrupt} validations=${vals.corrupt}`);
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
