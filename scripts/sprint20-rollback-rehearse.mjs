/**
 * Local artifact rollback rehearsal (no PM2 / no remote server).
 * Mirrors lib/ops/releaseLayout switch/rollback semantics.
 *
 * Writes docs/sprint-20-rollback-rehearsal.generated.json
 */
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

const outPath = path.join(
  process.cwd(),
  "docs",
  "sprint-20-rollback-rehearsal.generated.json"
);

function writeRelease(root, releaseId) {
  const dir = path.join(root, "releases", releaseId);
  mkdirSync(path.join(dir, ".next"), { recursive: true });
  writeFileSync(
    path.join(dir, "release.json"),
    JSON.stringify(
      { releaseId, createdAt: new Date().toISOString(), retention: 5 },
      null,
      2
    )
  );
  writeFileSync(path.join(dir, ".next", "BUILD_ID"), releaseId);
}

function switchCurrent(root, releaseId) {
  const current = path.join(root, "current");
  const previous = path.join(root, "previous");
  let prev = null;
  if (existsSync(current)) {
    prev = readFileSync(current, "utf8").trim();
    if (prev && prev !== releaseId) writeFileSync(previous, prev, "utf8");
  }
  writeFileSync(current, releaseId, "utf8");
  return { current: releaseId, previous: prev };
}

function rollbackToPrevious(root) {
  const current = path.join(root, "current");
  const previous = path.join(root, "previous");
  if (!existsSync(previous)) throw new Error("previous_missing");
  const prev = readFileSync(previous, "utf8").trim();
  const cur = existsSync(current) ? readFileSync(current, "utf8").trim() : "";
  if (!prev || !existsSync(path.join(root, "releases", prev))) {
    throw new Error("previous_invalid");
  }
  writeFileSync(current, prev, "utf8");
  if (cur) writeFileSync(previous, cur, "utf8");
  return { current: prev, previous: cur || null };
}

const started = Date.now();
const tmp = mkdtempSync(path.join(os.tmpdir(), "rw-rollback-"));
let ok = false;
let error = null;
let detail = null;

try {
  mkdirSync(path.join(tmp, "shared", "logs"), { recursive: true });
  writeRelease(tmp, "rel-a-old");
  writeRelease(tmp, "rel-b-new");
  switchCurrent(tmp, "rel-a-old");
  const switched = switchCurrent(tmp, "rel-b-new");
  const rolled = rollbackToPrevious(tmp);
  if (rolled.current !== "rel-a-old") {
    throw new Error(`expected current rel-a-old, got ${rolled.current}`);
  }
  ok = true;
  detail = {
    switched,
    rolled,
    elapsedMs: Date.now() - started,
    note: "Filesystem layout rehearsal only — run scripts/rollback-release.sh on the server for PM2/live proof",
  };
} catch (err) {
  error = err instanceof Error ? err.message : String(err);
} finally {
  try {
    rmSync(tmp, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

const report = {
  ok,
  generatedAt: new Date().toISOString(),
  elapsedMs: Date.now() - started,
  error,
  detail,
};
mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ok, outPath, error }));
process.exit(ok ? 0 : 1);
