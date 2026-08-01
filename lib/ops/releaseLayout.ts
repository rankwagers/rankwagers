/**
 * Release layout helpers — used by deploy scripts and unit tests.
 * Paths are relative to RW_ROOT.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

export type ReleaseMeta = {
  releaseId: string;
  createdAt: string;
  retention: number;
};

export function releasePaths(root: string) {
  return {
    root,
    releases: path.join(root, "releases"),
    current: path.join(root, "current"),
    previous: path.join(root, "previous"),
    shared: path.join(root, "shared"),
    sharedEnv: path.join(root, "shared", ".env"),
    logs: path.join(root, "shared", "logs"),
  };
}

export function ensureReleaseDirs(root: string): void {
  const p = releasePaths(root);
  mkdirSync(p.releases, { recursive: true });
  mkdirSync(p.logs, { recursive: true });
  mkdirSync(p.shared, { recursive: true });
}

/** Simulate atomic switch in a temp root (symlink or junction where available). */
export function switchCurrent(
  root: string,
  releaseId: string
): { current: string; previous: string | null } {
  const p = releasePaths(root);
  const target = path.join(p.releases, releaseId);
  if (!existsSync(target)) {
    throw new Error(`release_missing:${releaseId}`);
  }
  let previous: string | null = null;
  if (existsSync(p.current)) {
    const prevId = readFileSync(p.current, "utf8").trim();
    previous = prevId || null;
    if (previous && previous !== releaseId) {
      writeFileSync(p.previous, previous, "utf8");
    }
  }
  writeFileSync(p.current, releaseId, "utf8");
  return { current: releaseId, previous };
}

export function rollbackToPrevious(root: string): {
  current: string;
  previous: string | null;
} {
  const p = releasePaths(root);
  if (!existsSync(p.previous)) {
    throw new Error("previous_missing");
  }
  const prev = readFileSync(p.previous, "utf8").trim();
  const cur = existsSync(p.current) ? readFileSync(p.current, "utf8").trim() : "";
  if (!prev || !existsSync(path.join(p.releases, prev))) {
    throw new Error("previous_invalid");
  }
  writeFileSync(p.current, prev, "utf8");
  if (cur) writeFileSync(p.previous, cur, "utf8");
  return { current: prev, previous: cur || null };
}

export function pruneReleases(root: string, retention: number): string[] {
  const p = releasePaths(root);
  const current = existsSync(p.current) ? readFileSync(p.current, "utf8").trim() : "";
  const previous = existsSync(p.previous) ? readFileSync(p.previous, "utf8").trim() : "";
  const ids = readdirSync(p.releases).sort();
  const keep = new Set([current, previous].filter(Boolean));
  const removed: string[] = [];
  for (const id of ids) {
    if (keep.has(id)) continue;
    const nonKeep = ids.filter((x) => !keep.has(x));
    if (nonKeep.length <= retention) break;
    if (id === nonKeep[0]) {
      rmSync(path.join(p.releases, id), { recursive: true, force: true });
      removed.push(id);
    }
  }
  return removed;
}

export function writeReleaseMeta(root: string, meta: ReleaseMeta): void {
  const dir = path.join(releasePaths(root).releases, meta.releaseId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "release.json"), JSON.stringify(meta, null, 2));
  // sentinel for "built artifact"
  mkdirSync(path.join(dir, ".next"), { recursive: true });
  writeFileSync(path.join(dir, ".next", "BUILD_ID"), meta.releaseId);
}
