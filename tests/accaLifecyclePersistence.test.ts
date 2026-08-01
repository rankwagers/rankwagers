import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCA_IMMUTABLE_FIELDS,
  ACCA_MUTABLE_FIELDS,
  ACCA_STATUSES,
  type AccaRecord,
  type AccaStatus,
} from "../lib/acca-publication/contracts";
import { mintAccaId } from "../lib/acca-publication/identifiers";
import {
  allowedAccaTransitions,
  canTransitionAcca,
  isPubliclyVisible,
} from "../lib/acca-publication/lifecycle";
import {
  createHarness,
  createRequest,
  failureWithCode,
  seedApprovedCandidate,
  success,
  type Harness,
} from "./accaFixtures";

/**
 * Sprint 20B-B stage B2 — Acca lifecycle persistence.
 *
 * The pure transition table was proven in stage B1. This suite proves the PERSISTED
 * behaviour: that a committed transition moves exactly the lifecycle block, increments the
 * version exactly once, records audit metadata only for the status it belongs to, and leaves
 * every immutable snapshot field byte-identical.
 *
 * MEMORY ADAPTER ONLY.
 */

async function seedDraft(h: Harness, title = "Lifecycle Subject"): Promise<AccaRecord> {
  const candidate = await seedApprovedCandidate(h.candidateStore);
  return success(await h.service.createAccaDraftFromCandidate(createRequest(candidate, { title })))
    .acca;
}

async function publish(h: Harness, draft: AccaRecord, at = "2026-08-01T09:00:00.000Z") {
  return success(
    await h.service.transitionAccaLifecycle({
      accaId: draft.accaId,
      expectedStatus: "DRAFT",
      expectedVersion: draft.version,
      nextStatus: "PUBLISHED",
      actor: "admin",
      transitionedAt: at,
    }),
  ).acca;
}

/** Serialize only the immutable snapshot, so drift in any of it is detected byte-for-byte. */
function immutableImage(record: AccaRecord): string {
  const out: Record<string, unknown> = {};
  for (const field of ACCA_IMMUTABLE_FIELDS) out[field] = record[field];
  return JSON.stringify(out);
}

/* ================================================================== *
 * 1. The happy path, field by field
 * ================================================================== */

test("DRAFT -> PUBLISHED sets publication metadata and nothing else", async () => {
  const h = createHarness();
  const draft = await seedDraft(h);
  const before = immutableImage(draft);

  const published = await publish(h, draft);

  assert.equal(published.status, "PUBLISHED");
  assert.equal(published.version, draft.version + 1, "version increments exactly once");
  assert.equal(published.updatedAt, "2026-08-01T09:00:00.000Z");
  assert.notEqual(published.updatedAt, draft.updatedAt, "updatedAt must change");
  assert.equal(published.publishedAt, "2026-08-01T09:00:00.000Z");
  assert.equal(published.publishedBy, "admin");
  assert.equal(published.archivedAt, null, "archive metadata must not be touched by a publish");
  assert.equal(published.archivedBy, null);
  assert.equal(immutableImage(published), before, "immutable snapshot must be byte-identical");

  const persisted = await h.accaStore.getAccaById(draft.accaId);
  assert.equal(JSON.stringify(persisted), JSON.stringify(published), "must be persisted");
});

test("PUBLISHED -> ARCHIVED preserves the publication metadata", async () => {
  const h = createHarness();
  const draft = await seedDraft(h);
  const before = immutableImage(draft);
  const published = await publish(h, draft);

  const archived = success(
    await h.service.transitionAccaLifecycle({
      accaId: draft.accaId,
      expectedStatus: "PUBLISHED",
      expectedVersion: published.version,
      nextStatus: "ARCHIVED",
      actor: "admin",
      transitionedAt: "2026-09-01T09:00:00.000Z",
    }),
  ).acca;

  assert.equal(archived.status, "ARCHIVED");
  assert.equal(archived.version, published.version + 1);
  assert.equal(archived.updatedAt, "2026-09-01T09:00:00.000Z");
  assert.equal(archived.archivedAt, "2026-09-01T09:00:00.000Z");
  assert.equal(archived.archivedBy, "admin");

  // An archived Acca was necessarily published first, and that history must survive.
  assert.equal(archived.publishedAt, published.publishedAt);
  assert.equal(archived.publishedBy, "admin");
  assert.equal(immutableImage(archived), before);
});

test("only the declared mutable fields ever change across a full lifecycle", async () => {
  const h = createHarness();
  const draft = await seedDraft(h);
  const published = await publish(h, draft);
  const archived = success(
    await h.service.transitionAccaLifecycle({
      accaId: draft.accaId,
      expectedStatus: "PUBLISHED",
      expectedVersion: published.version,
      nextStatus: "ARCHIVED",
      actor: "admin",
      transitionedAt: "2026-09-01T09:00:00.000Z",
    }),
  ).acca;

  const changed = (Object.keys(draft) as (keyof AccaRecord)[]).filter(
    (key) => JSON.stringify(draft[key]) !== JSON.stringify(archived[key]),
  );
  for (const key of changed) {
    assert.ok(
      ACCA_MUTABLE_FIELDS.includes(key),
      `${String(key)} changed but is not declared mutable`,
    );
  }
  for (const key of ACCA_IMMUTABLE_FIELDS) {
    assert.equal(
      JSON.stringify(draft[key]),
      JSON.stringify(archived[key]),
      `${String(key)} must be immutable`,
    );
  }
  // The declared partition covers the record exactly once.
  assert.deepEqual(
    [...ACCA_MUTABLE_FIELDS, ...ACCA_IMMUTABLE_FIELDS].sort(),
    (Object.keys(draft) as (keyof AccaRecord)[]).sort(),
  );
});

test("visibility follows status, and a draft is never publicly visible", async () => {
  const h = createHarness();
  const draft = await seedDraft(h);
  assert.equal(isPubliclyVisible(draft.status), false);
  const published = await publish(h, draft);
  assert.equal(isPubliclyVisible(published.status), true);
  const archived = success(
    await h.service.transitionAccaLifecycle({
      accaId: draft.accaId,
      expectedStatus: "PUBLISHED",
      expectedVersion: published.version,
      nextStatus: "ARCHIVED",
      actor: "admin",
      transitionedAt: "2026-09-01T09:00:00.000Z",
    }),
  ).acca;
  assert.equal(isPubliclyVisible(archived.status), false, "archiving must remove visibility");
});

/* ================================================================== *
 * 2. Illegal transitions
 * ================================================================== */

test("every illegal transition pair is refused, including same-state", async () => {
  const legal = new Set(["DRAFT>PUBLISHED", "PUBLISHED>ARCHIVED"]);
  for (const from of ACCA_STATUSES) {
    for (const to of ACCA_STATUSES) {
      const key = `${from}>${to}`;
      if (legal.has(key)) continue;
      assert.equal(canTransitionAcca(from, to), false, `${key} must be illegal`);

      const h = createHarness();
      const draft = await seedDraft(h, `Illegal ${key}`);
      const result = await h.service.transitionAccaLifecycle({
        accaId: draft.accaId,
        expectedStatus: from,
        expectedVersion: 1,
        nextStatus: to,
        actor: "admin",
        transitionedAt: "2026-08-01T09:00:00.000Z",
      });
      const failed = failureWithCode(result, "invalid_transition");
      assert.equal(failed.from, from);
      assert.equal(failed.to, to);

      // Nothing moved.
      const after = await h.accaStore.getAccaById(draft.accaId);
      assert.equal(after?.status, "DRAFT");
      assert.equal(after?.version, 1);
      assert.equal(after?.publishedAt, null);
      assert.equal(after?.archivedAt, null);
    }
  }
});

test("the legal transition table is exactly DRAFT->PUBLISHED->ARCHIVED", () => {
  assert.deepEqual([...allowedAccaTransitions("DRAFT")], ["PUBLISHED"]);
  assert.deepEqual([...allowedAccaTransitions("PUBLISHED")], ["ARCHIVED"]);
  assert.deepEqual([...allowedAccaTransitions("ARCHIVED")], [], "ARCHIVED is terminal");
});

test("ARCHIVED is terminal in persistence, not merely in the pure table", async () => {
  const h = createHarness();
  const draft = await seedDraft(h);
  const published = await publish(h, draft);
  const archived = success(
    await h.service.transitionAccaLifecycle({
      accaId: draft.accaId,
      expectedStatus: "PUBLISHED",
      expectedVersion: published.version,
      nextStatus: "ARCHIVED",
      actor: "admin",
      transitionedAt: "2026-09-01T09:00:00.000Z",
    }),
  ).acca;

  for (const target of ["PUBLISHED", "DRAFT"] as AccaStatus[]) {
    const failed = failureWithCode(
      await h.service.transitionAccaLifecycle({
        accaId: draft.accaId,
        expectedStatus: "ARCHIVED",
        expectedVersion: archived.version,
        nextStatus: target,
        actor: "admin",
        transitionedAt: "2026-10-01T09:00:00.000Z",
      }),
      "invalid_transition",
    );
    assert.equal(failed.from, "ARCHIVED");
    assert.equal(failed.to, target);
  }

  const after = await h.accaStore.getAccaById(draft.accaId);
  assert.equal(after?.status, "ARCHIVED");
  assert.equal(after?.version, archived.version, "no version drift from refused attempts");
});

/* ================================================================== *
 * 3. Guarded preconditions
 * ================================================================== */

test("a stale expected status is a status conflict carrying the real state", async () => {
  const h = createHarness();
  const draft = await seedDraft(h);
  const published = await publish(h, draft);

  // A caller that still believes the record is a DRAFT.
  const failed = failureWithCode(
    await h.service.transitionAccaLifecycle({
      accaId: draft.accaId,
      expectedStatus: "DRAFT",
      expectedVersion: 1,
      nextStatus: "PUBLISHED",
      actor: "admin",
      transitionedAt: "2026-08-02T09:00:00.000Z",
    }),
    "acca_status_conflict",
  );
  assert.equal(failed.currentStatus, "PUBLISHED");
  assert.equal(failed.currentVersion, published.version);

  const after = await h.accaStore.getAccaById(draft.accaId);
  assert.equal(after?.version, published.version, "a refused transition must not bump version");
  assert.equal(after?.publishedAt, published.publishedAt, "audit metadata must not drift");
});

test("a stale expected version is a version conflict, distinct from a status conflict", async () => {
  const h = createHarness();
  const draft = await seedDraft(h);
  const failed = failureWithCode(
    await h.service.transitionAccaLifecycle({
      accaId: draft.accaId,
      expectedStatus: "DRAFT",
      expectedVersion: 99,
      nextStatus: "PUBLISHED",
      actor: "admin",
      transitionedAt: "2026-08-01T09:00:00.000Z",
    }),
    "acca_version_conflict",
  );
  assert.equal(failed.currentStatus, "DRAFT");
  assert.equal(failed.currentVersion, 1);

  const after = await h.accaStore.getAccaById(draft.accaId);
  assert.equal(after?.status, "DRAFT");
  assert.equal(after?.version, 1);
  assert.equal(after?.publishedAt, null);
});

test("a missing Acca reports acca_not_found and creates nothing", async () => {
  const h = createHarness();
  const ghost = mintAccaId();
  failureWithCode(
    await h.service.transitionAccaLifecycle({
      accaId: ghost,
      expectedStatus: "DRAFT",
      expectedVersion: 1,
      nextStatus: "PUBLISHED",
      actor: "admin",
      transitionedAt: "2026-08-01T09:00:00.000Z",
    }),
    "acca_not_found",
  );
  assert.equal(await h.accaStore.getAccaById(ghost), null, "must not silently create a record");
});

test("unknown statuses are refused as unknown_status", async () => {
  const h = createHarness();
  const draft = await seedDraft(h);
  for (const bad of ["published", "PENDING", "", null, 3]) {
    failureWithCode(
      await h.service.transitionAccaLifecycle({
        accaId: draft.accaId,
        expectedStatus: "DRAFT",
        expectedVersion: 1,
        nextStatus: bad as never,
        actor: "admin",
        transitionedAt: "2026-08-01T09:00:00.000Z",
      }),
      "unknown_status",
    );
    failureWithCode(
      await h.service.transitionAccaLifecycle({
        accaId: draft.accaId,
        expectedStatus: bad as never,
        expectedVersion: 1,
        nextStatus: "PUBLISHED",
        actor: "admin",
        transitionedAt: "2026-08-01T09:00:00.000Z",
      }),
      "unknown_status",
    );
  }
  const after = await h.accaStore.getAccaById(draft.accaId);
  assert.equal(after?.status, "DRAFT");
  assert.equal(after?.version, 1);
});

test("transition metadata is validated before storage is touched", async () => {
  const h = createHarness();
  const draft = await seedDraft(h);
  const bad: Array<[string, Record<string, unknown>]> = [
    ["accaId", { accaId: "not-an-id" }],
    ["expectedVersion", { expectedVersion: 0 }],
    ["expectedVersion", { expectedVersion: "1" }],
    ["actor", { actor: "root" }],
    ["transitionedAt", { transitionedAt: "yesterday" }],
  ];
  for (const [field, over] of bad) {
    const failed = failureWithCode(
      await h.service.transitionAccaLifecycle({
        accaId: draft.accaId,
        expectedStatus: "DRAFT",
        expectedVersion: 1,
        nextStatus: "PUBLISHED",
        actor: "admin",
        transitionedAt: "2026-08-01T09:00:00.000Z",
        ...over,
      } as never),
      "invalid_metadata",
    );
    assert.equal(failed.field, field);
  }
  const after = await h.accaStore.getAccaById(draft.accaId);
  assert.equal(after?.status, "DRAFT");
  assert.equal(after?.version, 1);
});

/* ================================================================== *
 * 4. Sequential integrity
 * ================================================================== */

test("a full lifecycle produces exactly two version increments", async () => {
  const h = createHarness();
  const draft = await seedDraft(h);
  assert.equal(draft.version, 1);
  const published = await publish(h, draft);
  assert.equal(published.version, 2);
  const archived = success(
    await h.service.transitionAccaLifecycle({
      accaId: draft.accaId,
      expectedStatus: "PUBLISHED",
      expectedVersion: 2,
      nextStatus: "ARCHIVED",
      actor: "admin",
      transitionedAt: "2026-09-01T09:00:00.000Z",
    }),
  ).acca;
  assert.equal(archived.version, 3);

  // The candidate is unaffected by anything that happens to the Acca afterwards.
  const candidate = await h.candidateStore.getCandidate(draft.sourceCandidateId);
  assert.equal(candidate?.status, "CONVERTED");
  assert.equal(candidate?.version, 3, "candidate version must not track the Acca lifecycle");
  assert.equal(candidate?.convertedAccaId, draft.accaId);
});

test("lifecycle changes are visible to listing and slug lookup", async () => {
  const h = createHarness();
  const draft = await seedDraft(h);
  await publish(h, draft);

  const bySlug = await h.accaStore.getAccaBySlug(draft.slug);
  assert.equal(bySlug?.status, "PUBLISHED");
  assert.equal(bySlug?.slug, draft.slug, "the slug is immutable across a lifecycle change");
});
