import assert from "node:assert/strict";
import test from "node:test";
import { mintAccaId } from "../lib/acca-publication/identifiers";
import type { AccaCreateResult } from "../lib/acca-publication/contracts";
import {
  assertCandidateUnchanged,
  createHarness,
  createRequest,
  listFilters,
  seedApprovedCandidate,
  success,
  type Harness,
} from "./accaFixtures";

/**
 * ============================================================================
 * MEMORY ADAPTER CONCURRENCY ONLY
 * ============================================================================
 *
 * Sprint 20B-B stage B2. Every result in this file describes the IN-MEMORY adapter and its
 * per-key critical section. It proves NOTHING about PostgreSQL: the durable adapter relies on
 * a real BEGIN/COMMIT transaction plus unique constraints, which has not been executed. See
 * `tests/accaPostgresStructure.test.ts` for what is actually known about that adapter.
 *
 * The mechanism under test is documented at the top of
 * `lib/acca-publication/adapters/memory.ts`: a keyed async mutex, invisible staging, the
 * candidate conversion as the commit point, and forward recovery on an ambiguous conversion.
 * Single-threaded execution across an `await` is NOT the mechanism and is not claimed.
 */

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function partition(results: AccaCreateResult[]) {
  const winners = results.filter((r): r is Extract<AccaCreateResult, { ok: true }> => r.ok);
  const losers = results.filter((r): r is Extract<AccaCreateResult, { ok: false }> => !r.ok);
  return { winners, losers };
}

/** Every loser must carry a typed conflict, never a bare storage failure. */
const ACCEPTABLE_LOSER_CODES = new Set([
  "candidate_already_converted",
  "candidate_status_conflict",
  "candidate_version_conflict",
  "acca_already_exists_for_candidate",
  "slug_conflict",
]);

function assertTypedConflicts(
  losers: Extract<AccaCreateResult, { ok: false }>[],
  context: string,
): void {
  for (const loser of losers) {
    assert.ok(
      ACCEPTABLE_LOSER_CODES.has(loser.code),
      `${context}: loser returned an untyped or unexpected code: ${JSON.stringify(loser)}`,
    );
  }
}

/**
 * After any concurrent burst on one candidate, the store must hold exactly one Acca for it,
 * the candidate must be CONVERTED at exactly one version above its starting point, and the
 * two must reference each other.
 */
async function assertExactlyOneConversion(
  h: Harness,
  candidateId: string,
  startVersion: number,
  expectedAccaId: string,
  context: string,
): Promise<void> {
  const page = await h.accaStore.listAccas(
    listFilters({ sourceCandidateId: candidateId, limit: 100 }),
  );
  assert.equal(page.total, 1, `${context}: expected exactly one Acca, got ${page.total}`);
  assert.equal(page.rows[0].accaId, expectedAccaId, `${context}: wrong Acca survived`);
  assert.equal(page.rows[0].version, 1, `${context}: Acca version must start at 1`);

  const candidate = await h.candidateStore.getCandidate(candidateId);
  assert.ok(candidate, `${context}: candidate vanished`);
  assert.equal(candidate.status, "CONVERTED", `${context}: candidate status`);
  assert.equal(
    candidate.version,
    startVersion + 1,
    `${context}: candidate version must increment exactly once`,
  );
  assert.equal(
    candidate.convertedAccaId,
    expectedAccaId,
    `${context}: candidate must point at the surviving Acca`,
  );
}

/* ================================================================== *
 * 1. Concurrent creation for one candidate/version
 * ================================================================== */

for (const attempts of [20, 50]) {
  test(`MEMORY ADAPTER CONCURRENCY ONLY: ${attempts} concurrent creates, one candidate/version`, async () => {
    const h = createHarness();
    const candidate = await seedApprovedCandidate(h.candidateStore);

    const results = await Promise.all(
      Array.from({ length: attempts }, (_, i) =>
        h.service.createAccaDraftFromCandidate(
          createRequest(candidate, { title: `Concurrent attempt ${i}` }),
        ),
      ),
    );

    const { winners, losers } = partition(results);
    assert.equal(winners.length, 1, `exactly one of ${attempts} creations may commit`);
    assert.equal(losers.length, attempts - 1);
    assertTypedConflicts(losers, `${attempts}-way create`);

    await assertExactlyOneConversion(
      h,
      candidate.candidateId,
      candidate.version,
      winners[0].acca.accaId,
      `${attempts}-way create`,
    );

    // No losing attempt left a slug behind.
    const all = await h.accaStore.listAccas(listFilters({ limit: 100 }));
    assert.equal(all.total, 1, "no partial write may survive");
    assert.equal(new Set(all.rows.map((r) => r.slug)).size, 1);
  });
}

test("MEMORY ADAPTER CONCURRENCY ONLY: same candidate, different titles", async () => {
  const h = createHarness();
  const candidate = await seedApprovedCandidate(h.candidateStore);

  const titles = ["Alpha Treble", "Beta Treble", "Gamma Treble", "Delta Treble"];
  const results = await Promise.all(
    titles.map((title) =>
      h.service.createAccaDraftFromCandidate(createRequest(candidate, { title })),
    ),
  );

  const { winners, losers } = partition(results);
  assert.equal(winners.length, 1, "one candidate yields at most one Acca, whatever the title");
  assertTypedConflicts(losers, "different titles");

  // The surviving title is one of the submitted ones, not a merge or a fabrication.
  assert.ok(titles.includes(winners[0].acca.title));
  await assertExactlyOneConversion(
    h,
    candidate.candidateId,
    candidate.version,
    winners[0].acca.accaId,
    "different titles",
  );
});

test("MEMORY ADAPTER CONCURRENCY ONLY: same candidate, different slug inputs", async () => {
  const h = createHarness();
  const candidate = await seedApprovedCandidate(h.candidateStore);

  const results = await Promise.all(
    ["alpha", "beta", "gamma", "delta", "epsilon"].map((slugDiscriminator) =>
      h.service.createAccaDraftFromCandidate(
        createRequest(candidate, { title: "Shared Title", slugDiscriminator }),
      ),
    ),
  );

  const { winners, losers } = partition(results);
  assert.equal(winners.length, 1);
  assertTypedConflicts(losers, "different slug inputs");

  // Exactly one slug is reachable; the four losing slugs were never published.
  const all = await h.accaStore.listAccas(listFilters({ limit: 100 }));
  assert.equal(all.total, 1);
  for (const discriminator of ["alpha", "beta", "gamma", "delta", "epsilon"]) {
    const slug = `shared-title-${discriminator}`;
    const found = await h.accaStore.getAccaBySlug(slug);
    if (slug === winners[0].acca.slug) {
      assert.ok(found, "the winning slug must resolve");
    } else {
      assert.equal(found, null, `losing slug ${slug} must not be reachable`);
    }
  }
});

/* ================================================================== *
 * 2. Concurrent creation of one slug across different candidates
 * ================================================================== */

test("MEMORY ADAPTER CONCURRENCY ONLY: same slug across different candidates", async () => {
  const h = createHarness();
  // Distinct candidates run under DIFFERENT mutex keys, so these are genuinely concurrent and
  // the slug reservation — not the per-candidate lock — is what has to hold.
  const candidates = [];
  for (let i = 0; i < 12; i++) candidates.push(await seedApprovedCandidate(h.candidateStore));

  const results = await Promise.all(
    candidates.map((candidate) =>
      h.service.createAccaDraftFromCandidate(
        createRequest(candidate, { title: "Identical Title", slugDiscriminator: "fixed" }),
      ),
    ),
  );

  const { winners, losers } = partition(results);
  assert.equal(winners.length, 1, "one slug may identify at most one Acca");
  assert.equal(winners[0].acca.slug, "identical-title-fixed");
  for (const loser of losers) {
    assert.equal(loser.code, "slug_conflict", `expected slug_conflict, got ${loser.code}`);
  }

  const all = await h.accaStore.listAccas(listFilters({ limit: 100 }));
  assert.equal(all.total, 1);

  // Every losing candidate is untouched — a lost slug race must not convert anybody.
  for (const candidate of candidates) {
    if (candidate.candidateId === winners[0].acca.sourceCandidateId) continue;
    await assertCandidateUnchanged(h.candidateStore, candidate, "slug race loser");
  }
});

test("MEMORY ADAPTER CONCURRENCY ONLY: distinct slugs on distinct candidates all commit", async () => {
  const h = createHarness();
  const candidates = [];
  for (let i = 0; i < 12; i++) candidates.push(await seedApprovedCandidate(h.candidateStore));

  const results = await Promise.all(
    candidates.map((candidate, i) =>
      h.service.createAccaDraftFromCandidate(
        createRequest(candidate, { title: `Unique Title ${i}` }),
      ),
    ),
  );

  const { winners, losers } = partition(results);
  assert.equal(losers.length, 0, `unrelated creations must not block each other: ${JSON.stringify(losers)}`);
  assert.equal(winners.length, 12);
  assert.equal(new Set(winners.map((w) => w.acca.slug)).size, 12);
  assert.equal(new Set(winners.map((w) => w.acca.accaId)).size, 12);

  const all = await h.accaStore.listAccas(listFilters({ limit: 100 }));
  assert.equal(all.total, 12);
});

/* ================================================================== *
 * 3. Creation racing a direct candidate transition
 * ================================================================== */

test("MEMORY ADAPTER CONCURRENCY ONLY: concurrent create versus direct candidate transition", async () => {
  for (let round = 0; round < 12; round++) {
    const h = createHarness();
    const candidate = await seedApprovedCandidate(h.candidateStore);
    const rivalAccaId = mintAccaId();

    // Both race for the same APPROVED@v2 precondition. Exactly one may win.
    const [created, transitioned] = await Promise.all([
      h.service.createAccaDraftFromCandidate(
        createRequest(candidate, { title: `Race round ${round}` }),
      ),
      h.candidateStore.transitionCandidateStatus({
        candidateId: candidate.candidateId,
        expectedStatus: "APPROVED",
        expectedVersion: candidate.version,
        nextStatus: "CONVERTED",
        actor: "admin",
        convertedAccaId: rivalAccaId,
        transitionedAt: "2026-07-26T13:00:00.000Z",
      }),
    ]);

    assert.notEqual(
      created.ok,
      transitioned.ok,
      `round ${round}: exactly one of the two may win, got ${created.ok}/${transitioned.ok}`,
    );

    const after = await h.candidateStore.getCandidate(candidate.candidateId);
    assert.ok(after);
    assert.equal(after.status, "CONVERTED");
    assert.equal(after.version, candidate.version + 1, "exactly one increment");

    const page = await h.accaStore.listAccas(
      listFilters({ sourceCandidateId: candidate.candidateId, limit: 100 }),
    );

    if (created.ok) {
      // The Acca creation won: the candidate points at the created Acca, not the rival id.
      assert.equal(after.convertedAccaId, created.acca.accaId);
      assert.notEqual(after.convertedAccaId, rivalAccaId);
      assert.equal(page.total, 1);
    } else {
      // The direct transition won: no orphan Acca may survive the losing creation.
      assert.equal(after.convertedAccaId, rivalAccaId);
      assert.equal(page.total, 0, `round ${round}: losing creation left an orphan Acca`);
      assert.ok(
        ACCEPTABLE_LOSER_CODES.has(created.code),
        `round ${round}: untyped loser ${JSON.stringify(created)}`,
      );
    }
  }
});

/* ================================================================== *
 * 4. Concurrent lifecycle transitions on one Acca version
 * ================================================================== */

async function seedDraftAcca(h: Harness, title = "Lifecycle Race") {
  const candidate = await seedApprovedCandidate(h.candidateStore);
  return success(await h.service.createAccaDraftFromCandidate(createRequest(candidate, { title })))
    .acca;
}

test("MEMORY ADAPTER CONCURRENCY ONLY: concurrent publish attempts from one Acca version", async () => {
  const h = createHarness();
  const draft = await seedDraftAcca(h);

  const results = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      h.service.transitionAccaLifecycle({
        accaId: draft.accaId,
        expectedStatus: "DRAFT",
        expectedVersion: 1,
        nextStatus: "PUBLISHED",
        actor: "admin",
        transitionedAt: `2026-07-26T14:00:${String(i).padStart(2, "0")}.000Z`,
      }),
    ),
  );

  const winners = results.filter((r) => r.ok);
  const losers = results.filter((r) => !r.ok);
  assert.equal(winners.length, 1, "exactly one publish may commit");
  for (const loser of losers) {
    assert.ok(
      !loser.ok &&
        (loser.code === "acca_status_conflict" || loser.code === "acca_version_conflict"),
      `losing publish must be a typed conflict, got ${JSON.stringify(loser)}`,
    );
  }

  const after = await h.accaStore.getAccaById(draft.accaId);
  assert.ok(after);
  assert.equal(after.status, "PUBLISHED");
  assert.equal(after.version, 2, "version increments exactly once under 20-way contention");
  assert.ok(after.publishedAt, "publishedAt must be set exactly once");
  assert.equal(after.publishedBy, "admin");
  assert.equal(after.archivedAt, null);
  assert.equal(after.archivedBy, null);
});

test("MEMORY ADAPTER CONCURRENCY ONLY: concurrent archive attempts from one Acca version", async () => {
  const h = createHarness();
  const draft = await seedDraftAcca(h, "Archive Race");
  const published = success(
    await h.service.transitionAccaLifecycle({
      accaId: draft.accaId,
      expectedStatus: "DRAFT",
      expectedVersion: 1,
      nextStatus: "PUBLISHED",
      actor: "admin",
      transitionedAt: "2026-07-26T14:00:00.000Z",
    }),
  ).acca;

  const results = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      h.service.transitionAccaLifecycle({
        accaId: draft.accaId,
        expectedStatus: "PUBLISHED",
        expectedVersion: published.version,
        nextStatus: "ARCHIVED",
        actor: "admin",
        transitionedAt: `2026-07-26T15:00:${String(i).padStart(2, "0")}.000Z`,
      }),
    ),
  );

  assert.equal(results.filter((r) => r.ok).length, 1, "exactly one archive may commit");

  const after = await h.accaStore.getAccaById(draft.accaId);
  assert.ok(after);
  assert.equal(after.status, "ARCHIVED");
  assert.equal(after.version, 3);
  assert.equal(after.publishedAt, published.publishedAt, "publication metadata must survive");
  assert.equal(after.publishedBy, "admin");
  assert.ok(after.archivedAt);
  assert.equal(after.archivedBy, "admin");
});

test("MEMORY ADAPTER CONCURRENCY ONLY: publish and archive racing from the same version", async () => {
  const h = createHarness();
  const draft = await seedDraftAcca(h, "Mixed Race");

  // Only DRAFT -> PUBLISHED is legal from here, so the archive attempts must all be refused
  // as illegal rather than winning a race they should never be able to enter.
  const results = await Promise.all([
    ...Array.from({ length: 5 }, () =>
      h.service.transitionAccaLifecycle({
        accaId: draft.accaId,
        expectedStatus: "DRAFT",
        expectedVersion: 1,
        nextStatus: "PUBLISHED",
        actor: "admin",
        transitionedAt: "2026-07-26T14:00:00.000Z",
      }),
    ),
    ...Array.from({ length: 5 }, () =>
      h.service.transitionAccaLifecycle({
        accaId: draft.accaId,
        expectedStatus: "DRAFT",
        expectedVersion: 1,
        nextStatus: "ARCHIVED",
        actor: "admin",
        transitionedAt: "2026-07-26T14:00:00.000Z",
      }),
    ),
  ]);

  const winners = results.filter((r) => r.ok);
  assert.equal(winners.length, 1);
  assert.ok(winners[0].ok && winners[0].acca.status === "PUBLISHED");

  const after = await h.accaStore.getAccaById(draft.accaId);
  assert.equal(after?.status, "PUBLISHED");
  assert.equal(after?.version, 2);
  assert.equal(after?.archivedAt, null, "an illegal archive must not set archive metadata");
});

/* ================================================================== *
 * 5. Isolation between unrelated keys
 * ================================================================== */

test("MEMORY ADAPTER CONCURRENCY ONLY: a stuck transaction blocks only its own candidate", async () => {
  const h = createHarness();
  const blocked = await seedApprovedCandidate(h.candidateStore);
  const other = await seedApprovedCandidate(h.candidateStore);

  let releaseBlocked!: () => void;
  const gate = new Promise<void>((resolve) => {
    releaseBlocked = resolve;
  });

  let firstCandidateSeen: string | null = null;
  const gated = createHarness({
    candidateStore: h.candidateStore,
    faults: {
      beforeCandidateConversion: async () => {
        // Hold only the FIRST transaction to reach this point.
        if (firstCandidateSeen === null) {
          firstCandidateSeen = "held";
          await gate;
        }
      },
    },
  });

  const held = gated.service.createAccaDraftFromCandidate(
    createRequest(blocked, { title: "Held Transaction" }),
  );
  // Let the held transaction reach the gate before starting the second one.
  await new Promise((resolve) => setImmediate(resolve));

  const free = await gated.service.createAccaDraftFromCandidate(
    createRequest(other, { title: "Free Transaction" }),
  );
  assert.equal(free.ok, true, "an unrelated candidate must not be blocked");

  releaseBlocked();
  const heldResult = await held;
  assert.equal(heldResult.ok, true, "the held transaction must still complete");

  const all = await gated.accaStore.listAccas(listFilters({ limit: 100 }));
  assert.equal(all.total, 2);
});
