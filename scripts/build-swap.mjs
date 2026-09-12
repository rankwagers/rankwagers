/**
 * Atomic production build (`npm run build`).
 *
 * Incident class this prevents: the old build script deleted `.next` up front
 * and built straight into it — a failed build left the running server with a
 * missing or half-written `.next`. Twice.
 *
 * Mechanism:
 *   1. Run scripts/prepare-dev.mjs exactly like the old build chain did
 *      (SITE_URL guard + stale-output heuristics; lifecycle forced to "build"
 *      so the guard fires even when this script is invoked with plain `node`).
 *   2. Purge any `.next-build` candidate left by a previously crashed run.
 *   3. `next build` with NEXT_DIST_DIR=.next-build (see distDir in
 *      next.config.js) — the live `.next` is never touched while building.
 *   4. On SUCCESS only: `.next` -> `.next.old`, `.next-build` -> `.next`
 *      (fs.renameSync — same filesystem, atomic), then remove `.next.old`
 *      (best-effort; a leftover `.next.old` is safe to delete manually).
 *   5. On FAILURE: exit non-zero, remove the `.next-build` scrap, and leave
 *      the existing `.next` untouched.
 */
import { existsSync, rmSync, renameSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = process.cwd();
const CANDIDATE = ".next-build";
const LIVE = ".next";
const OLD = ".next.old";
const candidatePath = path.join(root, CANDIDATE);
const livePath = path.join(root, LIVE);
const oldPath = path.join(root, OLD);

function step(msg) {
  console.log(`[build-swap] ${msg}`);
}

// 1. Guard + stale-output heuristics — same entry point the old
//    `npm run build` chain used.
const prepare = spawnSync(
  process.execPath,
  [path.join(root, "scripts", "prepare-dev.mjs")],
  {
    stdio: "inherit",
    env: { ...process.env, npm_lifecycle_event: "build" },
  }
);
if (prepare.status !== 0) {
  step(`prepare-dev failed (exit ${prepare.status ?? "?"}) — existing ${LIVE} untouched.`);
  process.exit(prepare.status ?? 1);
}

// 2. A previous crashed run may have left a candidate behind — it is scrap.
if (existsSync(candidatePath)) {
  rmSync(candidatePath, { recursive: true, force: true });
  step(`removed stale candidate ${CANDIDATE} from a previous run.`);
}

// 3. Build into the candidate; the live .next stays untouched throughout.
step(`building into candidate ${CANDIDATE} (NEXT_DIST_DIR=${CANDIDATE}).`);
const nextBin = fileURLToPath(
  new URL("../node_modules/next/dist/bin/next", import.meta.url)
);
const build = spawnSync(process.execPath, [nextBin, "build"], {
  stdio: "inherit",
  env: { ...process.env, NEXT_DIST_DIR: CANDIDATE },
});

if (build.status !== 0) {
  rmSync(candidatePath, { recursive: true, force: true });
  step(`build FAILED (exit ${build.status ?? "?"}) — removed ${CANDIDATE} scrap; existing ${LIVE} untouched.`);
  process.exit(build.status ?? 1);
}

// 4. Success — atomic swap via rename (same filesystem).
rmSync(oldPath, { recursive: true, force: true });
if (existsSync(livePath)) {
  renameSync(livePath, oldPath);
  step(`renamed ${LIVE} -> ${OLD}.`);
}
renameSync(candidatePath, livePath);
step(`renamed ${CANDIDATE} -> ${LIVE} — new build is live.`);

try {
  rmSync(oldPath, { recursive: true, force: true });
  step(`removed ${OLD}.`);
} catch (err) {
  step(`could not remove ${OLD} (${err?.message ?? err}) — leaving it; safe to delete manually.`);
}

step("done.");
