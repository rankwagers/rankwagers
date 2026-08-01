import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { beforeEach } from "node:test";

// Next's ambient types declare NODE_ENV readonly; the cast is type-level only.
(process.env as { NODE_ENV?: string }).NODE_ENV = "test";
process.env.ADMIN_KEY = "phase-e-admin-key-0123456789";
process.env.FF_OPERATOR_APPROVAL_ENABLED = "true";
delete process.env.SITE_URL;
delete process.env.BUILDER_APPROVAL_DATABASE_URL;

import { CANDIDATE_SCHEMA_VERSION } from "../lib/builder-approval/contracts";
import { ABSENT } from "../lib/builder-approval/presentation";
import {
  resetCandidateStoreForTests,
  setCandidateStore,
  type CandidateStore,
} from "../lib/builder-approval/store";
import { createBuilderCandidate } from "../lib/builder-approval/service";

/**
 * The project compiles JSX with the classic runtime (`tsconfig.json` sets `jsx: "preserve"`,
 * and Next supplies the transform in the real build). Under the test transpiler this emits
 * `React.createElement`, so `React` must exist as a global before any JSX module evaluates.
 *
 * `import` statements are hoisted, so the JSX modules are pulled in with statement-level
 * `require()` below, which runs in source order AFTER the global is set. This is a
 * test-harness concern only; no production file is affected.
 */
/* eslint-disable @typescript-eslint/no-var-requires */
(globalThis as { React?: unknown }).React = require("react");

const { AdminShell } = require("../components/admin-dashboard/AdminShell") as typeof import("../components/admin-dashboard/AdminShell");
const { CandidateDetailView } = require("../components/builder-approval/CandidateDetailView") as typeof import("../components/builder-approval/CandidateDetailView");
const { CandidateListView } = require("../components/builder-approval/CandidateListView") as typeof import("../components/builder-approval/CandidateListView");
const ListPage = (require("../app/admin/builder-approval/page") as { default: (p: { searchParams?: Record<string, string | string[] | undefined> }) => unknown }).default;
const DetailPage = (require("../app/admin/builder-approval/[candidateId]/page") as { default: (p: { params: { candidateId: string } }) => unknown }).default;
/* eslint-enable @typescript-eslint/no-var-requires */

/**
 * Sprint 20B-A Phase E admin UI tests.
 *
 * The admin views are async server components, so they can be invoked directly and their
 * returned React element tree asserted on. This gives behavioural/contract assertions without
 * a DOM and without adding a testing framework, and deliberately avoids brittle full-page
 * snapshots: every assertion targets a specific behaviour.
 */

const root = process.cwd();

beforeEach(() => {
  resetCandidateStoreForTests();
  process.env.ADMIN_KEY = "phase-e-admin-key-0123456789";
  process.env.FF_OPERATOR_APPROVAL_ENABLED = "true";
  delete process.env.FF_EMERGENCY_DISABLE_APPROVAL;
});

/* ------------------------------------------------------------------ *
 * React element tree helpers
 * ------------------------------------------------------------------ */

/**
 * Views are rendered for real with `renderToStaticMarkup`, not inspected as an unrendered
 * element tree. Walking the raw tree would miss everything produced by nested components
 * (values passed via props rather than children), which would make "no secret is rendered"
 * assertions vacuous. The async server component is awaited first; the resolved tree is
 * synchronous and renders normally.
 */
/* eslint-disable @typescript-eslint/no-var-requires */
const { renderToStaticMarkup } = require("react-dom/server") as {
  renderToStaticMarkup: (element: unknown) => string;
};
/* eslint-enable @typescript-eslint/no-var-requires */

/**
 * Sprint 20B-B stage B4 addition.
 *
 * `CandidateDetailView` now renders `CandidateActions`, a client component that calls
 * `useRouter()`. `renderToStaticMarkup` mounts no app router, so without a provider every
 * detail render throws "expected app router to be mounted". Supplying Next's real
 * `AppRouterContext` with a stub value keeps `useRouter()` on its genuine code path.
 *
 * This changes only HOW the tree is rendered. No assertion below is relaxed by it.
 */
/* eslint-disable-next-line @typescript-eslint/no-var-requires */
const { AppRouterContext } = require("next/dist/shared/lib/app-router-context.shared-runtime") as {
  AppRouterContext: { Provider: unknown };
};

const ROUTER_STUB = {
  refresh() {},
  push() {},
  replace() {},
  back() {},
  forward() {},
  prefetch() {},
};

const html = (tree: unknown): string =>
  renderToStaticMarkup(
    (globalThis as { React: typeof import("react") }).React.createElement(
      AppRouterContext.Provider as never,
      { value: ROUTER_STUB } as never,
      tree as never,
    ),
  );

function decode(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/g, "/")
    .replace(/&amp;/g, "&");
}

/** Visible text of the rendered output, whitespace-normalised. */
function renderedText(tree: unknown): string {
  return decode(html(tree).replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

const count = (tree: unknown, pattern: RegExp): number =>
  (html(tree).match(pattern) ?? []).length;

function hrefs(tree: unknown): string[] {
  return [...html(tree).matchAll(/href="([^"]*)"/g)].map((m) => decode(m[1]));
}

/* ------------------------------------------------------------------ *
 * Fixtures
 * ------------------------------------------------------------------ */

function leg(over: Record<string, unknown> = {}) {
  return {
    id: "c1",
    matchId: 501,
    homeTeam: "Home FC",
    awayTeam: "Away FC",
    competition: "Test League",
    kickoffAt: "2026-07-27T18:00:00.000Z",
    marketKey: "over25",
    confidence: 70,
    odds: 1.7,
    ...over,
  };
}

function body(over: Record<string, unknown> = {}) {
  return {
    schemaVersion: CANDIDATE_SCHEMA_VERSION,
    sourceRequestId: "req_phase_e",
    sourceSnapshotId: "snap_phase_e",
    sourceDate: "2026-07-26",
    sourceBuilderConfig: { locale: "en", riskMode: "balanced" },
    payload: {
      kind: "builder_combination",
      combination: {
        id: "combo_e",
        label: "recommended",
        legCount: 2,
        combinedOdds: 2.55,
        averageConfidence: 72.5,
        legs: [leg(), leg({ id: "c2", matchId: 502, marketKey: "over15", odds: 1.5 })],
      },
    },
    ...over,
  };
}

async function seed(over: Record<string, unknown> = {}, key = "phase-e-key-0001") {
  const result = await createBuilderCandidate({ body: body(over), idempotencyKey: key });
  assert.ok(result.ok, `seed failed: ${JSON.stringify(result)}`);
  return result.candidate;
}

function throwingStore(): CandidateStore {
  return {
    storageMode: "memory",
    durable: false,
    async createCandidate() {
      throw new Error("boom: postgres://user:SUPERSECRET@host/db");
    },
    async getCandidate() {
      throw new Error("boom: postgres://user:SUPERSECRET@host/db");
    },
    async listCandidates() {
      throw new Error("boom: postgres://user:SUPERSECRET@host/db");
    },
    async transitionCandidateStatus() {
      throw new Error("boom: postgres://user:SUPERSECRET@host/db");
    },
  };
}

/* ------------------------------------------------------------------ *
 * ROUTE AND ACCESS
 * ------------------------------------------------------------------ */

test("route_list_feature_disabled_is_not_found", () => {
  process.env.FF_OPERATOR_APPROVAL_ENABLED = "false";
  assert.throws(() => ListPage({ searchParams: {} }), /NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK/);
});

test("route_detail_feature_disabled_is_not_found", () => {
  process.env.FF_OPERATOR_APPROVAL_ENABLED = "false";
  assert.throws(
    () => DetailPage({ params: { candidateId: `bpc_${"a".repeat(32)}` } }),
    /NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK/,
  );
});

test("route_emergency_kill_switch_is_not_found", () => {
  process.env.FF_EMERGENCY_DISABLE_APPROVAL = "true";
  assert.throws(() => ListPage({ searchParams: {} }), /NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK/);
});

test("route_disabled_feature_performs_no_candidate_read", () => {
  // A throwing store would surface if the page read candidates while disabled.
  setCandidateStore(throwingStore());
  process.env.FF_OPERATOR_APPROVAL_ENABLED = "false";
  assert.throws(() => ListPage({ searchParams: {} }), /NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK/);
  resetCandidateStoreForTests();
});

test("route_pages_delegate_authorization_to_AdminGate", () => {
  // Authorization is server-side, not client-side hiding: the page's outermost element is
  // AdminGate, so no view content is produced for an unauthorized caller.
  type Rendered = { type?: unknown };
  const listTree = ListPage({ searchParams: {} }) as Rendered;
  const detailTree = DetailPage({
    params: { candidateId: `bpc_${"a".repeat(32)}` },
  }) as Rendered;
  for (const tree of [listTree, detailTree]) {
    assert.equal(
      typeof tree.type === "function" ? (tree.type as { name?: string }).name : "",
      "AdminGate",
      "page must wrap its view in AdminGate",
    );
  }
});

test("route_detail_unknown_candidate_is_not_found", async () => {
  await assert.rejects(
    () => CandidateDetailView({ candidateId: `bpc_${"b".repeat(32)}` }),
    /NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK/,
  );
});

test("route_detail_malformed_candidate_id_is_not_found", async () => {
  for (const bad of ["../../etc/passwd", "'; DROP TABLE x; --", "snap_abc", "", "bpc_short"]) {
    await assert.rejects(
      () => CandidateDetailView({ candidateId: bad }),
      /NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK/,
      `expected 404 for ${bad}`,
    );
  }
});

/* ------------------------------------------------------------------ *
 * LIST UI
 * ------------------------------------------------------------------ */

test("list_empty_state_is_rendered_and_announced", async () => {
  const tree = await CandidateListView({ searchParams: {} });
  const text = renderedText(tree);
  assert.match(text, /No candidates/);
  assert.match(text, /have been saved/);
  assert.ok(count(tree, /role="status"/g) > 0, "empty state must be screen-reader announced");
  assert.equal(count(tree, /<table/g), 0, "no table when there is nothing to show");
});

test("list_populated_shows_contract_fields_only", async () => {
  const candidate = await seed();
  const tree = await CandidateListView({ searchParams: {} });
  const text = renderedText(tree);

  assert.match(text, new RegExp(candidate.candidateId));
  assert.match(text, /DRAFT/);
  assert.match(text, /over25/);
  assert.match(text, /snap_phase_e/);
  assert.match(text, /req_phase_e/);
  assert.match(text, /2\.55/, "combined odds from the stored payload");
  assert.match(text, /memory/);
  assert.match(text, /Not durable/);

  // Detail link is a real, keyboard-reachable anchor.
  assert.ok(hrefs(tree).includes(`/admin/builder-approval/${candidate.candidateId}`));
});

test("list_uses_accessible_table_semantics", async () => {
  await seed();
  const tree = await CandidateListView({ searchParams: {} });
  assert.equal(count(tree, /<table/g), 1);
  assert.equal(count(tree, /<caption/g), 1, "table needs a caption");
  const headerCount = count(tree, /<th[\s>]/g);
  assert.ok(headerCount >= 8);
  assert.equal(count(tree, /scope="col"/g), headerCount, "every header cell needs scope=col");
});

test("list_renders_explicit_absence_labels_not_invented_defaults", async () => {
  const raw = body() as Record<string, unknown>;
  delete raw.sourceRequestId; // omitted
  raw.sourceSnapshotId = null; // explicit null
  const result = await createBuilderCandidate({ body: raw, idempotencyKey: "phase-e-absent-1" });
  assert.ok(result.ok);

  const text = renderedText(await CandidateListView({ searchParams: {} }));
  const occurrences = text.split(ABSENT.notProvided).length - 1;
  assert.ok(occurrences >= 2, "omitted and explicit null both render as Not provided");
  // A bare `null`/`undefined` must never appear as a rendered VALUE. The explanatory
  // footnote legitimately contains the word "null", so assert on text nodes, not prose.
  const markup = html(await CandidateListView({ searchParams: {} }));
  assert.ok(!/>\s*null\s*</.test(markup), "raw null must never be printed as a value");
  assert.ok(!/>\s*undefined\s*</.test(markup));
  assert.ok(!/undefined/.test(text));
});

test("list_states_that_storage_cannot_distinguish_omitted_from_null", async () => {
  const text = renderedText(await CandidateListView({ searchParams: {} }));
  assert.match(text, /cannot distinguish an omitted property from an explicit null/);
});

test("list_pagination_is_bounded_and_navigable", async () => {
  for (let i = 0; i < 3; i++) {
    await seed({ sourceRequestId: `req_${i}` }, `phase-e-page-${i}`);
  }
  const first = await CandidateListView({ searchParams: { limit: "1", offset: "0" } });
  assert.equal(count(first, /<tr[\s>]/g), 2, "header row + one data row");
  assert.match(renderedText(first), /Showing 1–1 of 3/);
  const firstHrefs = hrefs(first);
  assert.ok(firstHrefs.some((h) => h.includes("offset=1")), "Next link present");
  assert.ok(!renderedText(first).includes("Previous"), "no Previous on the first page");

  const middle = await CandidateListView({ searchParams: { limit: "1", offset: "1" } });
  assert.match(renderedText(middle), /Showing 2–2 of 3/);
  assert.match(renderedText(middle), /Previous/);
  assert.match(renderedText(middle), /Next/);

  const last = await CandidateListView({ searchParams: { limit: "1", offset: "2" } });
  assert.match(renderedText(last), /Showing 3–3 of 3/);
  assert.ok(!renderedText(last).includes("Next"), "no Next on the last page");
});

test("list_absurd_limit_is_clamped_by_the_api_contract", async () => {
  await seed();
  const tree = await CandidateListView({ searchParams: { limit: "100000" } });
  // The Phase D filter parser clamps to CANDIDATE_LIST_MAX_LIMIT; the UI must not widen it.
  assert.ok(hrefs(tree).every((h) => !h.includes("limit=100000")));
});

test("list_error_state_offers_retry_and_leaks_nothing", async () => {
  setCandidateStore(throwingStore());
  const tree = await CandidateListView({ searchParams: {} });
  const text = renderedText(tree);

  assert.match(text, /Could not load candidates/);
  assert.match(text, /Retry/);
  assert.ok(count(tree, /role="alert"/g) > 0, "error must be announced");
  assert.ok(!text.includes("SUPERSECRET"));
  assert.ok(!text.includes("postgres://"));
  assert.ok(!/boom/.test(text));
  assert.equal(count(tree, /<table/g), 0);
  resetCandidateStoreForTests();
});

test("list_offers_no_mutating_action", async () => {
  await seed();
  const tree = await CandidateListView({ searchParams: {} });
  const text = renderedText(tree);
  for (const word of ["Approve", "Reject", "Publish", "Unpublish", "Delete", "Edit"]) {
    assert.ok(!text.includes(word), `list must not offer "${word}"`);
  }
  // The only interactive control in the rendered page is AdminShell's pre-existing logout.
  // Asserting that exactly, rather than "zero buttons", keeps the check truthful.
  assert.equal(count(tree, /<button/g), 1, "only the admin shell logout button");
  assert.equal(count(tree, /<form/g), 1, "only the admin shell logout form");
  assert.match(html(tree), /action="\/api\/admin\/logout"/);
  assert.equal(count(tree, /<input/g), 0, "a read-only list has no inputs");
});

/* ------------------------------------------------------------------ *
 * DETAIL UI
 * ------------------------------------------------------------------ */

test("detail_renders_full_payload_in_sections", async () => {
  const candidate = await seed();
  const tree = await CandidateDetailView({ candidateId: candidate.candidateId });
  const text = renderedText(tree);

  for (const expected of [
    "Identity and lifecycle",
    "Source references",
    "Combination",
    "Selections",
    "Integrity",
    "Raw payload",
  ]) {
    assert.ok(text.includes(expected), `missing section: ${expected}`);
  }
  assert.match(text, new RegExp(candidate.candidateId));
  assert.match(text, /DRAFT/);
  assert.match(text, /admin/);
  assert.match(text, /Home FC v Away FC/);
  assert.match(text, /over25/);
  assert.match(text, /over15/);
  assert.match(text, new RegExp(candidate.payloadChecksum));
  assert.match(text, /20b-a\.sha256\.canon\.1/);
});

test("detail_selections_table_is_accessible", async () => {
  const candidate = await seed();
  const tree = await CandidateDetailView({ candidateId: candidate.candidateId });
  assert.equal(count(tree, /<caption/g), 1);
  const headerCount = count(tree, /<th[\s>]/g);
  assert.ok(headerCount >= 8);
  assert.equal(count(tree, /scope="col"/g), headerCount);
  assert.equal(count(tree, /<tr[\s>]/g), 3, "header row + two legs");
});

test("detail_raw_json_is_secondary_disclosure_not_the_primary_interface", async () => {
  const candidate = await seed();
  const tree = await CandidateDetailView({ candidateId: candidate.candidateId });
  assert.ok(count(tree, /<details/g) >= 2, "raw payload and config are behind <details>");
  assert.ok(count(tree, /<dl[\s>]/g) >= 3, "structured sections lead the page");
});

test("detail_absent_and_null_optional_fields_render_honestly", async () => {
  const raw = body() as Record<string, unknown>;
  delete raw.sourceRequestId;
  raw.sourceSnapshotId = null;
  raw.sourceDate = null;
  const created = await createBuilderCandidate({ body: raw, idempotencyKey: "phase-e-null-01" });
  assert.ok(created.ok);

  const text = renderedText(await CandidateDetailView({ candidateId: created.candidate.candidateId }));
  const occurrences = text.split(ABSENT.notProvided).length - 1;
  assert.ok(occurrences >= 3, "all three optional identifiers render as Not provided");
  assert.match(text, /cannot distinguish an omitted property from an explicit null/);
});

/**
 * Sprint 20B-B stage B4 update.
 *
 * The two scope sentences this asserted ("not approved, not published" and "No approval or
 * publication capability exists") described Phase D and became FALSE once B1/B3 shipped: a
 * candidate now holds four statuses and approval genuinely exists. Asserting text the product
 * must no longer display would pin a lie in place.
 *
 * Both halves of the original INTENT are kept, and the visibility claim is now stated in a form
 * that holds at every status rather than only for a DRAFT.
 */
test("detail_states_coarse_actor_and_visibility_scope", async () => {
  const candidate = await seed();
  const text = renderedText(await CandidateDetailView({ candidateId: candidate.candidateId }));
  // 1. Actor attribution honesty — unchanged.
  assert.match(text, /not a named individual/);
  // 2. Public-visibility honesty — true for DRAFT, APPROVED, REJECTED and CONVERTED alike.
  assert.match(text, /never publicly visible at any status/);
  assert.match(text, /public Acca pages arrive in a later stage/);
  // The superseded Phase D claims must not survive anywhere in the rendered page.
  assert.ok(!text.includes("No approval or publication capability exists"));
});

test("detail_error_state_is_safe", async () => {
  setCandidateStore(throwingStore());
  const tree = await CandidateDetailView({ candidateId: `bpc_${"c".repeat(32)}` });
  const text = renderedText(tree);
  assert.match(text, /Could not load candidate/);
  assert.match(text, /Retry/);
  assert.ok(!text.includes("SUPERSECRET"));
  assert.ok(!text.includes("postgres://"));
  resetCandidateStoreForTests();
});

test("detail_never_leaks_secrets_or_internals", async () => {
  const candidate = await seed();
  const tree = await CandidateDetailView({ candidateId: candidate.candidateId });
  const text = renderedText(tree);
  // The full rendered markup, not JSON.stringify of the element tree: React elements are
  // circular, and the markup is what actually reaches the operator's browser anyway.
  const markup = html(tree);

  for (const forbidden of [
    process.env.ADMIN_KEY as string,
    "rw_admin_session",
    "idempotencyKey",
    "requestFingerprint",
    "postgres://",
    "SUPERSECRET",
    "BUILDER_APPROVAL_DATABASE_URL",
    "ATTRIBUTION_DATABASE_URL",
  ]) {
    assert.ok(!text.includes(forbidden), `visible text leaked ${forbidden}`);
    assert.ok(!markup.includes(forbidden), `rendered markup leaked ${forbidden}`);
  }
  assert.ok(!/ {4}at .+\(/.test(markup), "no stack frames");
  assert.ok(!/Set-Cookie|csrf|Bearer /i.test(markup), "no auth material in markup");
});

/**
 * Sprint 20B-B stage B4 replacement for `detail_offers_no_mutating_action`.
 *
 * The original asserted that NO approve/reject/publish control existed, which was correct while
 * Phase D exposed no transition contract. Stage B1 added the guarded lifecycle, B3 exposed it
 * over HTTP, and B4 surfaces it — so that assertion is now contradicted by approved scope and
 * cannot be kept as written.
 *
 * The SECURITY intent is preserved exactly and is what this still enforces: the detail view may
 * offer only the two guarded candidate transitions, and must never offer an arbitrary mutation
 * (delete, edit, regenerate, unpublish) for which no contract exists anywhere in the system.
 */
test("detail_offers_only_guarded_lifecycle_actions", async () => {
  const candidate = await seed();
  const tree = await CandidateDetailView({ candidateId: candidate.candidateId });
  const text = renderedText(tree);

  // Operations with NO contract in any layer must not be offered, at any status.
  for (const word of ["Unpublish", "Delete", "Edit candidate", "Regenerate", "Duplicate"]) {
    assert.ok(!text.includes(word), `detail must never offer "${word}"`);
  }

  // A DRAFT candidate may be approved or rejected, and nothing else.
  assert.ok(text.includes("Approve candidate"), "a DRAFT must offer approval");
  assert.ok(text.includes("Reject candidate"), "a DRAFT must offer rejection");
  assert.ok(
    !text.includes("Create Acca from this candidate"),
    "conversion is only available once APPROVED",
  );

  // The admin shell's logout form remains the only <form> on the page: the action controls are
  // buttons posting through fetch, so no additional form can be cross-site submitted.
  assert.equal(count(tree, /<form/g), 1, "only the admin shell logout form");
  assert.match(html(tree), /action="\/api\/admin\/logout"/);
});

/* ------------------------------------------------------------------ *
 * NAVIGATION
 * ------------------------------------------------------------------ */

function navText(): string {
  return renderedText(AdminShell({ title: "T", activePath: "/admin/dashboard", children: null }));
}
function navHrefs(): string[] {
  return hrefs(AdminShell({ title: "T", activePath: "/admin/dashboard", children: null }));
}

test("nav_item_hidden_when_feature_disabled", () => {
  process.env.FF_OPERATOR_APPROVAL_ENABLED = "false";
  assert.ok(!navText().includes("Builder approval"));
  assert.ok(!navHrefs().includes("/admin/builder-approval"));
});

test("nav_item_hidden_when_emergency_kill_switch_set", () => {
  process.env.FF_EMERGENCY_DISABLE_APPROVAL = "true";
  assert.ok(!navHrefs().includes("/admin/builder-approval"));
});

test("nav_item_visible_when_enabled", () => {
  assert.ok(navText().includes("Builder approval"));
  assert.ok(navHrefs().includes("/admin/builder-approval"));
});

test("nav_item_only_renders_inside_authorized_shell", () => {
  // AdminShell is only reachable through AdminGate, so nav visibility is never the
  // authorization boundary; the routes 404 independently when disabled.
  assert.ok(navHrefs().includes("/admin/builder-approval"));
  assert.ok(
    navHrefs().every((h) => h.startsWith("/admin/")),
    "admin nav must not link outside /admin",
  );
});

test("nav_existing_items_are_unchanged_by_this_sprint", () => {
  process.env.FF_OPERATOR_APPROVAL_ENABLED = "false";
  const off = navHrefs();
  process.env.FF_OPERATOR_APPROVAL_ENABLED = "true";
  const on = navHrefs();

  // The load-bearing assertion, unchanged: no PRE-EXISTING entry may move or be rewritten.
  assert.deepEqual(on.slice(0, off.length), off, "no existing nav entry may change");

  // Stage B4 adds the Acca Studio beside Builder approval, so the flag now contributes two
  // entries rather than one. Both are named explicitly, so a third could not appear unnoticed.
  assert.equal(on.length, off.length + 2);
  assert.deepEqual(on.slice(off.length), ["/admin/builder-approval", "/admin/accas"]);
  // Both must disappear together when the flag is off.
  assert.equal(off.includes("/admin/builder-approval"), false);
  assert.equal(off.includes("/admin/accas"), false);
});

/* ------------------------------------------------------------------ *
 * ISOLATION (module graph, measured in child processes)
 * ------------------------------------------------------------------ */

function probeModuleGraph(relPath: string): string[] {
  const dir = mkdtempSync(path.join(os.tmpdir(), "rw-phase-e-"));
  const probeFile = path.join(dir, "probe.cjs");
  const target = path.join(root, relPath).replace(/\\/g, "\\\\");
  writeFileSync(
    probeFile,
    [
      `process.env.NODE_ENV = "test";`,
      `process.env.ADMIN_KEY = "phase-e-admin-key-0123456789";`,
      `process.env.FF_OPERATOR_APPROVAL_ENABLED = "true";`,
      // Classic JSX runtime needs React in scope before a JSX module evaluates.
      `globalThis.React = require(${JSON.stringify(path.join(root, "node_modules", "react"))});`,
      `require("${target}");`,
      `const keys = Object.keys(require.cache)`,
      `  .map(function (k) { return k.replace(/\\\\/g, "/"); })`,
      `  .filter(function (k) { return k.indexOf("/lib/") >= 0 || k.indexOf("/app/") >= 0 || k.indexOf("/components/") >= 0; });`,
      `console.log("__GRAPH__" + JSON.stringify(keys));`,
    ].join("\n"),
    "utf8",
  );
  const res = spawnSync(
    process.execPath,
    ["--require", path.join(root, "scripts/mock-server-only.cjs"), "--import", "tsx", probeFile],
    { cwd: root, encoding: "utf8", timeout: 120_000 },
  );
  assert.equal(res.status, 0, `probe failed for ${relPath}:\n${res.stdout}\n${res.stderr}`);
  const line = (res.stdout || "").split(/\r?\n/).find((l) => l.startsWith("__GRAPH__"));
  assert.ok(line, `no graph output for ${relPath}`);
  return JSON.parse(line.slice("__GRAPH__".length)) as string[];
}

const matching = (keys: string[], needle: string) => keys.filter((k) => k.includes(needle));

test("isolation_phase_e_ui_loads_zero_builder_generation_modules", () => {
  const keys = probeModuleGraph("app/admin/builder-approval/page.tsx");
  assert.ok(
    matching(keys, "components/builder-approval/CandidateListView").length > 0,
    "sanity: the Phase E view must have loaded",
  );
  for (const needle of [
    "lib/acca-builder/",
    "lib/combo/prepare",
    "lib/combo/prepared",
    "lib/footystats/client",
    "lib/footystats/dailyArchive",
    "app/api/acca/",
    "components/acca-builder/",
    "components/acca/",
    "lib/decision-ledger/",
  ]) {
    assert.deepEqual(matching(keys, needle), [], `Phase E UI must not load ${needle}`);
  }
});

test("isolation_public_builder_loads_zero_phase_e_ui_modules", () => {
  const keys = probeModuleGraph("app/api/acca/builder/route.ts");
  assert.ok(
    matching(keys, "lib/acca-builder/load.server").length > 0,
    "sanity: the public Builder graph must have loaded",
  );
  for (const needle of [
    "components/builder-approval/",
    "app/admin/builder-approval/",
    "lib/builder-approval/",
    "components/admin-dashboard/",
  ]) {
    assert.deepEqual(matching(keys, needle), [], `public Builder must not load ${needle}`);
  }
});
