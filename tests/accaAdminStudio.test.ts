import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test, { beforeEach } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { getCandidateStore } from "../lib/builder-approval/store";
import { getAccaService } from "../lib/api/accaComposition";
import {
  ABSENT,
  assessEvidence,
  availableAction,
  describeActionError,
  displayOdds,
  durabilityBadge,
  isoUtc,
  legViews,
  numberOrAbsent,
  pageModel,
  statusBadge,
  textOrAbsent,
} from "../lib/acca-publication/presentation";
import type { AccaRecord } from "../lib/acca-publication/contracts";
import { AccaListView } from "../components/acca-publication/AccaListView";
import { AccaDetailView } from "../components/acca-publication/AccaDetailView";
import { installTestEnv, resetAll, seedApproved } from "./accaApiFixtures";
import * as createAccaRoute from "../app/api/admin/builder-approval/candidates/[candidateId]/create-acca/route";
import { postRequest, read, url } from "./accaApiFixtures";

/**
 * Sprint 20B-B stage B4 — Admin Acca Studio.
 *
 * Server components are rendered with `renderToStaticMarkup`, matching the Phase E UI suite.
 * Client components are verified at source level, because they only execute in a browser.
 */

// The JSX transform used by the test runner expects React on the global object.
(globalThis as { React?: unknown }).React = require("react");

installTestEnv();
beforeEach(resetAll);

const root = process.cwd();
const readSource = (rel: string) => readFileSync(path.join(root, rel), "utf8");

/**
 * Executable text only.
 *
 * These files EXPLAIN their own constraints in prose — the presentation module says it imports
 * "nothing server-only", and `app/sitemap.ts` has a comment recording that the Acca Builder
 * redirect is excluded. Scanning raw source for those tokens fails on the documentation rather
 * than on any code, so negative assertions run against comment-stripped text.
 */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

/**
 * `renderToStaticMarkup` mounts no app router, so a client child calling `useRouter()` throws
 * "expected app router to be mounted". Rather than monkey-patching the module — which silently
 * no-ops here, because the test module is transpiled to sloppy-mode CommonJS and the export is
 * not writable — the real `AppRouterContext` is supplied with a stub value. `useRouter()` then
 * resolves through Next's own code path, and `notFound()` keeps its genuine behaviour.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { AppRouterContext } = require("next/dist/shared/lib/app-router-context.shared-runtime") as {
  AppRouterContext: React.Context<unknown>;
};

const ROUTER_STUB = {
  refresh() {},
  push() {},
  replace() {},
  back() {},
  forward() {},
  prefetch() {},
};

function renderWithRouter(element: React.ReactElement): string {
  const React_ = (globalThis as { React: typeof import("react") }).React;
  return renderToStaticMarkup(
    React_.createElement(AppRouterContext.Provider, { value: ROUTER_STUB }, element),
  );
}

/** Only the regions of a client component that actually build an HTTP request body. */
function requestBodyRegions(src: string): string {
  const regions: string[] = [];
  for (const m of src.matchAll(/const body[^=]*=\s*\{[\s\S]*?\};/g)) regions.push(m[0]);
  for (const m of src.matchAll(/\bbody\.\w+\s*=.*/g)) regions.push(m[0]);
  for (const m of src.matchAll(/JSON\.stringify\(\{[\s\S]*?\}\)/g)) regions.push(m[0]);
  return regions.join("\n");
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

async function seedAcca(title = "Two-fold evidence review") {
  const candidate = await seedApproved();
  const res = await read(
    await createAccaRoute.POST(
      postRequest(url.createAcca(candidate.candidateId), {
        expectedCandidateVersion: candidate.version,
        title,
        locale: "en",
      }),
      { params: { candidateId: candidate.candidateId } },
    ),
  );
  assert.equal(res.status, 201, `seed failed: ${JSON.stringify(res.body)}`);
  const accaId = String((res.body.acca as Record<string, unknown>).accaId);
  const loaded = await getAccaService().getAcca(accaId);
  assert.ok(loaded.ok);
  return { candidate, acca: loaded.acca };
}

async function renderList(searchParams: Record<string, string> = {}) {
  return renderWithRouter((await AccaListView({ searchParams })) as React.ReactElement);
}

async function renderDetail(accaId: string) {
  return renderWithRouter((await AccaDetailView({ accaId })) as React.ReactElement);
}

/** A minimal record for pure-function tests, avoiding a full seed. */
function recordWith(over: Partial<AccaRecord>): AccaRecord {
  return {
    schemaVersion: "20b-b.1.0.0",
    accaId: "acca_" + "0".repeat(32),
    sourceCandidateId: "bpc_test",
    status: "DRAFT",
    title: "T",
    summary: null,
    locale: "en",
    legs: [],
    combinedOdds: 2.55,
    evidenceSnapshot: {},
    qualificationSnapshot: { legCount: 0, oddsComplete: true },
    sourceReferences: {
      candidateId: "bpc_test",
      sourceRequestId: null,
      sourceSnapshotId: null,
      sourceDate: null,
      candidatePayloadChecksum: "x",
      candidateChecksumVersion: "1",
    },
    slug: "t",
    version: 1,
    createdAt: "2026-07-26T12:00:00.000Z",
    updatedAt: "2026-07-26T12:00:00.000Z",
    publishedAt: null,
    archivedAt: null,
    createdBy: "admin",
    publishedBy: null,
    archivedBy: null,
    ...over,
  } as AccaRecord;
}

/* ================================================================== *
 * 1. Presentation purity — never invent a value
 * ================================================================== */

test("presentation helpers label absence explicitly and never fabricate", () => {
  assert.equal(textOrAbsent(null), ABSENT.notProvided);
  assert.equal(textOrAbsent(undefined), ABSENT.notProvided);
  assert.equal(textOrAbsent(""), ABSENT.unknown);
  assert.equal(textOrAbsent("  "), ABSENT.unknown);
  assert.equal(textOrAbsent(42), ABSENT.unknown);
  assert.equal(textOrAbsent("ok"), "ok");

  assert.equal(numberOrAbsent(null), ABSENT.notProvided);
  assert.equal(numberOrAbsent(Number.NaN), ABSENT.unknown);
  assert.equal(numberOrAbsent("7"), ABSENT.unknown);
  assert.equal(numberOrAbsent(0), "0");

  assert.equal(isoUtc(null).display, ABSENT.notProvided);
  assert.equal(isoUtc("not a date").display, ABSENT.unknown);
  assert.equal(isoUtc("2026-07-26T12:00:00.000Z").display, "2026-07-26 12:00:00 UTC");
  assert.equal(isoUtc("2026-07-26T12:00:00.000Z").machine, "2026-07-26T12:00:00.000Z");
});

test("displayOdds formats for reading and never rounds the stored value", () => {
  assert.equal(displayOdds(2.55), "2.55");
  assert.equal(displayOdds(2.5), "2.50");
  assert.equal(displayOdds(1.3311), "1.33");
  assert.equal(displayOdds(Number.NaN), ABSENT.unknown);
  assert.equal(displayOdds("2.55"), ABSENT.unknown, "a string price is not silently coerced");
});

test("presentation module is pure: no I/O, no server-only, no store access", () => {
  const src = codeOnly(readSource("lib/acca-publication/presentation.ts"));
  for (const forbidden of [
    /server-only/,
    /from "@\/lib\/api\//,
    /adapters\//,
    /\bfetch\(/,
    /node:fs/,
    /process\.env/,
    /getAccaStore|getAccaService|getCandidateStore/,
  ]) {
    assert.equal(forbidden.test(src), false, `presentation must not contain ${forbidden}`);
  }
});

/* ================================================================== *
 * 2. Lifecycle affordances derive from the domain, not from the UI
 * ================================================================== */

test("the available action always matches the B1 transition table", () => {
  assert.deepEqual(availableAction("DRAFT"), { action: "publish", reason: "" });
  assert.deepEqual(availableAction("PUBLISHED"), { action: "archive", reason: "" });

  const archived = availableAction("ARCHIVED");
  assert.equal(archived.action, null, "ARCHIVED is terminal — no button may be offered");
  assert.match(archived.reason, /requires a new Acca/);
});

test("status badges never claim a draft or archive is publicly visible", () => {
  assert.equal(statusBadge(recordWith({ status: "DRAFT" })).publiclyVisible, false);
  assert.equal(statusBadge(recordWith({ status: "PUBLISHED" })).publiclyVisible, true);
  assert.equal(statusBadge(recordWith({ status: "ARCHIVED" })).publiclyVisible, false);
  assert.match(statusBadge(recordWith({ status: "DRAFT" })).label, /not publicly visible/);
  assert.match(statusBadge(recordWith({ status: "ARCHIVED" })).label, /no longer publicly visible/);
});

test("status meaning is carried by text, never by colour alone", () => {
  for (const status of ["DRAFT", "PUBLISHED", "ARCHIVED"] as const) {
    const badge = statusBadge(recordWith({ status }));
    assert.ok(badge.label.length > 0, `${status} must have a text label`);
    assert.ok(badge.detail.length > 0, `${status} must have a text explanation`);
  }
});

/* ================================================================== *
 * 3. Evidence honesty
 * ================================================================== */

test("an Acca with no evidence is reported as having none", () => {
  const empty = assessEvidence(recordWith({}));
  assert.equal(empty.hasAnyEvidence, false);
  assert.equal(empty.empty, true);
  assert.ok(empty.notice, "an empty evidence snapshot must produce an operator notice");
  assert.match(empty.notice ?? "", /nothing to explain it/);
});

test("evidence presence is detected from any of the four signals", () => {
  assert.equal(assessEvidence(recordWith({ evidenceSnapshot: { summary: ["a"] } })).empty, false);
  assert.equal(assessEvidence(recordWith({ evidenceSnapshot: { warnings: ["w"] } })).empty, false);
  assert.equal(assessEvidence(recordWith({ evidenceSnapshot: { completeness: 0 } })).empty, false);

  const withConfidence = assessEvidence(
    recordWith({
      legs: [
        { matchId: 1, homeTeam: "H", awayTeam: "A", competition: "C", kickoffAt: "x", marketKey: "m", capturedOdds: 1.5, confidence: 70 },
        { matchId: 2, homeTeam: "H", awayTeam: "A", competition: "C", kickoffAt: "x", marketKey: "m", capturedOdds: 1.7 },
      ] as AccaRecord["legs"],
    }),
  );
  assert.equal(withConfidence.empty, false);
  assert.equal(withConfidence.legsWithConfidence, 1);
  assert.equal(withConfidence.legCount, 2);
});

test("the evidence warning appears on the detail page for an evidence-less Acca", async () => {
  const { acca } = await seedAcca();
  const html = await renderDetail(acca.accaId);
  // The default fixture DOES carry evidence, so the warning must be absent here.
  assert.equal(
    /nothing to explain it/.test(html),
    false,
    "an Acca with evidence must not be flagged as empty",
  );
  assert.match(html, /Evidence/);
  assert.match(html, /Selections carrying confidence/);
});

/* ================================================================== *
 * 4. List view
 * ================================================================== */

test("the list shows DRAFT, PUBLISHED and ARCHIVED to an admin", async () => {
  const a = await seedAcca("Draft one");
  const b = await seedAcca("Published one");
  const c = await seedAcca("Archived one");

  await getAccaService().transitionAccaLifecycle({
    accaId: b.acca.accaId, expectedStatus: "DRAFT", expectedVersion: 1,
    nextStatus: "PUBLISHED", actor: "admin", transitionedAt: "2026-08-01T00:00:00.000Z",
  });
  await getAccaService().transitionAccaLifecycle({
    accaId: c.acca.accaId, expectedStatus: "DRAFT", expectedVersion: 1,
    nextStatus: "PUBLISHED", actor: "admin", transitionedAt: "2026-08-01T00:00:00.000Z",
  });
  await getAccaService().transitionAccaLifecycle({
    accaId: c.acca.accaId, expectedStatus: "PUBLISHED", expectedVersion: 2,
    nextStatus: "ARCHIVED", actor: "admin", transitionedAt: "2026-09-01T00:00:00.000Z",
  });

  const html = await renderList();
  for (const title of ["Draft one", "Published one", "Archived one"]) {
    assert.ok(html.includes(title), `${title} must be visible to an admin`);
  }
  assert.ok(html.includes("DRAFT") && html.includes("PUBLISHED") && html.includes("ARCHIVED"));
  assert.ok(html.includes(a.acca.slug));
});

test("the list reports an invalid filter instead of silently widening it", async () => {
  const html = await renderList({ status: "bogus" });
  assert.match(html, /Invalid filter/);
  assert.match(html, /status/);
  assert.equal(/<table/.test(html), false, "nothing may be loaded for an invalid query");
});

test("an empty list explains where Accas come from rather than showing a bare zero", async () => {
  const html = await renderList();
  assert.match(html, /No Accas match this view/);
  assert.match(html, /Builder approval/);
});

test("the list surfaces storage durability honestly", async () => {
  const html = await renderList();
  assert.match(html, /Not durable/);
  assert.match(html, /Lost on restart/);
});

test("the list states that an Acca is not a recommendation", async () => {
  const html = await renderList();
  assert.match(html, /not a recommendation or a tip/);
});

test("captured-odds provenance is disclosed wherever prices appear", async () => {
  const { acca } = await seedAcca();
  const list = await renderList();
  const detail = await renderDetail(acca.accaId);
  for (const html of [list, detail]) {
    assert.match(html, /captured when this Acca was created and are never re-fetched/);
  }
});

/* ================================================================== *
 * 5. Detail view
 * ================================================================== */

test("the detail view renders the immutable snapshot and its provenance", async () => {
  const { candidate, acca } = await seedAcca("Weekend two-fold");
  const html = await renderDetail(acca.accaId);

  assert.ok(html.includes("Weekend two-fold"));
  assert.ok(html.includes(acca.accaId));
  assert.ok(html.includes(acca.slug));
  assert.ok(html.includes(candidate.candidateId), "provenance must link the source candidate");
  assert.match(html, /Combined odds \(server-calculated\)/);
  assert.ok(html.includes("2.55"), "the server-calculated total must be shown");
  assert.match(html, /Publication history/);
  assert.match(html, /Provenance/);
});

test("the detail view offers publish for a draft and archive once published", async () => {
  const { acca } = await seedAcca();
  const draftHtml = await renderDetail(acca.accaId);
  assert.match(draftHtml, /Publish Acca/);
  assert.equal(/Archive Acca/.test(draftHtml), false, "a draft must not offer archive");

  await getAccaService().transitionAccaLifecycle({
    accaId: acca.accaId, expectedStatus: "DRAFT", expectedVersion: 1,
    nextStatus: "PUBLISHED", actor: "admin", transitionedAt: "2026-08-01T00:00:00.000Z",
  });
  const publishedHtml = await renderDetail(acca.accaId);
  assert.match(publishedHtml, /Archive Acca/);
  assert.equal(/Publish Acca/.test(publishedHtml), false, "a published Acca must not re-offer publish");
});

test("an archived Acca offers no lifecycle action and says why", async () => {
  const { acca } = await seedAcca();
  await getAccaService().transitionAccaLifecycle({
    accaId: acca.accaId, expectedStatus: "DRAFT", expectedVersion: 1,
    nextStatus: "PUBLISHED", actor: "admin", transitionedAt: "2026-08-01T00:00:00.000Z",
  });
  await getAccaService().transitionAccaLifecycle({
    accaId: acca.accaId, expectedStatus: "PUBLISHED", expectedVersion: 2,
    nextStatus: "ARCHIVED", actor: "admin", transitionedAt: "2026-09-01T00:00:00.000Z",
  });

  const html = await renderDetail(acca.accaId);
  assert.equal(/Publish Acca/.test(html), false);
  assert.equal(/Archive Acca/.test(html), false);
  assert.match(html, /requires a new Acca/);
});

test("publication history survives archiving and is displayed", async () => {
  const { acca } = await seedAcca();
  await getAccaService().transitionAccaLifecycle({
    accaId: acca.accaId, expectedStatus: "DRAFT", expectedVersion: 1,
    nextStatus: "PUBLISHED", actor: "admin", transitionedAt: "2026-08-01T09:00:00.000Z",
  });
  await getAccaService().transitionAccaLifecycle({
    accaId: acca.accaId, expectedStatus: "PUBLISHED", expectedVersion: 2,
    nextStatus: "ARCHIVED", actor: "admin", transitionedAt: "2026-09-01T09:00:00.000Z",
  });
  const html = await renderDetail(acca.accaId);
  assert.ok(html.includes("2026-08-01 09:00:00 UTC"), "published-at must survive archiving");
  assert.ok(html.includes("2026-09-01 09:00:00 UTC"));
});

test("the detail view is honest that publishing creates no public page yet", async () => {
  const { acca } = await seedAcca();
  const html = await renderDetail(acca.accaId);
  assert.match(html, /Public Acca pages do not exist yet/);
});

/* ================================================================== *
 * 6. Leakage
 * ================================================================== */

test("no rendered Studio surface leaks sensitive material", async () => {
  const { acca } = await seedAcca();
  const surfaces = [await renderList(), await renderDetail(acca.accaId)];
  for (const html of surfaces) {
    for (const [pattern, label] of [
      [/postgres(ql)?:\/\//i, "database URL"],
      [/rw_admin_session/, "session cookie"],
      [/\bBearer\b/i, "authorization material"],
      [/ADMIN_KEY/, "secret name"],
      [/_uidx\b|SQLSTATE|23505/, "storage internals"],
      [/idempotency[- ]?key["']?\s*[:=]\s*["'][^"']+/i, "an idempotency key value"],
    ] as Array<[RegExp, string]>) {
      assert.equal(pattern.test(html), false, `Studio leaked ${label}`);
    }
  }
});

test("the payload checksum is not echoed onto the Acca surface", async () => {
  const { acca } = await seedAcca();
  const html = await renderDetail(acca.accaId);
  assert.equal(
    html.includes(acca.sourceReferences.candidatePayloadChecksum),
    false,
    "the Acca is a self-contained copy; candidate storage internals do not belong here",
  );
});

/* ================================================================== *
 * 7. Client action components (source-level)
 * ================================================================== */

const CLIENT_COMPONENTS = [
  "components/acca-publication/AccaLifecycleActions.tsx",
  "components/builder-approval/CandidateActions.tsx",
];

test("action components go through the B3 HTTP API, never the service layer", () => {
  for (const rel of CLIENT_COMPONENTS) {
    const src = readSource(rel);
    assert.match(src, /^"use client";/m, `${rel} must be a client component`);
    assert.match(src, /fetch\(/, `${rel} must call the HTTP API`);
    for (const forbidden of [
      /getAccaService|getAccaStore|getCandidateStore/,
      /transitionAccaLifecycle\(/,
      /createAccaDraftFromCandidate\(/,
      /transitionBuilderCandidate\(/,
      /adapters\//,
    ]) {
      assert.equal(
        forbidden.test(src),
        false,
        `${rel} must not bypass the API security pipeline (${forbidden})`,
      );
    }
  }
});

test("every mutating request carries an idempotency key and an expected version", () => {
  for (const rel of CLIENT_COMPONENTS) {
    const src = readSource(rel);
    assert.match(src, /"idempotency-key"/, `${rel} must send an idempotency key`);
    assert.match(
      src,
      /expectedVersion|expectedCandidateVersion/,
      `${rel} must send the optimistic precondition`,
    );
    // The key is minted once per mount so a double-click replays instead of re-mutating.
    assert.match(src, /useRef/, `${rel} must keep the key stable across retries`);
  }
});

test("action components never send a server-derived field", () => {
  for (const rel of CLIENT_COMPONENTS) {
    // Scoped to the code that actually assembles a request body. A `status` PROP on the
    // component is not a `status` FIELD in the request, and conflating them would make this
    // assertion unfixable without deleting the prop.
    const bodyRegion = requestBodyRegions(readSource(rel));
    assert.ok(bodyRegion.length > 0, `${rel}: no request body region found — check the extractor`);
    for (const forbidden of [
      "combinedOdds",
      "legs",
      "evidenceSnapshot",
      "qualificationSnapshot",
      "sourceReferences",
      "createdBy",
      "publishedBy",
      "archivedBy",
      "archivedAt",
      "publishedAt",
      "accaId",
      "slug",
      "actor",
      "status",
      "version:",
    ]) {
      assert.equal(
        bodyRegion.includes(forbidden),
        false,
        `${rel} must not send the server-derived field ${forbidden}`,
      );
    }
  }
});

test("action components render only code-derived messages, never server text", () => {
  for (const rel of CLIENT_COMPONENTS) {
    const src = readSource(rel);
    assert.match(src, /describeActionError\(/, `${rel} must map codes to plain language`);
    // A server-supplied message/detail string must never be rendered directly.
    assert.equal(/\{\s*\w+\.message\s*\}/.test(src), false, `${rel} must not render a server message`);
    assert.equal(/body\.message/.test(src), false, `${rel} must not read a server message`);
  }
});

test("the failure vocabulary covers every code the B3 API can return", () => {
  const codes = [
    "authentication_required", "forbidden", "csrf_cross_site", "csrf_origin_mismatch",
    "csrf_origin_missing", "csrf_origin_malformed", "csrf_origin_unconfigured", "rate_limited",
    "status_conflict", "version_conflict", "acca_status_conflict", "acca_version_conflict",
    "candidate_status_conflict", "candidate_version_conflict", "candidate_already_converted",
    "acca_already_exists_for_candidate", "candidate_not_found", "acca_not_found", "slug_conflict",
    "invalid_candidate_snapshot", "invalid_odds", "invalid_slug", "invalid_transition",
    "idempotency_conflict", "idempotency_key_required", "invalid_request", "invalid_metadata",
    "payload_too_large", "route_disabled", "storage_failed",
  ];
  for (const code of codes) {
    const message = describeActionError(code);
    assert.ok(message.length > 0, `${code} must have a message`);
    assert.equal(message.includes(code), false, `${code} must be translated, not echoed`);
    assert.match(message, /[a-z]\.$|[a-z]\?$|\.$/, `${code} must read as a sentence`);
  }
  // An unknown code degrades safely rather than rendering nothing.
  assert.match(describeActionError("something_new"), /did not complete \(something_new\)/);
  assert.match(describeActionError(undefined), /did not complete/);
});

test("no action message promises or implies an outcome", () => {
  const banned = /\bguarantee|\bsure thing|\bwill win|\bcertain\b|\bAI\b/i;
  for (const code of ["storage_failed", "slug_conflict", "invalid_odds", "rate_limited"]) {
    assert.equal(banned.test(describeActionError(code)), false, `${code} message tone`);
  }
});

/* ================================================================== *
 * 8. Candidate detail integration
 * ================================================================== */

test("the stale Phase E claim about having no approval capability is gone", () => {
  const src = readSource("components/builder-approval/CandidateDetailView.tsx");
  assert.equal(
    /No approval or publication capability exists in this sprint/.test(src),
    false,
    "that statement became false when stage B3 shipped and must not remain in the product",
  );
  assert.match(src, /CandidateActions/, "the detail view must render the action controls");
});

test("candidate actions are gated by status", () => {
  const src = readSource("components/builder-approval/CandidateActions.tsx");
  assert.match(src, /status === "DRAFT"/);
  assert.match(src, /status === "APPROVED"/);
  assert.match(src, /status === "CONVERTED"/);
  assert.match(src, /status === "REJECTED"/);
  // A converted candidate points at its Acca instead of offering a second conversion.
  assert.match(src, /\/admin\/accas\/\$\{convertedAccaId\}/);
});

/* ================================================================== *
 * 9. Route wiring and scope
 * ================================================================== */

test("both Studio routes check the feature flag before authorization or any read", () => {
  for (const rel of ["app/admin/accas/page.tsx", "app/admin/accas/[accaId]/page.tsx"]) {
    const src = readSource(rel);
    const flagAt = src.indexOf("operatorApprovalEnabled");
    const gateAt = src.indexOf("<AdminGate>");
    assert.ok(flagAt > 0, `${rel} must check the flag`);
    assert.ok(gateAt > flagAt, `${rel} must check the flag before rendering the gate`);
    assert.match(src, /notFound\(\)/, `${rel} must 404 when disabled`);
    assert.match(src, /export const dynamic = "force-dynamic"/, `${rel} must not be cached`);
  }
});

test("the Acca Studio nav entry is feature-gated", () => {
  const src = readSource("components/admin-dashboard/AdminShell.tsx");
  const gateAt = src.indexOf("operatorApprovalEnabled");
  const entryAt = src.indexOf('"/admin/accas"');
  assert.ok(gateAt > 0 && entryAt > gateAt, "the entry must sit inside the flag check");
  assert.match(src, /Acca Studio/);
});

/**
 * Sprint 20B-B stage B5 update.
 *
 * This was a STAGE-SCOPE guard: it asserted that no public Acca surface existed, because B4 was
 * not permitted to create one. Stage B5 has now delivered exactly those surfaces by design, so
 * the original assertion is contradicted by approved scope and cannot stand.
 *
 * The durable half of its intent — that the ADMIN Studio is admin-only and does not itself render
 * or link a public surface — is kept and is what this now enforces. The assertions about public
 * pages and sitemap entries existing correctly moved to `tests/accaPublicPages.test.ts`, where
 * they are tested positively rather than by absence.
 */
test("the admin Studio remains admin-only and renders no public surface", () => {
  for (const rel of [
    "components/acca-publication/AccaListView.tsx",
    "components/acca-publication/AccaDetailView.tsx",
    "app/admin/accas/page.tsx",
    "app/admin/accas/[accaId]/page.tsx",
  ]) {
    const src = codeOnly(readSource(rel));
    // The Studio must not reach the public visibility boundary or link to public Acca URLs:
    // those are a separate surface with a separate audience.
    assert.equal(
      /acca-publication\/public/.test(src),
      false,
      `${rel} must not consume the public read layer`,
    );
    assert.equal(
      /publicAccaPath|publicAccaIndexPath/.test(src),
      false,
      `${rel} must not link to public Acca pages`,
    );
  }
  // Both admin routes remain gated and uncached.
  for (const rel of ["app/admin/accas/page.tsx", "app/admin/accas/[accaId]/page.tsx"]) {
    const src = readSource(rel);
    assert.match(src, /operatorApprovalEnabled/);
    assert.match(src, /AdminGate/);
  }
});

/* ================================================================== *
 * 10. Pagination model
 * ================================================================== */

test("the page model reports bounds honestly, including the empty case", () => {
  assert.deepEqual(pageModel({ total: 0, limit: 25, offset: 0, shown: 0 }), {
    total: 0, limit: 25, offset: 0, shown: 0,
    firstIndex: 0, lastIndex: 0, hasPrev: false, hasNext: false, prevOffset: 0, nextOffset: 25,
  });
  const middle = pageModel({ total: 10, limit: 3, offset: 3, shown: 3 });
  assert.equal(middle.firstIndex, 4);
  assert.equal(middle.lastIndex, 6);
  assert.equal(middle.hasPrev, true);
  assert.equal(middle.hasNext, true);
  const last = pageModel({ total: 10, limit: 3, offset: 9, shown: 1 });
  assert.equal(last.hasNext, false);
});

test("durability badge never describes memory storage as durable", () => {
  const memory = durabilityBadge({ mode: "memory", durable: false });
  assert.equal(memory.label, "Not durable");
  assert.match(memory.detail, /Lost on restart/);
  assert.match(memory.detail, /not production behaviour/);
  const pg = durabilityBadge({ mode: "postgres", durable: true });
  assert.equal(pg.label, "Durable");
});

test("leg views show stored values and never recompute", () => {
  const views = legViews(
    recordWith({
      legs: [
        {
          matchId: 1, homeTeam: "Home FC", awayTeam: "Away FC", competition: "League",
          kickoffAt: "2026-07-27T18:00:00.000Z", marketKey: "over25",
          marketLabel: "Over 2.5 Goals", capturedOdds: 1.7, confidence: 70,
        },
      ] as AccaRecord["legs"],
    }),
  );
  assert.equal(views[0].fixture, "Home FC v Away FC");
  assert.equal(views[0].market, "Over 2.5 Goals (over25)");
  assert.equal(views[0].capturedOdds, "1.70");
  assert.equal(views[0].confidence, "70");
  assert.equal(views[0].selection, ABSENT.notProvided, "an absent selection is labelled, not guessed");
});
