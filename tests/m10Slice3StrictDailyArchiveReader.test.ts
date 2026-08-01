/**
 * M10 Stage 2E — Slice 3 — Strict Daily-Archive Reader test suite.
 *
 * Hermetic, deterministic, platform-safe. Proves the frozen strict-reader contract
 * (absent→null; fault→throw; valid non-array object→return) WITHOUT touching production
 * `data/daily-archives`, without `process.chdir`, without mutating process-wide paths, and
 * without `saveDailyArchive`. Every case writes static fixtures into an isolated `mkdtemp`
 * directory and cleans it up deterministically. Two static source assertions prove (a) the
 * fail-open `readDailyArchive` is behaviourally unchanged and (b) `readDailyArchiveStrict` has
 * zero production callers (dormancy). No network, no database. Injected `archiveDir` only.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { readDailyArchiveStrict, type DailyArchive } from "../lib/footystats/dailyArchive";

const DATE = "2026-08-01";

/** A static, deterministic, structurally-complete DailyArchive fixture (no clock, no random). */
const VALID_ARCHIVE: DailyArchive = {
  date: DATE,
  savedAt: "2026-08-01T18:00:00.000Z",
  summary: {
    fh: { total: 0, won: 0, lost: 0, pending: 0, postponed: 0 },
    over15: { total: 0, won: 0, lost: 0, pending: 0, postponed: 0 },
    over25: { total: 0, won: 0, lost: 0, pending: 0, postponed: 0 },
    sh: { total: 0, won: 0, lost: 0, pending: 0, postponed: 0 },
  },
  fh: [],
  over15: [],
  over25: [],
  sh: [],
};

/** Run `fn` against a fresh isolated temp archive dir; always clean up. */
async function withTempArchive(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = mkdtempSync(path.join(os.tmpdir(), "m10-slice3-strict-"));
  try {
    assert.ok(dir.startsWith(os.tmpdir()), "temp archive dir must be under the OS temp root");
    await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Write a raw fixture file for `date` into `dir` (never production). */
function writeRaw(dir: string, date: string, contents: string): void {
  writeFileSync(path.join(dir, `${date}.json`), contents, "utf8");
}

// ── 1. Valid synthetic archive object returns the expected object ──────────────────────────
test("1: valid archive object → returns the parsed object", async () => {
  await withTempArchive(async (dir) => {
    writeRaw(dir, DATE, JSON.stringify(VALID_ARCHIVE));
    const result = await readDailyArchiveStrict(DATE, dir);
    assert.deepEqual(result, VALID_ARCHIVE);
  });
});

// ── 2. Missing file / ENOENT returns null ───────────────────────────────────────────────────
test("2: absent partition (ENOENT) → resolves null", async () => {
  await withTempArchive(async (dir) => {
    const result = await readDailyArchiveStrict("1999-01-01", dir); // no file written
    assert.equal(result, null);
  });
});

// ── 3. Malformed JSON throws ────────────────────────────────────────────────────────────────
test("3: malformed JSON → throws (parse fault)", async () => {
  await withTempArchive(async (dir) => {
    writeRaw(dir, DATE, "{ this is not valid json");
    await assert.rejects(() => readDailyArchiveStrict(DATE, dir));
  });
});

// ── 4. Empty file throws ────────────────────────────────────────────────────────────────────
test("4: empty file → throws (empty string fails JSON.parse)", async () => {
  await withTempArchive(async (dir) => {
    writeRaw(dir, DATE, "");
    await assert.rejects(() => readDailyArchiveStrict(DATE, dir));
  });
});

// ── 5. Parsed null throws ───────────────────────────────────────────────────────────────────
test("5: JSON null → throws", async () => {
  await withTempArchive(async (dir) => {
    writeRaw(dir, DATE, "null");
    await assert.rejects(() => readDailyArchiveStrict(DATE, dir));
  });
});

// ── 6. Parsed primitive throws (number/string/boolean — full predicate coverage) ────────────
// The predicate rejects every non-object via `typeof parsed !== "object"`; all three JSON
// primitive kinds are exercised here so the primitive branch is fully covered, not just one.
test("6: JSON primitives (number, string, boolean) → throw", async () => {
  await withTempArchive(async (dir) => {
    for (const primitive of ["42", '"a string"', "true"]) {
      writeRaw(dir, DATE, primitive);
      await assert.rejects(
        () => readDailyArchiveStrict(DATE, dir),
        `primitive ${primitive} must throw`
      );
    }
  });
});

// ── 7. Parsed array throws ──────────────────────────────────────────────────────────────────
test("7: JSON array → throws (Array.isArray rejected)", async () => {
  await withTempArchive(async (dir) => {
    for (const arr of ["[]", "[1,2,3]"]) {
      writeRaw(dir, DATE, arr);
      await assert.rejects(() => readDailyArchiveStrict(DATE, dir), `array ${arr} must throw`);
    }
  });
});

// ── 8. Non-array object returns even when NOT deeply schema-valid (deep validation deferred) ─
test("8: non-array object returns as-is (no deep schema validation in Slice 3)", async () => {
  await withTempArchive(async (dir) => {
    const notDeeplyValid = { foo: "bar" }; // missing every DailyArchive field
    writeRaw(dir, DATE, JSON.stringify(notDeeplyValid));
    const result = await readDailyArchiveStrict(DATE, dir);
    // Returned verbatim — proves the reader does NOT validate DailyArchive fields.
    assert.deepEqual(result as unknown, notDeeplyValid);
  });
});

// ── 9. Portable non-ENOENT filesystem fault throws (EISDIR via a directory at the path) ─────
test("9: non-ENOENT fs fault (EISDIR) → throws", async () => {
  await withTempArchive(async (dir) => {
    mkdirSync(path.join(dir, `${DATE}.json`)); // a directory where the file is expected
    await assert.rejects(() => readDailyArchiveStrict(DATE, dir));
  });
});

// ── 10. Parse-fault and IO-fault paths are independently proven (distinct causes) ───────────
test("10: parse-fault vs IO-fault are independent code paths with distinct causes", async () => {
  await withTempArchive(async (dir) => {
    // Parse fault: malformed JSON → cause is a SyntaxError from JSON.parse.
    writeRaw(dir, "parsefault", "{ nope");
    const parseErr = await readDailyArchiveStrict("parsefault", dir).then(
      () => null,
      (e) => e as Error
    );
    assert.ok(parseErr, "parse fault must throw");
    assert.ok(parseErr!.cause instanceof SyntaxError, "parse fault preserves the JSON SyntaxError as cause");

    // IO fault: EISDIR → cause is an errno with code EISDIR (different path).
    mkdirSync(path.join(dir, "iofault.json"));
    const ioErr = await readDailyArchiveStrict("iofault", dir).then(
      () => null,
      (e) => e as Error
    );
    assert.ok(ioErr, "IO fault must throw");
    assert.equal((ioErr!.cause as NodeJS.ErrnoException | undefined)?.code, "EISDIR", "IO fault preserves EISDIR code");
  });
});

// ── 11. Existing fail-open readDailyArchive behaviour is unchanged (static source regression) ─
// The fail-open reader uses the module-level ARCHIVE_DIR and cannot accept an injected dir; the
// frozen plan forbids widening its signature and forbids process.chdir. Its unchanged behaviour
// is therefore proven by a static source assertion on its exact body (the bare fail-open catch).
test("11: fail-open readDailyArchive body is byte-unchanged (bare catch → return null)", () => {
  const src = readFileSync(path.join(process.cwd(), "lib/footystats/dailyArchive.ts"), "utf8");
  const start = src.indexOf("export async function readDailyArchive(date: string)");
  // End at the strict reader's JSDoc (the next `/**` after the fail-open signature) so the
  // slice is ONLY the fail-open function body — not the strict reader's doc/impl.
  const end = src.indexOf("/**", start);
  const strictAt = src.indexOf("export async function readDailyArchiveStrict(");
  assert.ok(start >= 0 && end > start && strictAt > end, "both readers must be present in order");
  const failOpenBody = src.slice(start, end);
  assert.match(failOpenBody, /const file = path\.join\(ARCHIVE_DIR, `\$\{date\}\.json`\);/);
  assert.match(failOpenBody, /const raw = await fs\.readFile\(file, "utf-8"\);/);
  assert.match(failOpenBody, /return JSON\.parse\(raw\) as DailyArchive;/);
  assert.match(failOpenBody, /\}\s*catch\s*\{\s*return null;\s*\}/);
  // Prove it was NOT accidentally converted to the strict variant.
  assert.doesNotMatch(failOpenBody, /ENOENT/);
  assert.doesNotMatch(failOpenBody, /archiveDir/);
});

// ── 12. Same malformed content → deliberate semantic contrast (fail-open null vs strict throw) ─
// Strict side: exercised for real hermetically. Fail-open side: proven via the case-11 static
// source regression (its bare catch returns null for ANY read/parse fault, incl. this content),
// because the fail-open reader cannot be pointed at a temp dir without an unauthorized signature
// widening or a forbidden process.chdir. This is the frozen plan's authorized fallback.
test("12: malformed content — strict throws (fail-open would return null; see case 11)", async () => {
  await withTempArchive(async (dir) => {
    const malformed = "{ not: valid json ]";
    writeRaw(dir, DATE, malformed);
    await assert.rejects(() => readDailyArchiveStrict(DATE, dir), "strict reader throws on malformed content");
    // Fail-open contrast: readDailyArchive's bare `catch { return null }` (asserted unchanged in
    // case 11) collapses this exact fault class to `null` — the deliberate opposite semantic.
    const src = readFileSync(path.join(process.cwd(), "lib/footystats/dailyArchive.ts"), "utf8");
    const foStart = src.indexOf("export async function readDailyArchive(date: string)");
    const failOpen = src.slice(foStart, src.indexOf("/**", foStart));
    assert.match(failOpen, /\}\s*catch\s*\{\s*return null;\s*\}/, "fail-open collapses the same fault to null");
  });
});

// ── 13. Fault error preserves the original error as cause where applicable ───────────────────
test("13: parse-fault throw preserves the original error as cause", async () => {
  await withTempArchive(async (dir) => {
    writeRaw(dir, DATE, "{ broken");
    const err = await readDailyArchiveStrict(DATE, dir).then(() => null, (e) => e as Error);
    assert.ok(err, "must throw");
    assert.ok(err!.cause instanceof Error, "original error preserved as cause");
  });
});

// ── 14. Filesystem code remains recoverable through cause on the EISDIR path ─────────────────
test("14: EISDIR fault exposes the fs code through cause", async () => {
  await withTempArchive(async (dir) => {
    mkdirSync(path.join(dir, `${DATE}.json`));
    const err = await readDailyArchiveStrict(DATE, dir).then(() => null, (e) => e as Error);
    assert.ok(err, "must throw");
    assert.equal((err!.cause as NodeJS.ErrnoException | undefined)?.code, "EISDIR");
  });
});

// ── 15. Strict reader has ZERO production callers (deterministic static dormancy proof) ───────
// RF-1: the guard scans ALL relevant production/operations TypeScript surfaces, not just lib/+app/.
//
// Scanned production/operational source roots (only when present):
//   lib/, app/, components/, scripts/, db/  — core app + operational source. `scripts/` is included
//   because it is operational source (bench harness, release/ops scripts), even though the project
//   tsconfig excludes it from typecheck; `db/` currently holds only SQL migrations (no .ts) but is
//   scanned so a future `db/*.ts` caller would be caught.
// Scanned root-level production entrypoints (only when present): middleware.ts, instrumentation.ts.
// Source extensions: .ts .tsx .mts .cts (the repo's TypeScript source forms); .d.ts excluded
//   (declaration files cannot contain a runtime caller).
// NOT scanned: tests/ (incl. this file), docs/, node_modules/, .next/, coverage/build output, and
//   the separate excluded sub-projects (aff-panel/, telegram-*/, design/, marketingskills/) — none
//   is core production/operational source of this app. tailwind.config.ts (build config) and
//   next-env.d.ts (declaration) are not production caller surfaces. The defining module is excluded
//   by resolved absolute path; the symbol may legitimately appear only there, in this test, and docs.
const SYMBOL = "readDailyArchiveStrict";
const SOURCE_EXT = /\.(ts|tsx|mts|cts)$/;
const DEFINING_MODULE = path.resolve(process.cwd(), "lib/footystats/dailyArchive.ts");
const PRODUCTION_ROOTS = ["lib", "app", "components", "scripts", "db"];
const ROOT_ENTRYPOINTS = ["middleware.ts", "instrumentation.ts"];

/** Collect every production/operational TypeScript source file (absolute paths), deterministically. */
function collectProductionSources(): string[] {
  const files: string[] = [];
  for (const root of PRODUCTION_ROOTS) {
    const rootAbs = path.join(process.cwd(), root);
    if (!existsSync(rootAbs)) continue; // scan a root only when it exists
    for (const rel of readdirSync(rootAbs, { recursive: true }) as string[]) {
      const abs = path.join(rootAbs, rel);
      if (!SOURCE_EXT.test(abs) || abs.endsWith(".d.ts")) continue;
      files.push(abs);
    }
  }
  for (const entry of ROOT_ENTRYPOINTS) {
    const abs = path.join(process.cwd(), entry);
    if (existsSync(abs) && SOURCE_EXT.test(abs) && !abs.endsWith(".d.ts")) files.push(abs);
  }
  return files;
}

test("15: readDailyArchiveStrict has zero production callers (dormancy — RF-1 broadened)", () => {
  const offenders: string[] = [];
  for (const abs of collectProductionSources()) {
    if (path.resolve(abs) === DEFINING_MODULE) continue; // the definition itself is allowed
    let contents: string;
    try {
      contents = readFileSync(abs, "utf8");
    } catch {
      continue; // a directory entry matched by suffix filter, or a transient unreadable path
    }
    if (contents.includes(SYMBOL)) offenders.push(path.relative(process.cwd(), abs));
  }
  offenders.sort(); // deterministic ordering before assertion
  assert.deepEqual(
    offenders,
    [],
    `readDailyArchiveStrict must have zero production callers; found in: ${offenders.join(", ")}`
  );
});

// ── 16. No artifact leaks outside temporary directories ─────────────────────────────────────
test("16: fixtures never leak outside the temp dir (isolated + cleaned)", async () => {
  let capturedDir = "";
  await withTempArchive(async (dir) => {
    capturedDir = dir;
    writeRaw(dir, DATE, JSON.stringify(VALID_ARCHIVE));
    assert.ok(existsSync(path.join(dir, `${DATE}.json`)), "fixture is inside the temp dir");
    // Never wrote into the production archive dir for our synthetic dates.
    const prodFile = path.join(process.cwd(), "data", "daily-archives", `${DATE}.json`);
    assert.ok(path.resolve(dir) !== path.dirname(prodFile), "temp dir is not the production archive dir");
  });
  assert.equal(existsSync(capturedDir), false, "temp dir is removed on cleanup — no leak");
});

// ── 17. Deterministic & platform-safe (no clock, no random; repeated reads are identical) ────
test("17: deterministic — repeated reads of a static fixture are identical", async () => {
  await withTempArchive(async (dir) => {
    writeRaw(dir, DATE, JSON.stringify(VALID_ARCHIVE));
    const a = await readDailyArchiveStrict(DATE, dir);
    const b = await readDailyArchiveStrict(DATE, dir);
    assert.deepEqual(a, b);
    assert.deepEqual(a, VALID_ARCHIVE);
  });
});
