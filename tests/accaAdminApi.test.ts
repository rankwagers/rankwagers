import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { getCandidateStore } from "../lib/builder-approval/store";
import { FIXTURE_COMBINED_ODDS } from "./accaFixtures";
import * as approveRoute from "../app/api/admin/builder-approval/candidates/[candidateId]/approve/route";
import * as rejectRoute from "../app/api/admin/builder-approval/candidates/[candidateId]/reject/route";
import * as createAccaRoute from "../app/api/admin/builder-approval/candidates/[candidateId]/create-acca/route";
import * as accaListRoute from "../app/api/admin/accas/route";
import * as accaDetailRoute from "../app/api/admin/accas/[accaId]/route";
import * as publishRoute from "../app/api/admin/accas/[accaId]/publish/route";
import * as archiveRoute from "../app/api/admin/accas/[accaId]/archive/route";
import {
  assertAdminHeaders,
  assertNoLeak,
  expectError,
  clearLimiter,
  expectStatus,
  freshIdempotencyKey,
  getRequest,
  installTestEnv,
  postRequest,
  read,
  resetAll,
  seedApproved,
  seedDraft,
  url,
  type RequestOptions,
} from "./accaApiFixtures";

/**
 * Sprint 20B-B stage B3 — admin API behaviour.
 *
 * Route handlers are exercised end to end against the real B1 and B2 layers with the memory
 * adapters. The B2 atomic invariant is NOT mocked away: the create-acca test observes the real
 * candidate transition that the real store performed.
 */

installTestEnv();
beforeEach(resetAll);

/* ------------------------------------------------------------------ *
 * Callers
 * ------------------------------------------------------------------ */

const approve = (id: string, body: unknown, o: RequestOptions = {}) =>
  approveRoute.POST(postRequest(url.approve(id), body, o), { params: { candidateId: id } });
const reject = (id: string, body: unknown, o: RequestOptions = {}) =>
  rejectRoute.POST(postRequest(url.reject(id), body, o), { params: { candidateId: id } });
const createAcca = (id: string, body: unknown, o: RequestOptions = {}) =>
  createAccaRoute.POST(postRequest(url.createAcca(id), body, o), {
    params: { candidateId: id },
  });
const publish = (id: string, body: unknown, o: RequestOptions = {}) =>
  publishRoute.POST(postRequest(url.publish(id), body, o), { params: { accaId: id } });
const archive = (id: string, body: unknown, o: RequestOptions = {}) =>
  archiveRoute.POST(postRequest(url.archive(id), body, o), { params: { accaId: id } });
const getAcca = (id: string, o: RequestOptions = {}) =>
  accaDetailRoute.GET(getRequest(url.accaDetail(id), o), { params: { accaId: id } });
const listAccas = (query = "", o: RequestOptions = {}) =>
  accaListRoute.GET(getRequest(url.accaList(query), o));

/** Drive a candidate all the way to a DRAFT Acca through the real HTTP handlers. */
async function createAccaViaApi(title = "Weekend Value Treble") {
  const candidate = await seedApproved();
  const res = await read(
    await createAcca(candidate.candidateId, {
      expectedCandidateVersion: candidate.version,
      title,
      locale: "en",
    }),
  );
  expectStatus(res, 201, "createAccaViaApi");
  const acca = res.body.acca as Record<string, unknown>;
  return { candidate, acca, response: res };
}

/* ================================================================== *
 * 1. Candidate approve
 * ================================================================== */

test("approve moves DRAFT -> APPROVED and increments the version exactly once", async () => {
  const candidate = await seedDraft();
  const res = await read(await approve(candidate.candidateId, { expectedVersion: 1 }));

  expectStatus(res, 200);
  assertAdminHeaders(res);
  const updated = res.body.candidate as Record<string, unknown>;
  assert.equal(updated.status, "APPROVED");
  assert.equal(updated.version, 2);
  assert.equal(updated.statusActor, "admin", "actor must be server-derived");
  assert.ok(updated.statusChangedAt, "timestamp must be server-derived");
  assert.equal(updated.rejectionReason, null);

  const persisted = await getCandidateStore().getCandidate(candidate.candidateId);
  assert.equal(persisted?.status, "APPROVED");
  assert.equal(persisted?.version, 2, "exactly one increment");
});

test("approve rejects a missing, malformed or stale expectedVersion", async () => {
  const candidate = await seedDraft();
  for (const body of [{}, { expectedVersion: 0 }, { expectedVersion: "1" }, { expectedVersion: 1.5 }]) {
    const res = await read(await approve(candidate.candidateId, body));
    expectError(res, 400, "invalid_request");
    assert.equal(res.body.field, "expectedVersion");
  }

  const stale = await read(await approve(candidate.candidateId, { expectedVersion: 7 }));
  expectError(stale, 409, "version_conflict");
  assert.equal(stale.body.currentVersion, 1, "safe current metadata is echoed");
  assert.equal(stale.body.currentStatus, "DRAFT");

  const persisted = await getCandidateStore().getCandidate(candidate.candidateId);
  assert.equal(persisted?.version, 1, "no version drift from refused attempts");
});

test("approve on a non-DRAFT candidate is a status conflict", async () => {
  const candidate = await seedApproved();
  const res = await read(await approve(candidate.candidateId, { expectedVersion: 2 }));
  expectError(res, 409, "status_conflict");
  assert.equal(res.body.currentStatus, "APPROVED");
  assertNoLeak(res);
});

test("approve on a missing candidate is 404, and a malformed id is indistinguishable", async () => {
  expectError(await read(await approve("bpc_" + "0".repeat(32), { expectedVersion: 1 })), 404, "candidate_not_found");
  expectError(await read(await approve("not-an-id", { expectedVersion: 1 })), 404, "candidate_not_found");
});

test("approve rejects unknown and server-derived body keys", async () => {
  const candidate = await seedDraft();
  for (const [key, value] of [
    ["status", "APPROVED"],
    ["approvedBy", "someone"],
    ["approvedAt", "2026-01-01T00:00:00.000Z"],
    ["version", 5],
    ["actor", "root"],
    ["somethingElse", 1],
  ] as Array<[string, unknown]>) {
    const res = await read(
      await approve(candidate.candidateId, { expectedVersion: 1, [key]: value }),
    );
    expectError(res, 400, "invalid_request");
    assert.equal(res.body.field, key);
  }
  const persisted = await getCandidateStore().getCandidate(candidate.candidateId);
  assert.equal(persisted?.status, "DRAFT", "no rejected request may mutate");
});

/* ================================================================== *
 * 2. Candidate reject
 * ================================================================== */

test("reject moves DRAFT -> REJECTED and records the trimmed operator note", async () => {
  const candidate = await seedDraft();
  const res = await read(
    await reject(candidate.candidateId, {
      expectedVersion: 1,
      rejectionReason: "  Odds moved too far.  ",
    }),
  );
  expectStatus(res, 200);
  const updated = res.body.candidate as Record<string, unknown>;
  assert.equal(updated.status, "REJECTED");
  assert.equal(updated.version, 2);
  assert.equal(updated.rejectionReason, "Odds moved too far.", "must be trimmed");
  assert.equal(updated.statusActor, "admin");
});

test("reject requires a non-empty, bounded reason", async () => {
  const candidate = await seedDraft();
  const cases: Array<[unknown, string]> = [
    [undefined, "required_string"],
    [null, "required_string"],
    [42, "required_string"],
    ["", "empty"],
    ["   ", "empty"],
    ["x".repeat(501), "too_long"],
  ];
  for (const [reason, detail] of cases) {
    const body: Record<string, unknown> = { expectedVersion: 1 };
    if (reason !== undefined) body.rejectionReason = reason;
    const res = await read(await reject(candidate.candidateId, body));
    expectError(res, 400, "invalid_request");
    assert.equal(res.body.field, "rejectionReason");
    assert.equal(res.body.detail, detail, `reason=${String(reason)}`);
  }
  const persisted = await getCandidateStore().getCandidate(candidate.candidateId);
  assert.equal(persisted?.status, "DRAFT");
  assert.equal(persisted?.version, 1);
});

test("reject rejects server-derived keys", async () => {
  const candidate = await seedDraft();
  for (const key of ["status", "rejectedBy", "rejectedAt", "version"]) {
    const res = await read(
      await reject(candidate.candidateId, {
        expectedVersion: 1,
        rejectionReason: "no",
        [key]: "x",
      }),
    );
    expectError(res, 400, "invalid_request");
    assert.equal(res.body.field, key);
  }
});

/* ================================================================== *
 * 3. Candidate -> Acca creation
 * ================================================================== */

test("create-acca returns 201 with a safe summary and a server-derived snapshot", async () => {
  const { candidate, acca, response } = await createAccaViaApi();
  assertAdminHeaders(response);

  assert.match(String(acca.accaId), /^acca_[0-9a-f]{32}$/);
  assert.equal(acca.sourceCandidateId, candidate.candidateId, "cross-reference");
  assert.equal(acca.status, "DRAFT");
  assert.equal(acca.version, 1);
  assert.equal(acca.createdBy, "admin", "actor is server-derived");
  assert.equal(acca.combinedOdds, FIXTURE_COMBINED_ODDS, "odds are server-recomputed");
  assert.equal(acca.legCount, 2);
  assert.ok(String(acca.slug).length > 0);
  assert.equal(acca.publishedAt, null);
  assert.equal(acca.publishedBy, null);
  assert.equal(acca.archivedAt, null);
  assert.equal(acca.archivedBy, null);

  // The response is a summary, not an internal dump.
  for (const forbidden of ["payload", "payloadChecksum", "sourceReferences", "legs"]) {
    assert.equal(forbidden in acca, false, `create response must not include ${forbidden}`);
  }
});

test("create-acca performs the atomic B2 conversion, not a separate two-step write", async () => {
  const { candidate, acca } = await createAccaViaApi();
  // Observed on the REAL candidate store the route wrote through.
  const persisted = await getCandidateStore().getCandidate(candidate.candidateId);
  assert.equal(persisted?.status, "CONVERTED");
  assert.equal(persisted?.version, candidate.version + 1, "exactly one increment");
  assert.equal(persisted?.convertedAccaId, acca.accaId, "candidate points at the created Acca");
  assert.equal(persisted?.statusActor, "admin");
});

test("create-acca maps every domain failure to the specified status", async () => {
  // Each scenario below is an independent create attempt; the 5/min create limit is asserted
  // in the rate-limit suite and must not throttle this mapping test.
  const scenario = () => clearLimiter();
  scenario();
  // candidate not found
  expectError(
    await read(await createAcca("bpc_" + "0".repeat(32), { expectedCandidateVersion: 1, title: "T", locale: "en" })),
    404,
    "candidate_not_found",
  );

  // candidate not APPROVED
  scenario();
  const draft = await seedDraft();
  expectError(
    await read(await createAcca(draft.candidateId, { expectedCandidateVersion: 1, title: "T", locale: "en" })),
    409,
    "candidate_status_conflict",
  );

  // stale candidate version
  scenario();
  const approved = await seedApproved();
  const stale = await read(
    await createAcca(approved.candidateId, { expectedCandidateVersion: 1, title: "T", locale: "en" }),
  );
  expectError(stale, 409, "candidate_version_conflict");
  assert.equal(stale.body.currentVersion, 2);

  // already converted
  scenario();
  const { candidate } = await createAccaViaApi("First Acca");
  const again = await read(
    await createAcca(candidate.candidateId, {
      expectedCandidateVersion: 3,
      title: "Second Acca",
      locale: "en",
    }),
  );
  expectError(again, 409, "candidate_already_converted");
  assert.ok(again.body.existingAccaId, "must name the existing Acca");

  // invalid metadata -> 400
  scenario();
  const another = await seedApproved();
  const badLocale = await read(
    await createAcca(another.candidateId, {
      expectedCandidateVersion: another.version,
      title: "T",
      locale: "not-a-locale",
    }),
  );
  expectError(badLocale, 400, "invalid_metadata");
  assert.equal(badLocale.body.field, "locale");
});

test("create-acca rejects a duplicate slug with 409", async () => {
  const a = await seedApproved();
  const b = await seedApproved();
  const first = await read(
    await createAcca(a.candidateId, {
      expectedCandidateVersion: a.version,
      title: "Shared Title",
      locale: "en",
      slugDiscriminator: "fixed",
    }),
  );
  expectStatus(first, 201);

  const second = await read(
    await createAcca(b.candidateId, {
      expectedCandidateVersion: b.version,
      title: "Shared Title",
      locale: "en",
      slugDiscriminator: "fixed",
    }),
  );
  expectError(second, 409, "slug_conflict");
  assertNoLeak(second);

  // The losing candidate was not converted.
  const persisted = await getCandidateStore().getCandidate(b.candidateId);
  assert.equal(persisted?.status, "APPROVED");
  assert.equal(persisted?.version, b.version);
});

test("create-acca rejects every server-derived field", async () => {
  const candidate = await seedApproved();
  for (const key of [
    "accaId",
    "combinedOdds",
    "legs",
    "evidenceSnapshot",
    "qualificationSnapshot",
    "sourceReferences",
    "status",
    "version",
    "createdBy",
    "createdAt",
    "publishedAt",
    "archivedBy",
    "slug",
  ]) {
    clearLimiter();
    const res = await read(
      await createAcca(candidate.candidateId, {
        expectedCandidateVersion: candidate.version,
        title: "T",
        locale: "en",
        [key]: "injected",
      }),
    );
    expectError(res, 400, "invalid_request");
    assert.equal(res.body.field, key);
    assert.equal(res.body.detail, "server_derived_field", `${key} detail`);
  }
  const persisted = await getCandidateStore().getCandidate(candidate.candidateId);
  assert.equal(persisted?.status, "APPROVED", "no injection attempt may mutate");
});

test("create-acca validates title, summary and locale", async () => {
  const candidate = await seedApproved();
  const cases: Array<[Record<string, unknown>, string]> = [
    [{ title: "" }, "title"],
    [{ title: "x".repeat(200) }, "title"],
    [{ title: 42 }, "title"],
    [{ summary: "" }, "summary"],
    [{ summary: "y".repeat(500) }, "summary"],
    [{ locale: "english" }, "locale"],
  ];
  for (const [over, field] of cases) {
    clearLimiter();
    const res = await read(
      await createAcca(candidate.candidateId, {
        expectedCandidateVersion: candidate.version,
        title: "Valid Title",
        locale: "en",
        ...over,
      }),
    );
    expectError(res, 400, "invalid_metadata");
    assert.equal(res.body.field, field, JSON.stringify(over));
  }
});

/* ================================================================== *
 * 4. Acca publish / archive
 * ================================================================== */

test("publish moves DRAFT -> PUBLISHED and sets only publication metadata", async () => {
  const { acca } = await createAccaViaApi();
  const res = await read(await publish(String(acca.accaId), { expectedVersion: 1 }));
  expectStatus(res, 200);
  assertAdminHeaders(res);

  const published = res.body.acca as Record<string, unknown>;
  assert.equal(published.status, "PUBLISHED");
  assert.equal(published.version, 2, "exactly one increment");
  assert.ok(published.publishedAt);
  assert.equal(published.publishedBy, "admin");
  assert.equal(published.archivedAt, null);
  assert.equal(published.archivedBy, null);
  assert.notEqual(published.updatedAt, acca.updatedAt, "updatedAt must move");

  // Immutable snapshot fields are byte-identical.
  for (const field of ["accaId", "sourceCandidateId", "title", "slug", "combinedOdds", "locale", "createdAt", "createdBy"]) {
    assert.deepEqual(published[field], acca[field], `${field} must be immutable`);
  }
});

test("archive moves PUBLISHED -> ARCHIVED and preserves publication metadata", async () => {
  const { acca } = await createAccaViaApi();
  const published = (await read(await publish(String(acca.accaId), { expectedVersion: 1 })))
    .body.acca as Record<string, unknown>;

  const res = await read(await archive(String(acca.accaId), { expectedVersion: 2 }));
  expectStatus(res, 200);
  const archived = res.body.acca as Record<string, unknown>;
  assert.equal(archived.status, "ARCHIVED");
  assert.equal(archived.version, 3);
  assert.ok(archived.archivedAt);
  assert.equal(archived.archivedBy, "admin");
  assert.equal(archived.publishedAt, published.publishedAt, "publication history survives");
  assert.equal(archived.publishedBy, "admin");
  assert.equal(archived.combinedOdds, acca.combinedOdds, "snapshot is immutable");
});

test("archiving a DRAFT is refused, and the draft does not move", async () => {
  const { acca } = await createAccaViaApi();
  const res = await read(await archive(String(acca.accaId), { expectedVersion: 1 }));
  expectError(res, 409, "acca_status_conflict");
  assert.equal(res.body.currentStatus, "DRAFT");

  const after = await read(await getAcca(String(acca.accaId)));
  assert.equal((after.body.acca as Record<string, unknown>).status, "DRAFT");
  assert.equal((after.body.acca as Record<string, unknown>).version, 1);
  assert.equal((after.body.acca as Record<string, unknown>).archivedAt, null);
});

test("republishing an archived Acca is refused", async () => {
  const { acca } = await createAccaViaApi();
  await publish(String(acca.accaId), { expectedVersion: 1 });
  await archive(String(acca.accaId), { expectedVersion: 2 });

  const res = await read(await publish(String(acca.accaId), { expectedVersion: 3 }));
  expectError(res, 409, "acca_status_conflict");
  assert.equal(res.body.currentStatus, "ARCHIVED");
});

test("publish rejects a stale version and lifecycle keys", async () => {
  const { acca } = await createAccaViaApi();
  const stale = await read(await publish(String(acca.accaId), { expectedVersion: 99 }));
  expectError(stale, 409, "acca_version_conflict");
  assert.equal(stale.body.currentVersion, 1);

  for (const key of ["status", "publishedAt", "publishedBy", "archivedAt", "archivedBy"]) {
    const res = await read(
      await publish(String(acca.accaId), { expectedVersion: 1, [key]: "x" }),
    );
    expectError(res, 400, "invalid_request");
    assert.equal(res.body.field, key);
  }

  const after = await read(await getAcca(String(acca.accaId)));
  assert.equal((after.body.acca as Record<string, unknown>).version, 1, "no drift");
});

test("publish and archive on a missing Acca are 404", async () => {
  const ghost = "acca_" + "a".repeat(32);
  expectError(await read(await publish(ghost, { expectedVersion: 1 })), 404, "acca_not_found");
  expectError(await read(await archive(ghost, { expectedVersion: 1 })), 404, "acca_not_found");
  expectError(await read(await publish("nope", { expectedVersion: 1 })), 404, "acca_not_found");
});

/* ================================================================== *
 * 5. Admin reads
 * ================================================================== */

test("GET by id returns the full detail view for an authorized admin", async () => {
  const { candidate, acca } = await createAccaViaApi();
  const res = await read(await getAcca(String(acca.accaId)));
  expectStatus(res, 200);
  assertAdminHeaders(res);

  const detail = res.body.acca as Record<string, unknown>;
  assert.equal(detail.accaId, acca.accaId);
  assert.equal(detail.status, "DRAFT");
  assert.equal((detail.legs as unknown[]).length, 2);
  assert.equal((detail.sourceReferences as Record<string, unknown>).candidateId, candidate.candidateId);
  assert.ok(detail.qualificationSnapshot);
  assert.equal(res.body.ok, true);
  // Storage honesty is surfaced, not hidden.
  assert.equal((res.body.storage as Record<string, unknown>).durable, false);
});

test("GET by id is 404 for a missing or malformed id", async () => {
  expectError(await read(await getAcca("acca_" + "b".repeat(32))), 404, "acca_not_found");
  expectError(await read(await getAcca("not-an-acca-id")), 404, "acca_not_found");
});

test("admin list returns DRAFT, PUBLISHED and ARCHIVED alike", async () => {
  const draft = (await createAccaViaApi("Draft One")).acca;
  const toPublish = (await createAccaViaApi("Published One")).acca;
  const toArchive = (await createAccaViaApi("Archived One")).acca;

  await publish(String(toPublish.accaId), { expectedVersion: 1 });
  await publish(String(toArchive.accaId), { expectedVersion: 1 });
  await archive(String(toArchive.accaId), { expectedVersion: 2 });

  const res = await read(await listAccas());
  expectStatus(res, 200);
  assertAdminHeaders(res);
  const rows = res.body.accas as Array<Record<string, unknown>>;
  assert.equal(res.body.total, 3);
  const statuses = new Set(rows.map((r) => r.status));
  assert.deepEqual([...statuses].sort(), ["ARCHIVED", "DRAFT", "PUBLISHED"]);
  assert.ok(rows.some((r) => r.accaId === draft.accaId), "a DRAFT must be visible to admin");

  // Admin retrieval is NOT public visibility. Nothing here publishes a page.
  assert.equal("public" in res.body, false);
});

test("admin list filters and paginates deterministically", async () => {
  const a = (await createAccaViaApi("Alpha")).acca;
  const b = (await createAccaViaApi("Beta")).acca;
  await createAccaViaApi("Gamma");
  await publish(String(b.accaId), { expectedVersion: 1 });

  const drafts = await read(await listAccas("?status=DRAFT"));
  expectStatus(drafts, 200);
  assert.equal(drafts.body.total, 2);

  const published = await read(await listAccas("?status=PUBLISHED"));
  assert.equal(published.body.total, 1);
  assert.equal((published.body.accas as Array<Record<string, unknown>>)[0].accaId, b.accaId);

  const byCandidate = await read(
    await listAccas(`?sourceCandidateId=${String(a.sourceCandidateId)}`),
  );
  assert.equal(byCandidate.body.total, 1);

  const byLocale = await read(await listAccas("?locale=en"));
  assert.equal(byLocale.body.total, 3);

  // Pagination is bounded and non-overlapping, with stable ordering across calls.
  const page1 = await read(await listAccas("?limit=2&offset=0"));
  const page2 = await read(await listAccas("?limit=2&offset=2"));
  assert.equal(page1.body.limit, 2);
  assert.equal(page1.body.offset, 0);
  const ids = [
    ...(page1.body.accas as Array<Record<string, unknown>>).map((r) => r.accaId),
    ...(page2.body.accas as Array<Record<string, unknown>>).map((r) => r.accaId),
  ];
  assert.equal(new Set(ids).size, 3, "pages must not overlap");

  const repeat = await read(await listAccas("?limit=2&offset=0"));
  assert.deepEqual(
    (repeat.body.accas as Array<Record<string, unknown>>).map((r) => r.accaId),
    (page1.body.accas as Array<Record<string, unknown>>).map((r) => r.accaId),
    "ordering must be stable",
  );
});

test("admin list rejects invalid queries instead of silently clamping", async () => {
  const cases: Array<[string, string]> = [
    ["?status=bogus", "status"],
    ["?locale=english", "locale"],
    ["?limit=0", "limit"],
    ["?limit=99999", "limit"],
    ["?limit=abc", "limit"],
    ["?offset=-1", "offset"],
    ["?createdAfter=yesterday", "createdAfter"],
    ["?publishedBefore=2026-01-01", "publishedBefore"],
    ["?sortBy=title", "sortBy"],
    ["?orderBy=combined_odds", "orderBy"],
  ];
  for (const [query, field] of cases) {
    const res = await read(await listAccas(query));
    expectError(res, 400, "invalid_request");
    assert.equal(res.body.field, field, query);
  }
});

test("date-range filters narrow the set", async () => {
  const { acca } = await createAccaViaApi("Ranged");
  const created = String(acca.createdAt);
  const before = new Date(Date.parse(created) - 60_000).toISOString();
  const after = new Date(Date.parse(created) + 60_000).toISOString();

  const inside = await read(await listAccas(`?createdAfter=${before}&createdBefore=${after}`));
  assert.equal(inside.body.total, 1);

  const outside = await read(await listAccas(`?createdAfter=${after}`));
  assert.equal(outside.body.total, 0);

  const publishedOnly = await read(await listAccas(`?publishedAfter=${before}`));
  assert.equal(publishedOnly.body.total, 0, "a DRAFT has no publishedAt");
});

test("the list endpoint states its idempotency durability honestly", async () => {
  const res = await read(await listAccas());
  const idem = res.body.idempotency as Record<string, unknown>;
  assert.equal(idem.mode, "memory");
  assert.equal(idem.durable, false);
  assert.equal(idem.processLocal, true);
  assert.equal(idem.crossProcessReplayProtection, false);
});

/* ================================================================== *
 * 6. Body handling
 * ================================================================== */

test("malformed bodies are refused consistently", async () => {
  const candidate = await seedDraft();
  const id = candidate.candidateId;

  const cases: Array<[RequestOptions, number]> = [
    [{ bodyText: "{not json" }, 400],
    [{ bodyText: "[1,2,3]" }, 400],
    [{ bodyText: "null" }, 400],
    [{ bodyText: '{"__proto__":{"polluted":true}}' }, 400],
    [{ contentType: "text/plain", bodyText: "{}" }, 415],
    [{ contentType: null, bodyText: "{}" }, 415],
    [{ bodyText: JSON.stringify({ expectedVersion: 1, pad: "x".repeat(200_000) }) }, 413],
  ];
  for (const [options, status] of cases) {
    const res = await read(await approve(id, undefined, { ...options, idempotencyKey: freshIdempotencyKey() }));
    expectStatus(res, status, JSON.stringify(options).slice(0, 80));
    assert.equal(res.body.ok, false);
    assertNoLeak(res);
  }

  // An empty body parses to {} and then fails on the missing expectedVersion, not on parsing.
  const empty = await read(await approve(id, undefined, { bodyText: "" }));
  expectError(empty, 400, "invalid_request");
  assert.equal(empty.body.field, "expectedVersion");

  assert.equal((await getCandidateStore().getCandidate(id))?.status, "DRAFT");
});

test("prototype-pollution keys never reach the domain", async () => {
  const candidate = await seedDraft();
  for (const raw of [
    '{"expectedVersion":1,"constructor":{"x":1}}',
    '{"expectedVersion":1,"prototype":{"x":1}}',
  ]) {
    const res = await read(
      await approve(candidate.candidateId, undefined, { bodyText: raw }),
    );
    expectError(res, 400, "invalid_request");
  }
  assert.equal(
    ({} as Record<string, unknown>).polluted,
    undefined,
    "Object.prototype must be clean",
  );
  assert.equal((await getCandidateStore().getCandidate(candidate.candidateId))?.status, "DRAFT");
});
