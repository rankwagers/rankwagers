import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  acceptSameDayArchive,
  archiveAgeSeconds,
  countValidFixtures,
  loadSameDayArchiveFallback,
} from "../lib/footystats/archiveFallback";
import {
  getDailyListsServingState,
  noteDailyListsServing,
  resetDailyListsServingState,
} from "../lib/footystats/servingState";
import { mapDailyListsToQualifiedFixtures } from "../lib/research/qualifiedFixture";
import { archiveToDailyLists, type DailyArchive } from "../lib/footystats/dailyArchive";
import { predictionsEn } from "../lib/translations/predictionsEn";
import type { DailyMatchLists } from "../lib/footystats/types";

/**
 * Same-day archive fallback — incident 2026-08-01.
 *
 * Production served an empty homepage for 26 minutes while a valid archive holding 132 fixtures sat
 * on disk, because today's path substituted nothing when the provider failed. These tests pin the
 * contract that closes that gap, and equally pin the two things that must NOT change: a successful
 * empty day is never replaced, and historical dates never touch the provider.
 *
 * Every case is deterministic — real temp files, injected clock, no network, no provider call.
 */

const DATE = "2026-08-01";

function row(matchId: number, over: number) {
  return {
    matchId,
    homeTeam: `Home ${matchId}`,
    awayTeam: `Away ${matchId}`,
    competition: "Test League",
    country: "Testland",
    flag: "",
    kickoffTime: 1_785_570_000,
    kickoff: "12:00",
    over15Pct: over,
    fhOver05Pct: over,
    over25Pct: over,
    shOver05Pct: over,
    status: "complete",
    isLive: false,
    isFinished: true,
    homeScore: 2,
    awayScore: 1,
    minute: 90,
    highlightPct: over,
    listResult: "won" as const,
  };
}

function archive(overrides: Partial<DailyArchive> = {}): DailyArchive {
  return {
    date: DATE,
    savedAt: "2026-08-01T19:21:39.642Z",
    summary: {
      fh: { total: 1, won: 1, lost: 0, pending: 0, postponed: 0 },
      over15: { total: 1, won: 1, lost: 0, pending: 0, postponed: 0 },
      over25: { total: 1, won: 1, lost: 0, pending: 0, postponed: 0 },
      sh: { total: 1, won: 1, lost: 0, pending: 0, postponed: 0 },
    },
    fh: [row(101, 95)],
    over15: [row(102, 95)],
    over25: [row(103, 95)],
    sh: [row(104, 95)],
    ...overrides,
  } as DailyArchive;
}

/** Hermetic archive directory; returns its path. */
function withArchiveDir(fileName: string, contents: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), "rw-archive-"));
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, fileName), contents, "utf8");
  return dir;
}

/* ---------------------------------------------------------------- *
 * Provider-failure classification → fallback (cases 2–7)
 * ---------------------------------------------------------------- */

const FAILURE_CODES = [
  "circuit_open",
  "timeout",
  "network",
  "upstream_5xx",
  "unavailable",
  "quota_exhausted",
  "rate_limited",
  "unknown",
] as const;

for (const code of FAILURE_CODES) {
  test(`today + provider failure (${code}) uses the same-day archive`, async () => {
    const dir = withArchiveDir(`${DATE}.json`, JSON.stringify(archive()));
    try {
      const result = await loadSameDayArchiveFallback(DATE, code, {
        archiveDir: dir,
        nowMs: Date.parse("2026-08-01T19:45:00.000Z"),
      });
      assert.equal(result.used, true);
      if (!result.used) return;
      assert.equal(result.lists.provenance?.source, "stale_daily_archive");
      assert.equal(result.lists.provenance?.providerFailureReasonCode, code);
      assert.equal(result.lists.provenance?.requestedDate, DATE);
      assert.equal(result.lists.provenance?.archiveCapturedAt, "2026-08-01T19:21:39.642Z");
      assert.equal(result.lists.provenance?.archiveAgeSeconds, 1400);
      // The rows really arrive — this is the count the page renders from.
      const total =
        result.lists.fh.length +
        result.lists.over15.length +
        result.lists.over25.length +
        result.lists.sh.length;
      assert.equal(total, 4);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

/* ---------------------------------------------------------------- *
 * Archive acceptance (cases 8–11)
 * ---------------------------------------------------------------- */

test("malformed archive is rejected", async () => {
  const dir = withArchiveDir(`${DATE}.json`, "{ this is not json");
  try {
    const result = await loadSameDayArchiveFallback(DATE, "timeout", { archiveDir: dir });
    assert.equal(result.used, false);
    if (result.used) return;
    assert.equal(result.code, "unreadable");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("partially written archive is rejected", async () => {
  // A truncated atomic write: valid prefix, no closing brace.
  const truncated = JSON.stringify(archive()).slice(0, 200);
  const dir = withArchiveDir(`${DATE}.json`, truncated);
  try {
    const result = await loadSameDayArchiveFallback(DATE, "timeout", { archiveDir: dir });
    assert.equal(result.used, false);
    if (result.used) return;
    assert.equal(result.code, "unreadable");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("empty archive is rejected", async () => {
  const dir = withArchiveDir(
    `${DATE}.json`,
    JSON.stringify(archive({ fh: [], over15: [], over25: [], sh: [] }))
  );
  try {
    const result = await loadSameDayArchiveFallback(DATE, "timeout", { archiveDir: dir });
    assert.equal(result.used, false);
    if (result.used) return;
    assert.equal(result.code, "no_valid_fixture");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("wrong-date archive is rejected", async () => {
  const dir = withArchiveDir(`${DATE}.json`, JSON.stringify(archive({ date: "2026-07-31" })));
  try {
    const result = await loadSameDayArchiveFallback(DATE, "timeout", { archiveDir: dir });
    assert.equal(result.used, false);
    if (result.used) return;
    assert.equal(result.code, "date_mismatch");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("absent archive fails closed", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "rw-archive-"));
  try {
    const result = await loadSameDayArchiveFallback(DATE, "circuit_open", { archiveDir: dir });
    assert.equal(result.used, false);
    if (result.used) return;
    assert.equal(result.code, "absent");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("archive of structurally invalid fixtures is rejected", () => {
  const broken = archive({
    fh: [{ matchId: 0, homeTeam: "", awayTeam: "" }],
    over15: [{ matchId: -3, homeTeam: "A", awayTeam: "B" }],
    over25: [],
    sh: [],
  } as unknown as Partial<DailyArchive>);
  assert.equal(countValidFixtures(broken), 0);
  const acceptance = acceptSameDayArchive(broken, DATE);
  assert.equal(acceptance.accepted, false);
  if (acceptance.accepted) return;
  assert.equal(acceptance.code, "no_valid_fixture");
});

test("acceptance is pure and rejects a null archive", () => {
  assert.equal(acceptSameDayArchive(null, DATE).accepted, false);
  assert.equal(acceptSameDayArchive(archive(), DATE).accepted, true);
});

test("archive age is whole seconds and never negative", () => {
  assert.equal(
    archiveAgeSeconds("2026-08-01T19:21:39.642Z", Date.parse("2026-08-01T19:21:49.642Z")),
    10
  );
  // Clock skew must not produce a negative age.
  assert.equal(
    archiveAgeSeconds("2026-08-01T19:21:39.642Z", Date.parse("2026-08-01T19:00:00.000Z")),
    0
  );
  assert.equal(archiveAgeSeconds("not-a-date", Date.now()), undefined);
});

/* ---------------------------------------------------------------- *
 * Pipeline continues through the fallback (cases 16–18)
 * ---------------------------------------------------------------- */

test("fallback rows flow through normalization, qualification and top picks", async () => {
  const dir = withArchiveDir(`${DATE}.json`, JSON.stringify(archive()));
  try {
    const result = await loadSameDayArchiveFallback(DATE, "circuit_open", { archiveDir: dir });
    assert.equal(result.used, true);
    if (!result.used) return;

    // Raw fallback rows.
    const raw =
      result.lists.fh.length +
      result.lists.over15.length +
      result.lists.over25.length +
      result.lists.sh.length;
    assert.ok(raw > 0, "raw fallback rows present");

    // Normalized + qualified through the EXISTING mapper — no fallback-specific pipeline.
    const qualified = mapDailyListsToQualifiedFixtures(result.lists);
    assert.ok(qualified.length > 0, "qualified fixtures produced from fallback");

    // Top picks are the highest model probabilities among qualified rows.
    const topPicks = [...qualified]
      .sort((a, b) => b.modelProbability - a.modelProbability)
      .slice(0, 6);
    assert.ok(topPicks.length > 0, "top picks produced from fallback");
    assert.ok(topPicks.every((f) => f.modelProbability > 0));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fallback projection matches the historical-date projection exactly", async () => {
  const dir = withArchiveDir(`${DATE}.json`, JSON.stringify(archive()));
  try {
    const result = await loadSameDayArchiveFallback(DATE, "timeout", { archiveDir: dir });
    assert.equal(result.used, true);
    if (!result.used) return;
    const direct = archiveToDailyLists(archive());
    // Same rows, same order — the fallback adds provenance and nothing else.
    assert.deepEqual(
      { ...result.lists, provenance: undefined },
      { ...direct, provenance: undefined }
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* ---------------------------------------------------------------- *
 * Provenance is bounded and secret-safe (case 22)
 * ---------------------------------------------------------------- */

test("provenance is bounded and carries no secret, URL or payload", async () => {
  const dir = withArchiveDir(`${DATE}.json`, JSON.stringify(archive()));
  try {
    const result = await loadSameDayArchiveFallback(DATE, "quota_exhausted", {
      archiveDir: dir,
      nowMs: Date.parse("2026-08-01T19:45:00.000Z"),
    });
    assert.equal(result.used, true);
    if (!result.used) return;
    const p = result.lists.provenance!;
    assert.deepEqual(Object.keys(p).sort(), [
      "archiveAgeSeconds",
      "archiveCapturedAt",
      "providerFailureReasonCode",
      "requestedDate",
      "source",
    ]);
    const serialized = JSON.stringify(p);
    assert.doesNotMatch(serialized, /key=|apikey|api_key/i);
    assert.doesNotMatch(serialized, /postgres:\/\/|password/i);
    assert.doesNotMatch(serialized, /football-data-api\.com/i);
    assert.ok(serialized.length < 300, "provenance stays small");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* ---------------------------------------------------------------- *
 * Serving state + readiness (case 23)
 * ---------------------------------------------------------------- */

test("serving state maps each source to its readiness class", () => {
  resetDailyListsServingState();
  assert.equal(getDailyListsServingState(), "unknown");
  noteDailyListsServing("fresh_provider");
  assert.equal(getDailyListsServingState(), "serving_fresh");
  noteDailyListsServing("stale_daily_archive");
  assert.equal(getDailyListsServingState(), "serving_stale");
  noteDailyListsServing("unavailable");
  assert.equal(getDailyListsServingState(), "unavailable");
  resetDailyListsServingState();
});

test("readiness reports serving_stale as degraded, not fail", async () => {
  const { buildReadinessReport } = await import("../lib/monitoring/health");
  resetDailyListsServingState();
  noteDailyListsServing("stale_daily_archive");
  const report = await buildReadinessReport();
  const daily = report.checks.find((c) => c.name === "daily_lists");
  assert.ok(daily, "daily_lists check is present");
  assert.equal(daily!.status, "degraded");
  assert.equal(daily!.detail, "serving_stale");
  // While stale data is served the provider must never be reported as a hard failure.
  const providers = report.checks.find((c) => c.name === "providers");
  assert.ok(providers);
  assert.notEqual(providers!.status, "fail");
  resetDailyListsServingState();
});

test("readiness reports unavailable as fail when nothing is served", async () => {
  const { buildReadinessReport } = await import("../lib/monitoring/health");
  resetDailyListsServingState();
  noteDailyListsServing("unavailable");
  const report = await buildReadinessReport();
  const daily = report.checks.find((c) => c.name === "daily_lists");
  assert.equal(daily!.status, "fail");
  assert.equal(daily!.detail, "unavailable");
  resetDailyListsServingState();
});

test("readiness reports serving_fresh as ok", async () => {
  const { buildReadinessReport } = await import("../lib/monitoring/health");
  resetDailyListsServingState();
  noteDailyListsServing("fresh_provider");
  const report = await buildReadinessReport();
  const daily = report.checks.find((c) => c.name === "daily_lists");
  assert.equal(daily!.status, "ok");
  resetDailyListsServingState();
});

/* ---------------------------------------------------------------- *
 * Notice + non-fabrication (cases 19–21)
 * ---------------------------------------------------------------- */

test("stale notice copy names the condition and the capture time, and never says live data", () => {
  const copy = predictionsEn.staleArchiveNotice;
  assert.match(copy, /\{time\}/, "carries the capture-time placeholder");
  assert.match(copy, /temporarily unavailable/i);
  assert.match(copy, /last successful update/i);
  // Must not describe the stale data as live, fresh, refreshed or updated-now.
  assert.doesNotMatch(copy, /\blive data is\b|\bnow live\b|\bjust (updated|refreshed)\b/i);
  // Non-promotional: no urgency, no reassurance about restoration.
  assert.doesNotMatch(copy, /soon|shortly|back online|don't worry/i);
});

test("the homepage renders the notice only for stale_daily_archive", () => {
  const src = require("node:fs").readFileSync(
    path.join(__dirname, "../components/bible/RankWagersHome.tsx"),
    "utf8"
  ) as string;
  // Gated on the stale source, and on nothing else.
  assert.match(src, /provenance\?\.source === "stale_daily_archive"/);
  assert.match(src, /staleNotice \? \(/);
  assert.match(src, /staleArchiveNotice/);
});

test("Live Signals withhold rather than replay archived live fields", () => {
  const src = require("node:fs").readFileSync(
    path.join(__dirname, "../app/api/live-feed/route.ts"),
    "utf8"
  ) as string;
  assert.match(src, /stale_daily_archive/);
  // Stale serving must feed the live builder no rows at all.
  assert.match(src, /servingStale\s*\?\s*\[\]/);
  assert.match(src, /servingStale \? \{ fh: \[\], over25: \[\] \}/);
});

/* ---------------------------------------------------------------- *
 * Contract guards: what must NOT change (cases 1, 12–15, 24)
 * ---------------------------------------------------------------- */

test("a successful EMPTY provider response is never replaced by archive data", () => {
  const src = require("node:fs").readFileSync(
    path.join(__dirname, "../lib/footystats/client.ts"),
    "utf8"
  ) as string;
  // The fallback triggers only on the `unavailable` source, which is set only on provider failure.
  assert.match(src, /if \(fresh\.provenance\?\.source !== "unavailable"\)/);
  // A successful response — empty or not — is stamped fresh_provider.
  assert.match(src, /source: "fresh_provider", requestedDate: date/);
});

test("historical-date behaviour is unchanged: archive first, no provider call", () => {
  const src = require("node:fs").readFileSync(
    path.join(__dirname, "../lib/footystats/client.ts"),
    "utf8"
  ) as string;
  assert.match(src, /const archive = await readDailyArchive\(d\);/);
  assert.match(src, /if \(archive\) \{\s*\n\s*return archiveToDailyLists\(archive\);/);
  assert.match(src, /\{ revalidate: 3600 \}/);
});

test("no duplicate provider call: one execute per fetch, soft wrapper delegates", () => {
  const src = require("node:fs").readFileSync(
    path.join(__dirname, "../lib/footystats/client.ts"),
    "utf8"
  ) as string;
  // Exactly one call site into the reliability seam for the daily list path.
  assert.equal((src.match(/await executeProviderCall</g) ?? []).length, 1);
  // fetchJson no longer calls the provider itself; it reuses the result-returning path.
  assert.match(src, /const result = await fetchJsonResult<T>\(endpoint, params, operation\);/);
  // No CALL site for the soft wrapper remains — a mention in a doc comment is not a call.
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");
  assert.doesNotMatch(code, /executeProviderCallSoft\s*[<(]/);
  // The fallback read is a file read, never a second provider request.
  assert.match(src, /await loadSameDayArchiveFallback\(/);
});

test("circuit-breaker behaviour is untouched by the fallback", () => {
  const client = require("node:fs").readFileSync(
    path.join(__dirname, "../lib/footystats/client.ts"),
    "utf8"
  ) as string;
  // The fallback never resets, probes, opens or closes a circuit.
  assert.doesNotMatch(client, /recordSuccess|recordFailure|canProbe|resetCircuit/);
  const fallback = require("node:fs").readFileSync(
    path.join(__dirname, "../lib/footystats/archiveFallback.ts"),
    "utf8"
  ) as string;
  assert.doesNotMatch(fallback, /executeProvider/);
  assert.doesNotMatch(fallback, /circuit/i);
});

test("archive write on fresh success is unchanged and never runs on failure", () => {
  const src = require("node:fs").readFileSync(
    path.join(__dirname, "../lib/footystats/client.ts"),
    "utf8"
  ) as string;
  // Still exactly one merge call, still wrapped so it can never block a page.
  assert.equal((src.match(/await mergeArchiveFromLists\(lists\);/g) ?? []).length, 1);
  // The failure branch returns before the merge, so a failed fetch cannot overwrite a good capture.
  const failureIdx = src.indexOf('source: "unavailable",');
  const mergeIdx = src.indexOf("await mergeArchiveFromLists(lists);");
  assert.ok(failureIdx > 0 && mergeIdx > failureIdx, "failure returns before the archive write");
});

test("fallback module performs no network and no clock reads of its own", () => {
  const src = require("node:fs").readFileSync(
    path.join(__dirname, "../lib/footystats/archiveFallback.ts"),
    "utf8"
  ) as string;
  assert.doesNotMatch(src, /\bfetch\(/);
  // The only clock use is the injectable default.
  assert.equal((src.match(/Date\.now\(\)/g) ?? []).length, 1);
  assert.match(src, /options\.nowMs \?\? Date\.now\(\)/);
});

test("a credential fault is classified as provider failure, not an application error", () => {
  // Regression, 2026-08-01 candidate verification. `getFootyStatsApiKey()` throws when the key is
  // missing or blank. It originally sat OUTSIDE the try that classifies provider failures, so the
  // throw escaped `fetchJsonResult`, never produced an `unavailable` provenance, and the same-day
  // fallback never engaged — the isolated candidate rendered 0 qualified fixtures with no stale
  // notice while a valid 132-fixture archive sat on disk.
  const src = require("node:fs").readFileSync(
    path.join(__dirname, "../lib/footystats/client.ts"),
    "utf8"
  ) as string;
  const fn = src.slice(
    src.indexOf("async function fetchJsonResult"),
    src.indexOf("/** Soft accessor retained")
  );
  const tryIdx = fn.indexOf("try {");
  const keyIdx = fn.indexOf("getFootyStatsApiKey()");
  const catchIdx = fn.indexOf("} catch (error)");
  assert.ok(tryIdx > 0 && keyIdx > 0 && catchIdx > 0, "function shape recognised");
  assert.ok(
    keyIdx > tryIdx && keyIdx < catchIdx,
    "credential resolution must sit inside the classified try block"
  );
  // URL assembly must be guarded too — a malformed base URL is equally a provider-side fault.
  const urlIdx = fn.indexOf("new URL(");
  assert.ok(urlIdx > tryIdx && urlIdx < catchIdx, "URL assembly must be inside the try block");
});

test("emptyLists reports the unavailable source for its requested date", async () => {
  const { emptyLists } = await import("../lib/footystats/client");
  const lists: DailyMatchLists = emptyLists("2026-08-01");
  assert.equal(lists.date, "2026-08-01");
  assert.equal(lists.provenance?.source, "unavailable");
  assert.equal(lists.provenance?.requestedDate, "2026-08-01");
  assert.equal(lists.fh.length + lists.over15.length + lists.over25.length + lists.sh.length, 0);
});
