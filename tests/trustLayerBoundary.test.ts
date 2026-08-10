import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

/**
 * Sprint 32 — trust layer boundary enforcement.
 *
 * `lib/trust/` became load-bearing across five sprints and eleven surfaces, and had no boundary
 * test. Its purity was asserted only by per-file regexes inside two suites — the same weak
 * pattern that let the JSX blind spot survive from Sprint 27 to Sprint 30.
 *
 * WHY PURITY IS THE INVARIANT
 *
 * The trust vocabulary is the product's honesty rules expressed as code. It is imported by
 * server components, client components, page routes and server-only modules alike. The moment it
 * acquires a dependency it stops being safely importable from all of them: a `server-only`
 * import breaks every client consumer, a React import bloats every server one, and a storage
 * import would make the rules depend on the data they are meant to judge.
 *
 * FILE DISCOVERY IS DELIBERATELY NODE-NATIVE
 *
 * Every scan here uses `readdirSync`, never a shell glob. Sprint 32 established why: the
 * PowerShell surveys used during earlier sprints silently missed files two ways — `**` matches
 * exactly one directory level rather than recursing, and `[locale]` is treated as a character
 * class. Three real consumers were invisible to those surveys. The shipped guards were never
 * affected because they already walked with Node, and this suite makes that property explicit
 * rather than incidental.
 */

const root = process.cwd();
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
}

/** Bracket-safe, fully recursive walk. Skips build output and the forensic checkpoints. */
function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

const rel = (f: string) => f.replace(root + path.sep, "").replace(/\\/g, "/");

const TRUST_MODULES = ["lib/trust/claims.ts", "lib/trust/rankingCriteria.ts"];

/* ================================================================== *
 * 1. Source-level purity
 * ================================================================== */

test("every trust module declares zero imports", () => {
  for (const module of TRUST_MODULES) {
    const src = stripComments(read(module));
    const imports = [...src.matchAll(/^\s*import\s.+$/gm)].map((m) => m[0].trim());
    assert.deepEqual(
      imports,
      [],
      `${module} must have no imports — it is imported by server, client and route code alike`,
    );
    // `require` would evade the import check.
    assert.equal(/\brequire\s*\(/.test(src), false, `${module} must not require()`);
  }
});

test("no trust module reaches infrastructure, framework or storage", () => {
  for (const module of TRUST_MODULES) {
    const src = stripComments(read(module));
    for (const [pattern, why] of [
      [/server-only/, "would break every client consumer"],
      [/from "react"|from 'react'/, "would bloat every server consumer"],
      [/node:/, "would break the browser bundle"],
      [/process\.env/, "rules must not vary by environment"],
      [/\bfetch\s*\(/, "rules must not depend on network state"],
      [/lib\/(api|security|acca-publication|builder-approval|operators)\//, "rules must not depend on what they judge"],
      [/adapters?\//, "rules must not reach storage"],
    ] as Array<[RegExp, string]>) {
      assert.equal(src.match(pattern), null, `${module}: ${pattern} — ${why}`);
    }
  }
});

test("trust modules export only data and pure functions", () => {
  for (const module of TRUST_MODULES) {
    const src = stripComments(read(module));
    // No classes, no mutable MODULE state, no side effects at import time.
    assert.equal(/\bclass\s+\w/.test(src), false, `${module} must not declare a class`);
    /*
     * Anchored at column 0, so this targets module scope only. The first version matched any
     * `let`, which flagged `for (let i = 1; …)` inside `isOrderedByScore` — a function-local
     * loop counter, not shared state. Banning that would have pushed the implementation toward
     * a worse loop to satisfy a test, which is the wrong direction entirely.
     */
    assert.equal(
      /^let\s+\w/m.test(src),
      false,
      `${module} must hold no module-scope mutable state`,
    );
    assert.equal(
      /^var\s+\w/m.test(src),
      false,
      `${module} must hold no module-scope mutable state`,
    );
    // Likewise anchored: an unindented bare call is a module-scope side effect at import time.
    assert.equal(
      /^\w+\([^)]*\);?\s*$/m.test(src),
      false,
      `${module} must not execute at import time`,
    );
  }
});

/* ================================================================== *
 * 2. Runtime proof, measured in a child process
 * ================================================================== */

/**
 * Module-graph probe. Resolution strategy is the proven one from the Phase E and Sprint 20B-B
 * isolation suites: transpiler passed as node CLI flags with `cwd` at the repo root, because a
 * temp-directory probe cannot resolve the project's own `node_modules`.
 */
function probeModuleGraph(relPath: string): string[] {
  const dir = mkdtempSync(path.join(os.tmpdir(), "rw-trust-"));
  const probeFile = path.join(dir, "probe.cjs");
  const target = path.join(root, relPath).replace(/\\/g, "\\\\");
  writeFileSync(
    probeFile,
    [
      `process.env.NODE_ENV = "test";`,
      `require("${target}");`,
      `const keys = Object.keys(require.cache).map(function (k) { return k.replace(/\\\\/g, "/"); });`,
      `console.log("__GRAPH__" + JSON.stringify(keys));`,
    ].join("\n"),
    "utf8",
  );
  const res = spawnSync(
    process.execPath,
    ["--require", path.join(root, "scripts/mock-server-only.cjs"), "--import", "tsx", probeFile],
    { cwd: root, encoding: "utf8", timeout: 120_000 },
  );
  assert.equal(res.status, 0, `probe of ${relPath} failed:\n${res.stdout}\n${res.stderr}`);
  const line = (res.stdout || "").split(/\r?\n/).find((l) => l.startsWith("__GRAPH__"));
  assert.ok(line, `probe produced no output for ${relPath}`);
  return JSON.parse(line.slice("__GRAPH__".length)) as string[];
}

test("BOUNDARY: loading a trust module pulls in no other project module", () => {
  for (const module of TRUST_MODULES) {
    const graph = probeModuleGraph(module);
    const projectModules = graph.filter(
      (m) =>
        !m.includes("/node_modules/") &&
        (m.includes("/lib/") || m.includes("/app/") || m.includes("/components/")),
    );
    // Exactly one: the module itself. Anything else is a dependency it must not have.
    assert.deepEqual(
      projectModules.map((m) => m.slice(m.indexOf("/lib/"))),
      [`/${module}`],
      `${module} must load nothing else; loaded: ${projectModules.join(", ")}`,
    );
  }
});

/* ================================================================== *
 * 3. Consumer registration
 * ================================================================== */

/**
 * Every production consumer of the trust vocabulary, with why it needs it.
 *
 * Registered explicitly rather than globbed, so importing the honesty rules onto a new surface
 * is a deliberate act that must also decide what that surface discloses. A glob would absorb a
 * new consumer silently and prove nothing about it.
 */
const REGISTERED_CONSUMERS: ReadonlyArray<{ rel: string; why: string }> = [
  { rel: "components/trust/OrderingDisclosure.tsx", why: "renders the disclosure and criteria" },
  { rel: "components/BrandListSection.tsx", why: "brand list choke point" },
  { rel: "components/odds/OddsIntelligencePanel.tsx", why: "shows prices, needs provenance" },
  { rel: "components/predictions/LiveFeedPanel.tsx", why: "live signals framing" },
  { rel: "lib/operators/brandListItems.ts", why: "derives the ordering basis" },
  { rel: "lib/operators/brandListTypes.ts", why: "carries the basis on each row" },
  { rel: "app/[locale]/operators/page.tsx", why: "operator index disclosure" },
  // best-crypto-betting-sites left this registry with the commercial conversion
  // pass: the page is a permanent redirect and carries no trust vocabulary.
  /*
   * Registered in Sprint 33. This entry exists because the guard demanded it: the criteria page
   * was added, imported the vocabulary, and this test failed on the very next sprint until the
   * consumer was declared and its treatment decided. That is the mechanism working, and the
   * reason registration is explicit rather than globbed.
   */
  { rel: "app/[locale]/how-we-rank/page.tsx", why: "canonical criteria page" },
];

/** Production consumers discovered by walking, excluding tests and forensic checkpoints. */
function discoverConsumers(): string[] {
  const roots = ["lib", "app", "components"].map((d) => path.join(root, d));
  const found: string[] = [];
  for (const dir of roots) {
    for (const file of walk(dir)) {
      if (rel(file).startsWith("lib/trust/")) continue;
      const src = stripComments(readFileSync(file, "utf8"));
      if (/["'](?:@\/lib\/trust\/|\.\.\/trust\/|\.\/trust\/)/.test(src)) found.push(rel(file));
    }
  }
  return found.sort();
}

test("BOUNDARY: every consumer of the trust vocabulary is registered", () => {
  const discovered = discoverConsumers();
  const registered = REGISTERED_CONSUMERS.map((c) => c.rel).sort();
  assert.deepEqual(
    discovered,
    registered,
    "a new surface importing the honesty rules must be registered here and given a decided treatment",
  );
});

test("the discovery walk is bracket-safe and fully recursive", () => {
  const discovered = discoverConsumers();
  // Both traps that broke the earlier shell surveys, asserted directly.
  assert.ok(
    discovered.some((f) => f.includes("[locale]")),
    "a bracketed path segment must not be treated as a wildcard",
  );
  assert.ok(
    discovered.some((f) => f.split("/").length === 2),
    "a top-level file must be found (a one-level glob would miss it)",
  );
  assert.ok(
    discovered.some((f) => f.split("/").length >= 3),
    "a nested file must be found (a one-level glob would miss it)",
  );
});

/* ================================================================== *
 * 4. No consumer inlines what the vocabulary owns
 * ================================================================== */

test("BOUNDARY: no consumer duplicates a shared disclosure string", () => {
  // A pasted copy drifts from the module the guards police, which would make the guards pass
  // while the product said something else.
  const owned = [
    "Automated observations of market and match activity",
    "Independent comparison. Ordering reflects our published criteria",
    "Odds were recorded when this page was generated",
    "Listed in our editorial order, not ranked by score",
    "Ordered by our published criteria",
  ];
  for (const consumer of REGISTERED_CONSUMERS) {
    const src = stripComments(read(consumer.rel));
    for (const phrase of owned) {
      assert.equal(
        src.includes(phrase),
        false,
        `${consumer.rel} must reference the shared constant, not inline "${phrase.slice(0, 40)}…"`,
      );
    }
  }
});

test("every registered consumer actually imports from the vocabulary", () => {
  for (const consumer of REGISTERED_CONSUMERS) {
    const src = stripComments(read(consumer.rel));
    assert.match(
      src,
      /["'](?:@\/lib\/trust\/|\.\.\/trust\/|\.\/trust\/)/,
      `${consumer.rel} (${consumer.why}) must import from lib/trust`,
    );
  }
});

/* ================================================================== *
 * 5. The vocabulary is reachable from both runtimes
 * ================================================================== */

test("the trust layer is safe to import from client and server code alike", () => {
  const clientConsumers = REGISTERED_CONSUMERS.filter((c) =>
    /^"use client"/m.test(read(c.rel)),
  );
  const serverOnlyConsumers = REGISTERED_CONSUMERS.filter((c) =>
    /import "server-only"/.test(read(c.rel)),
  );
  // Both kinds exist, which is precisely why purity is non-negotiable rather than stylistic.
  assert.ok(clientConsumers.length > 0, "expected at least one client consumer");
  assert.ok(serverOnlyConsumers.length > 0, "expected at least one server-only consumer");
});
