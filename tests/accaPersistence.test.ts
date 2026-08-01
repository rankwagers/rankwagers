import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  ACCA_CREATE_ALLOWED_KEYS,
  ACCA_CREATE_REJECTED_KEYS,
  ACCA_LIMITS,
  ACCA_SCHEMA_VERSION,
  ACCA_SERVICE_FAILURE_CODES,
} from "../lib/acca-publication/contracts";
import type { BuilderPublicationCandidate } from "../lib/builder-approval/contracts";
import { mapCandidateToAccaSnapshot } from "../lib/acca-publication/mapper";
import { isAccaId, mintAccaId, slugDiscriminatorFor } from "../lib/acca-publication/identifiers";
import { isPubliclyVisible } from "../lib/acca-publication/lifecycle";
import {
  ACCA_LIST_DEFAULT_LIMIT,
  ACCA_LIST_MAX_LIMIT,
  parseAccaListFilters,
} from "../lib/acca-publication/filters";
import {
  FIXTURE_COMBINED_ODDS,
  candidateBody,
  createHarness,
  createRequest,
  failureWithCode,
  leg,
  listFilters,
  seedApprovedCandidate,
  success,
} from "./accaFixtures";

/**
 * Sprint 20B-B stage B2 — Acca persistence.
 *
 * Store contract surface, snapshot mapping, retrieval, listing, clone/freeze semantics and
 * the service validation boundary. Atomic conversion, concurrency, lifecycle persistence and
 * PostgreSQL structure live in their own clearly named suites.
 */

const root = process.cwd();
const readSource = (rel: string) => readFileSync(path.join(root, rel), "utf8");

/* ================================================================== *
 * 1. Store contract surface
 * ================================================================== */

const APPROVED_STORE_OPERATIONS = [
  "storageMode",
  "durable",
  "createDraftFromCandidate",
  "getAccaById",
  "getAccaBySlug",
  "listAccas",
  "transitionAccaStatus",
];

/**
 * Operations that must NOT exist. An arbitrary write would let a caller edit a published
 * snapshot, and a per-action `publishAcca` would create a second, unguarded path to a
 * lifecycle change that bypasses the expected-status/expected-version precondition.
 */
const FORBIDDEN_STORE_OPERATIONS = [
  "updateAcca",
  "patchAcca",
  "saveAcca",
  "setAcca",
  "deleteAcca",
  "publishAcca",
  "archiveAcca",
];

test("memory store exposes exactly the approved contract surface", () => {
  const { accaStore } = createHarness();
  const keys = Object.keys(accaStore).filter((k) => !k.startsWith("__"));
  assert.deepEqual(keys.sort(), [...APPROVED_STORE_OPERATIONS].sort());
});

test("no arbitrary update or delete operation exists on any adapter", () => {
  const { accaStore } = createHarness();
  for (const forbidden of FORBIDDEN_STORE_OPERATIONS) {
    assert.equal(
      forbidden in accaStore,
      false,
      `memory adapter must not expose ${forbidden}`,
    );
  }

  // Source-level too, so a future adapter cannot reintroduce one and pass by not being
  // instantiated here. The contract file names them only inside its prose invariant, so the
  // check targets declarations rather than any mention.
  for (const rel of [
    "lib/acca-publication/store.ts",
    "lib/acca-publication/adapters/memory.ts",
    "lib/acca-publication/adapters/postgres.ts",
  ]) {
    const src = readSource(rel);
    for (const forbidden of FORBIDDEN_STORE_OPERATIONS) {
      assert.equal(
        new RegExp(`(async\\s+)?${forbidden}\\s*[(:]`).test(src),
        false,
        `${rel} must not declare ${forbidden}`,
      );
    }
  }
});

test("fault hooks are dependency-injected, never public store methods", () => {
  const { accaStore } = createHarness({ faults: { beforeAccaInsertion: () => {} } });
  for (const key of Object.keys(accaStore)) {
    assert.equal(key.startsWith("faults"), false, `store must not expose ${key}`);
  }
  assert.equal("faults" in accaStore, false);
  assert.equal("__faults" in accaStore, false);
});

test("memory adapter is never reported as durable", () => {
  const { accaStore } = createHarness();
  assert.equal(accaStore.storageMode, "memory");
  assert.equal(accaStore.durable, false);
});

/* ================================================================== *
 * 2. Candidate -> Acca snapshot mapper
 * ================================================================== */

/** A mutable candidate, so the detachment test can actually mutate the source. */
function mutableCandidate(over: Record<string, unknown> = {}): BuilderPublicationCandidate {
  const body = candidateBody();
  return {
    schemaVersion: "20b-a.1.0.0",
    candidateId: "cand_mutable",
    status: "APPROVED",
    actor: "admin",
    createdAt: "2026-07-26T10:00:00.000Z",
    sourceRequestId: "req_x",
    sourceSnapshotId: "snap_x",
    sourceDate: "2026-07-26",
    sourceBuilderConfig: { locale: "en", riskMode: "balanced" },
    payload: body.payload as BuilderPublicationCandidate["payload"],
    payloadChecksum: "checksum-x",
    checksumVersion: "1",
    storageMode: "memory",
    version: 2,
    statusChangedAt: "2026-07-26T11:00:00.000Z",
    statusActor: "admin",
    rejectionReason: null,
    convertedAccaId: null,
    ...over,
  } as BuilderPublicationCandidate;
}

test("mapper never spreads the candidate and maps every field explicitly", () => {
  const src = readSource("lib/acca-publication/mapper.ts");
  assert.equal(/\.\.\.\s*candidate\b/.test(src), false, "must not spread the candidate");
  assert.equal(/\.\.\.\s*raw\b/.test(src), false, "must not spread a raw leg");
  assert.equal(/\.\.\.\s*payload\b/.test(src), false, "must not spread the payload");
  assert.equal(/\.\.\.\s*combination\b/.test(src), false, "must not spread the combination");
});

test("mapper recomputes combined odds and ignores the candidate total", () => {
  const mapped = success(mapCandidateToAccaSnapshot(mutableCandidate()));
  // The fixture carries combinedOdds: 999.99. The published value is the recomputed product.
  assert.equal(mapped.snapshot.combinedOdds, FIXTURE_COMBINED_ODDS);
  assert.notEqual(mapped.snapshot.combinedOdds, 999.99);
  assert.equal(mapped.snapshot.schemaVersion, ACCA_SCHEMA_VERSION);
});

test("a stale or hostile candidate total cannot influence the stored Acca", async () => {
  for (const hostile of [0, -1, 1e308, Number.NaN, "2.55", null, 1_000_000_000]) {
    const body = candidateBody();
    const combination = (body.payload as { combination: Record<string, unknown> }).combination;
    combination.combinedOdds = hostile as never;
    const candidate = mutableCandidate({
      payload: body.payload as BuilderPublicationCandidate["payload"],
    });
    const mapped = success(mapCandidateToAccaSnapshot(candidate));
    assert.equal(
      mapped.snapshot.combinedOdds,
      FIXTURE_COMBINED_ODDS,
      `hostile total ${String(hostile)} leaked into the snapshot`,
    );
  }
});

test("a leg missing any required field is rejected outright", () => {
  const required = [
    "matchId",
    "homeTeam",
    "awayTeam",
    "competition",
    "kickoffAt",
    "marketKey",
    "odds",
  ];
  for (const field of required) {
    const broken = leg();
    delete (broken as Record<string, unknown>)[field];
    const body = candidateBody();
    const combination = (body.payload as { combination: Record<string, unknown> }).combination;
    combination.legs = [broken, leg({ id: "c2", matchId: 502, odds: 1.5 })];
    const result = mapCandidateToAccaSnapshot(
      mutableCandidate({ payload: body.payload as BuilderPublicationCandidate["payload"] }),
    );
    const failed = failure(result);
    assert.ok(
      failed.code === "invalid_leg" || failed.code === "odds_missing",
      `missing ${field} must be rejected, got ${failed.code}`,
    );
    assert.equal(failed.legIndex, 0, `missing ${field} must report the offending leg`);
  }
});

function failure<T extends { ok: boolean }>(result: T) {
  assert.equal(result.ok, false, `expected failure, got ${JSON.stringify(result)}`);
  return result as Extract<T, { ok: false }> & { code: string; legIndex?: number };
}

test("optional leg metadata is preserved only when the source supplied it", () => {
  const withOptional = success(mapCandidateToAccaSnapshot(mutableCandidate()));
  assert.equal(withOptional.snapshot.legs[0].marketLabel, "Over 2.5 Goals");
  assert.equal(withOptional.snapshot.legs[0].confidence, 70);
  assert.equal(withOptional.snapshot.legs[0].sourceLegId, "c1");

  const body = candidateBody();
  const combination = (body.payload as { combination: Record<string, unknown> }).combination;
  combination.legs = [
    leg({ marketLabel: undefined, confidence: undefined, id: undefined }),
    leg({ id: "c2", matchId: 502, odds: 1.5, marketLabel: undefined, confidence: undefined }),
  ];
  const without = success(
    mapCandidateToAccaSnapshot(
      mutableCandidate({ payload: body.payload as BuilderPublicationCandidate["payload"] }),
    ),
  );
  assert.equal("marketLabel" in without.snapshot.legs[0], false);
  assert.equal("confidence" in without.snapshot.legs[0], false);
  assert.equal("sourceLegId" in without.snapshot.legs[0], false);
});

test("the snapshot is fully detached: mutating the candidate cannot alter it", () => {
  const candidate = mutableCandidate();
  const mapped = success(mapCandidateToAccaSnapshot(candidate));
  const before = JSON.stringify(mapped.snapshot);

  // Mutate every reachable part of the source candidate.
  const payload = candidate.payload as Record<string, Record<string, unknown>>;
  const combination = payload.combination;
  (combination.legs as Record<string, unknown>[])[0].homeTeam = "MUTATED FC";
  (combination.legs as Record<string, unknown>[])[0].odds = 99;
  (combination.legs as Record<string, unknown>[]).push(leg({ id: "c9" }));
  combination.limitations = ["MUTATED"];
  combination.correlationWarnings = ["MUTATED"];
  (candidate.sourceBuilderConfig as Record<string, unknown>).riskMode = "MUTATED";

  assert.equal(JSON.stringify(mapped.snapshot), before, "snapshot must be byte-identical");
  assert.equal(mapped.snapshot.legs[0].homeTeam, "Home FC");
  assert.equal(mapped.snapshot.legs.length, 2);
  assert.equal(mapped.snapshot.combinedOdds, FIXTURE_COMBINED_ODDS);
});

test("source references carry identifiers and the candidate checksum, not live data", () => {
  const mapped = success(mapCandidateToAccaSnapshot(mutableCandidate()));
  assert.deepEqual(mapped.snapshot.sourceReferences, {
    candidateId: "cand_mutable",
    sourceRequestId: "req_x",
    sourceSnapshotId: "snap_x",
    sourceDate: "2026-07-26",
    candidatePayloadChecksum: "checksum-x",
    candidateChecksumVersion: "1",
  });
});

/* ================================================================== *
 * 3. Identity and slug derivation
 * ================================================================== */

test("Acca ids are prefixed 128-bit CSPRNG hex and never title-derived", () => {
  const ids = new Set<string>();
  for (let i = 0; i < 500; i++) {
    const id = mintAccaId();
    assert.ok(isAccaId(id), `${id} must match the id contract`);
    assert.equal(id.length, "acca_".length + 32);
    assert.equal(ids.has(id), false, "minted ids must not repeat");
    ids.add(id);
  }
  assert.equal(isAccaId("acca_"), false);
  assert.equal(isAccaId("acca_ABCDEF0123456789ABCDEF0123456789"), false, "must be lowercase");
  assert.equal(isAccaId(null), false);
});

test("the slug discriminator is stable for a given Acca id", () => {
  const id = mintAccaId();
  assert.equal(slugDiscriminatorFor(id), slugDiscriminatorFor(id));
  assert.equal(slugDiscriminatorFor(id).length, 8);
});

/* ================================================================== *
 * 4. Creation, retrieval and clone/freeze semantics
 * ================================================================== */

test("a created draft is retrievable by id and by slug", async () => {
  const h = createHarness();
  const candidate = await seedApprovedCandidate(h.candidateStore);
  const created = success(
    await h.service.createAccaDraftFromCandidate(createRequest(candidate)),
  );

  const byId = success(await h.service.getAcca(created.acca.accaId));
  assert.deepEqual(byId.acca, created.acca);

  const bySlug = success(await h.service.getAccaBySlug(created.acca.slug));
  assert.equal(bySlug.acca.accaId, created.acca.accaId);
});

test("missing records report acca_not_found, malformed input reports invalid_metadata", async () => {
  const h = createHarness();
  failureWithCode(await h.service.getAcca(mintAccaId()), "acca_not_found");
  failureWithCode(await h.service.getAccaBySlug("no-such-slug"), "acca_not_found");
  failureWithCode(await h.service.getAcca("not-an-acca-id"), "invalid_metadata");
  failureWithCode(await h.service.getAccaBySlug("Not A Slug"), "invalid_metadata");
});

test("returned records are frozen deep clones that cannot corrupt stored state", async () => {
  const h = createHarness();
  const candidate = await seedApprovedCandidate(h.candidateStore);
  const created = success(
    await h.service.createAccaDraftFromCandidate(createRequest(candidate)),
  );

  const first = success(await h.service.getAcca(created.acca.accaId)).acca;
  assert.ok(Object.isFrozen(first), "record must be frozen");
  assert.ok(Object.isFrozen(first.legs), "legs array must be frozen");
  assert.ok(Object.isFrozen(first.legs[0]), "each leg must be frozen");
  assert.ok(Object.isFrozen(first.sourceReferences));

  // Attempt to corrupt the returned record. NOTE: the test module is transpiled to CommonJS
  // without "use strict", so a write to a frozen object silently no-ops here rather than
  // throwing a TypeError. The guarantee under test is "stored state cannot be corrupted", so
  // it is asserted by observing the values — which holds in both strict and sloppy mode —
  // instead of by asserting an exception that depends on how the harness transpiles.
  (first as unknown as Record<string, unknown>).title = "hijacked";
  (first.legs as unknown as Record<string, unknown>[])[0].homeTeam = "hijacked";
  (first.sourceReferences as unknown as Record<string, unknown>).candidateId = "hijacked";
  assert.equal(first.title, created.acca.title, "the frozen copy itself must not change");
  assert.equal(first.legs[0].homeTeam, "Home FC");
  assert.equal(first.sourceReferences.candidateId, created.acca.sourceReferences.candidateId);

  const second = success(await h.service.getAcca(created.acca.accaId)).acca;
  assert.equal(second.title, created.acca.title);
  assert.equal(second.legs[0].homeTeam, "Home FC");
  assert.notEqual(first, second, "each read must return a distinct clone");
});

test("two reads return independent clones", async () => {
  const h = createHarness();
  const candidate = await seedApprovedCandidate(h.candidateStore);
  const created = success(
    await h.service.createAccaDraftFromCandidate(createRequest(candidate)),
  );
  const a = success(await h.service.getAcca(created.acca.accaId)).acca;
  const b = success(await h.service.getAcca(created.acca.accaId)).acca;
  assert.notEqual(a, b);
  assert.notEqual(a.legs, b.legs);
  assert.deepEqual(a, b);
});

/* ================================================================== *
 * 5. Service validation boundary
 * ================================================================== */

test("every server-derived field is rejected, never silently ignored", async () => {
  const h = createHarness();
  const candidate = await seedApprovedCandidate(h.candidateStore);
  for (const key of ACCA_CREATE_REJECTED_KEYS) {
    const request = { ...createRequest(candidate), [key]: "anything" };
    const failed = failureWithCode(
      await h.service.createAccaDraftFromCandidate(request as never),
      "invalid_metadata",
    );
    assert.equal(failed.field, key);
    assert.equal(failed.detail, "server_derived_field_supplied");
  }
});

test("a server-derived key present as undefined is still rejected", async () => {
  const h = createHarness();
  const candidate = await seedApprovedCandidate(h.candidateStore);
  const request = { ...createRequest(candidate), combinedOdds: undefined };
  const failed = failureWithCode(
    await h.service.createAccaDraftFromCandidate(request as never),
    "invalid_metadata",
  );
  assert.equal(failed.field, "combinedOdds");
});

test("allowed and rejected key sets are disjoint and cover the record shape", () => {
  const allowed = new Set(ACCA_CREATE_ALLOWED_KEYS);
  for (const key of ACCA_CREATE_REJECTED_KEYS) {
    assert.equal(allowed.has(key), false, `${key} cannot be both allowed and rejected`);
  }
  for (const derived of ["combinedOdds", "legs", "status", "version", "publishedAt"]) {
    assert.ok(ACCA_CREATE_REJECTED_KEYS.includes(derived), `${derived} must be rejected`);
  }
});

test("title and summary are bounded and sanitized, never truncated", async () => {
  const h = createHarness();
  const candidate = await seedApprovedCandidate(h.candidateStore);

  const cases: Array<[string, unknown, string]> = [
    ["title", "", "empty"],
    ["title", "   ", "empty"],
    ["title", 42, "not_a_string"],
    ["title", "x".repeat(ACCA_LIMITS.maxTitleLength + 1), "too_long"],
    ["title", `bad${String.fromCharCode(7)}title`, "control_characters"],
    ["summary", "", "empty"],
    ["summary", "y".repeat(ACCA_LIMITS.maxSummaryLength + 1), "too_long"],
    ["summary", `bad${String.fromCharCode(0)}summary`, "control_characters"],
  ];
  for (const [field, value, detail] of cases) {
    const failed = failureWithCode(
      await h.service.createAccaDraftFromCandidate(
        createRequest(candidate, { [field]: value } as never),
      ),
      "invalid_metadata",
    );
    assert.equal(failed.field, field, `${field}=${String(value)} field`);
    assert.equal(failed.detail, detail, `${field}=${String(value)} detail`);
  }

  // A title exactly at the limit is accepted, and stored trimmed but complete.
  const exact = "z".repeat(ACCA_LIMITS.maxTitleLength);
  const ok = success(
    await h.service.createAccaDraftFromCandidate(createRequest(candidate, { title: exact })),
  );
  assert.equal(ok.acca.title, exact);
  assert.equal(ok.acca.title.length, ACCA_LIMITS.maxTitleLength);
});

test("summary omitted and explicit null both store null", async () => {
  const h = createHarness();
  const a = await seedApprovedCandidate(h.candidateStore);
  const b = await seedApprovedCandidate(h.candidateStore);
  const omitted = success(await h.service.createAccaDraftFromCandidate(createRequest(a)));
  const explicit = success(
    await h.service.createAccaDraftFromCandidate(
      createRequest(b, { summary: null, title: "Second Treble" }),
    ),
  );
  assert.equal(omitted.acca.summary, null);
  assert.equal(explicit.acca.summary, null);
});

test("locale, actor, version and timestamp are validated", async () => {
  const h = createHarness();
  const candidate = await seedApprovedCandidate(h.candidateStore);
  const bad: Array<[string, Record<string, unknown>]> = [
    ["locale", { locale: "english" }],
    ["locale", { locale: "" }],
    ["locale", { locale: 5 }],
    ["createdBy", { createdBy: "root" }],
    ["createdBy", { createdBy: null }],
    ["expectedCandidateVersion", { expectedCandidateVersion: 0 }],
    ["expectedCandidateVersion", { expectedCandidateVersion: 1.5 }],
    ["expectedCandidateVersion", { expectedCandidateVersion: "2" }],
    ["createdAt", { createdAt: "2026-07-26" }],
    ["createdAt", { createdAt: "not a date" }],
    ["candidateId", { candidateId: "" }],
    ["candidateId", { candidateId: "has spaces" }],
    ["slugDiscriminator", { slugDiscriminator: "" }],
    ["slugDiscriminator", { slugDiscriminator: "x".repeat(41) }],
  ];
  for (const [field, over] of bad) {
    const failed = failureWithCode(
      await h.service.createAccaDraftFromCandidate(createRequest(candidate, over as never)),
      "invalid_metadata",
    );
    assert.equal(failed.field, field, `expected ${field} to fail for ${JSON.stringify(over)}`);
  }
});

test("the service never leaks a raw storage error", async () => {
  const h = createHarness();
  const candidate = await seedApprovedCandidate(h.candidateStore);
  const exploding = {
    ...h.accaStore,
    async createDraftFromCandidate() {
      throw new Error("connection to postgres://user:secret@db:5432 refused");
    },
  };
  const { createAccaService } = await import("../lib/acca-publication/service");
  const service = createAccaService({
    accaStore: exploding as never,
    candidateStore: h.candidateStore,
  });
  const failed = failureWithCode(
    await service.createAccaDraftFromCandidate(createRequest(candidate)),
    "storage_failed",
  );
  assert.equal(failed.message, "create_failed");
  assert.equal(/postgres:\/\//.test(failed.message), false);
  assert.equal(/secret/.test(failed.message), false);
});

/* ================================================================== *
 * 6. Listing, filtering, ordering and paging
 * ================================================================== */

async function seedAccas(count: number, over: (i: number) => Record<string, unknown> = () => ({})) {
  const h = createHarness();
  const created = [];
  for (let i = 0; i < count; i++) {
    const candidate = await seedApprovedCandidate(h.candidateStore);
    const result = success(
      await h.service.createAccaDraftFromCandidate(
        createRequest(candidate, {
          title: `Acca number ${i}`,
          createdAt: `2026-07-${String(10 + i).padStart(2, "0")}T12:00:00.000Z`,
          ...over(i),
        } as never),
      ),
    );
    created.push(result.acca);
  }
  return { h, created };
}

test("listing is newest-first with a deterministic tie-break on identical timestamps", async () => {
  // Every record shares one createdAt, so ordering is decided purely by the tie-break.
  const { h, created } = await seedAccas(6, () => ({
    createdAt: "2026-07-20T12:00:00.000Z",
  }));
  const page = success(await h.service.listAccas(listFilters({ limit: 100 })));
  const ids = page.page.rows.map((r) => r.accaId);
  const expected = created.map((r) => r.accaId).sort((a, b) => (a < b ? 1 : -1));
  assert.deepEqual(ids, expected, "must order by acca_id DESC when timestamps tie");

  // Repeating the query must give byte-identical ordering.
  const again = success(await h.service.listAccas(listFilters({ limit: 100 })));
  assert.deepEqual(again.page.rows.map((r) => r.accaId), ids);
});

test("listing orders by createdAt DESC before the tie-break", async () => {
  const { h, created } = await seedAccas(5);
  const page = success(await h.service.listAccas(listFilters({ limit: 100 })));
  const timestamps = page.page.rows.map((r) => r.createdAt);
  const descending = [...timestamps].sort((a, b) => (a < b ? 1 : -1));
  assert.deepEqual(timestamps, descending);
  assert.equal(page.page.rows[0].createdAt, created[created.length - 1].createdAt);
});

test("paging is bounded, stable and non-overlapping", async () => {
  const { h } = await seedAccas(7);
  const all = success(await h.service.listAccas(listFilters({ limit: 100 })));
  assert.equal(all.page.total, 7);

  const seen: string[] = [];
  for (let offset = 0; offset < 7; offset += 3) {
    const page = success(await h.service.listAccas(listFilters({ limit: 3, offset })));
    assert.equal(page.page.total, 7, "total must reflect the filtered set, not the page");
    assert.equal(page.page.limit, 3);
    assert.equal(page.page.offset, offset);
    seen.push(...page.page.rows.map((r) => r.accaId));
  }
  assert.deepEqual(seen, all.page.rows.map((r) => r.accaId));
  assert.equal(new Set(seen).size, 7, "pages must not overlap");
});

test("out-of-range paging is rejected rather than silently clamped at the service", async () => {
  const h = createHarness();
  failureWithCode(await h.service.listAccas(listFilters({ limit: 0 })), "invalid_metadata");
  failureWithCode(await h.service.listAccas(listFilters({ offset: -1 })), "invalid_metadata");
  failureWithCode(await h.service.listAccas(listFilters({ limit: 1.5 })), "invalid_metadata");
});

test("URL-derived filters are clamped to the documented bounds", () => {
  const parsed = parseAccaListFilters(new URLSearchParams("limit=99999&offset=-5"));
  assert.equal(parsed.limit, ACCA_LIST_MAX_LIMIT);
  assert.equal(parsed.offset, 0);
  assert.equal(parseAccaListFilters(new URLSearchParams("")).limit, ACCA_LIST_DEFAULT_LIMIT);

  // No request value may become a sort key or a column name.
  const hostile = parseAccaListFilters(
    new URLSearchParams("status=DROP+TABLE&locale=../../etc&sourceCandidateId=a%20b"),
  );
  assert.equal(hostile.status, null);
  assert.equal(hostile.locale, null);
  assert.equal(hostile.sourceCandidateId, null);
});

test("status, locale, candidate and date-range filters each narrow the set", async () => {
  const h = createHarness();
  const a = await seedApprovedCandidate(h.candidateStore);
  const b = await seedApprovedCandidate(h.candidateStore);
  const c = await seedApprovedCandidate(h.candidateStore);

  const first = success(
    await h.service.createAccaDraftFromCandidate(
      createRequest(a, { title: "Alpha", locale: "en", createdAt: "2026-07-01T00:00:00.000Z" }),
    ),
  ).acca;
  const second = success(
    await h.service.createAccaDraftFromCandidate(
      createRequest(b, { title: "Beta", locale: "tr", createdAt: "2026-07-15T00:00:00.000Z" }),
    ),
  ).acca;
  success(
    await h.service.createAccaDraftFromCandidate(
      createRequest(c, { title: "Gamma", locale: "en", createdAt: "2026-07-30T00:00:00.000Z" }),
    ),
  );

  const byLocale = success(await h.service.listAccas(listFilters({ locale: "tr" })));
  assert.deepEqual(byLocale.page.rows.map((r) => r.accaId), [second.accaId]);

  const byCandidate = success(
    await h.service.listAccas(listFilters({ sourceCandidateId: a.candidateId })),
  );
  assert.deepEqual(byCandidate.page.rows.map((r) => r.accaId), [first.accaId]);

  const byRange = success(
    await h.service.listAccas(
      listFilters({
        createdAfter: "2026-07-10T00:00:00.000Z",
        createdBefore: "2026-07-20T00:00:00.000Z",
      }),
    ),
  );
  assert.deepEqual(byRange.page.rows.map((r) => r.accaId), [second.accaId]);

  const drafts = success(await h.service.listAccas(listFilters({ status: "DRAFT" })));
  assert.equal(drafts.page.total, 3);
  const published = success(await h.service.listAccas(listFilters({ status: "PUBLISHED" })));
  assert.equal(published.page.total, 0);
});

test("the published-date filter excludes records that were never published", async () => {
  const h = createHarness();
  const candidate = await seedApprovedCandidate(h.candidateStore);
  success(await h.service.createAccaDraftFromCandidate(createRequest(candidate)));
  const page = success(
    await h.service.listAccas(listFilters({ publishedAfter: "2020-01-01T00:00:00.000Z" })),
  );
  assert.equal(page.page.total, 0, "a DRAFT has no publishedAt and must not match");
});

/* ================================================================== *
 * 7. Visibility boundary (documented and tested; B5 owns enforcement)
 * ================================================================== */

test("the store does NOT hide drafts or archived records — B5 filters, not persistence", async () => {
  const h = createHarness();
  const candidate = await seedApprovedCandidate(h.candidateStore);
  const created = success(
    await h.service.createAccaDraftFromCandidate(createRequest(candidate)),
  ).acca;

  // A DRAFT is returned by every retrieval path...
  assert.ok(await h.accaStore.getAccaById(created.accaId));
  assert.ok(await h.accaStore.getAccaBySlug(created.slug));
  assert.equal((await h.accaStore.listAccas(listFilters())).total, 1);

  // ...and is nonetheless NOT publicly visible. The two questions are deliberately separate.
  assert.equal(isPubliclyVisible(created.status), false);
  assert.equal(isPubliclyVisible("PUBLISHED"), true);
  assert.equal(isPubliclyVisible("ARCHIVED"), false);

  // The boundary is documented where a later stage will look for it.
  const storeSrc = readSource("lib/acca-publication/store.ts");
  assert.ok(
    /PUBLIC VISIBILITY IS NOT A STORE CONCERN/.test(storeSrc),
    "store.ts must document the visibility boundary",
  );
  assert.ok(/isPubliclyVisible/.test(storeSrc));
});

/* ================================================================== *
 * 8. Typed failure vocabulary
 * ================================================================== */

test("the service failure vocabulary is complete and has no duplicates", () => {
  const required = [
    "candidate_not_found",
    "candidate_status_conflict",
    "candidate_version_conflict",
    "candidate_already_converted",
    "acca_already_exists_for_candidate",
    "acca_not_found",
    "acca_status_conflict",
    "acca_version_conflict",
    "slug_conflict",
    "invalid_candidate_snapshot",
    "invalid_odds",
    "invalid_slug",
    "invalid_metadata",
    "storage_failed",
  ];
  for (const code of required) {
    assert.ok(
      (ACCA_SERVICE_FAILURE_CODES as readonly string[]).includes(code),
      `missing failure code ${code}`,
    );
  }
  assert.equal(
    new Set(ACCA_SERVICE_FAILURE_CODES).size,
    ACCA_SERVICE_FAILURE_CODES.length,
    "failure codes must be unique",
  );
});

test("candidate and Acca conflicts are never reported under the same code", () => {
  const candidateCodes = ACCA_SERVICE_FAILURE_CODES.filter((c) => c.startsWith("candidate_"));
  const accaCodes = ACCA_SERVICE_FAILURE_CODES.filter((c) => c.startsWith("acca_"));
  assert.ok(candidateCodes.length >= 4);
  assert.ok(accaCodes.length >= 4);
  for (const c of candidateCodes) assert.equal(accaCodes.includes(c), false);
});
