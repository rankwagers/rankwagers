import assert from "node:assert/strict";
import test from "node:test";
import type { BuilderPublicationCandidate } from "../lib/builder-approval/contracts";
import type { CandidateStore } from "../lib/builder-approval/store";
import { transitionBuilderCandidate } from "../lib/builder-approval/service";
import { mintAccaId } from "../lib/acca-publication/identifiers";
import {
  FIXTURE_COMBINED_ODDS,
  assertCandidateUnchanged,
  assertNoOrphanAcca,
  businessImage,
  candidateBody,
  createHarness,
  createRequest,
  failConversion,
  failureWithCode,
  leg,
  lifecycleImage,
  listFilters,
  seedApprovedCandidate,
  seedDraftCandidate,
  seedRejectedCandidate,
  success,
  throwAfterConversion,
  throwBeforeConversion,
  type Harness,
} from "./accaFixtures";

/**
 * Sprint 20B-B stage B2 — atomic candidate-to-Acca conversion.
 *
 * The central invariant under test:
 *
 *     The Acca draft and the candidate APPROVED -> CONVERTED transition commit together,
 *     or neither commits.
 *
 * Every failure path asserts all four consequences the brief requires: no orphan Acca, no
 * partially converted candidate, no version drift and no lifecycle audit drift.
 *
 * MEMORY ADAPTER ONLY. Nothing here executes against PostgreSQL and nothing here proves
 * anything about PostgreSQL's transaction behaviour.
 */

/* ================================================================== *
 * 1. Successful conversion
 * ================================================================== */

test("APPROVED v2 converts to a DRAFT Acca v1 and candidate v3, atomically", async () => {
  const h = createHarness();
  const candidate = await seedApprovedCandidate(h.candidateStore);
  const businessBefore = businessImage(candidate);

  const created = success(
    await h.service.createAccaDraftFromCandidate(
      createRequest(candidate, { summary: "Two selections, priced at build time." }),
    ),
  ).acca;

  /* ---- the Acca side ---- */
  assert.equal(created.sourceCandidateId, candidate.candidateId);
  assert.equal(created.status, "DRAFT");
  assert.equal(created.version, 1, "a new Acca starts at version 1");
  assert.equal(created.createdBy, "admin");
  assert.equal(created.publishedAt, null);
  assert.equal(created.publishedBy, null);
  assert.equal(created.archivedAt, null);
  assert.equal(created.archivedBy, null);
  assert.equal(created.createdAt, "2026-07-26T12:00:00.000Z");
  assert.equal(created.updatedAt, created.createdAt);
  assert.ok(created.slug.length > 0, "slug must be persisted");
  assert.match(created.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/);
  assert.equal(created.combinedOdds, FIXTURE_COMBINED_ODDS, "odds must be recomputed");
  assert.equal(created.legs.length, 2);
  assert.equal(created.sourceReferences.candidateId, candidate.candidateId);
  assert.equal(created.sourceReferences.candidatePayloadChecksum, candidate.payloadChecksum);

  /* ---- the candidate side ---- */
  const after = await h.candidateStore.getCandidate(candidate.candidateId);
  assert.ok(after);
  assert.equal(after.status, "CONVERTED");
  assert.equal(after.version, candidate.version + 1, "version increments exactly once");
  assert.equal(after.convertedAccaId, created.accaId, "candidate must point at the Acca");
  assert.equal(after.statusActor, "admin");
  assert.equal(after.statusChangedAt, "2026-07-26T12:00:00.000Z");
  assert.equal(after.rejectionReason, null);

  /* ---- the candidate business payload is untouched ---- */
  assert.equal(businessImage(after), businessBefore, "business payload must not change");

  /* ---- the stored snapshot is detached from the candidate ---- */
  const reread = await h.accaStore.getAccaById(created.accaId);
  assert.ok(reread);
  assert.equal(JSON.stringify(reread), JSON.stringify(created));
  assert.notEqual(reread.legs, created.legs, "each read is a distinct clone");
});

test("the conversion is visible through every retrieval path or through none", async () => {
  const h = createHarness();
  const candidate = await seedApprovedCandidate(h.candidateStore);
  const created = success(
    await h.service.createAccaDraftFromCandidate(createRequest(candidate)),
  ).acca;

  assert.ok(await h.accaStore.getAccaById(created.accaId));
  assert.ok(await h.accaStore.getAccaBySlug(created.slug));
  const page = await h.accaStore.listAccas(
    listFilters({ sourceCandidateId: candidate.candidateId }),
  );
  assert.equal(page.total, 1);
  assert.equal(page.rows[0].accaId, created.accaId);
});

/* ================================================================== *
 * 2. Failure matrix
 *
 * Each case asserts the same four consequences.
 * ================================================================== */

async function assertNothingCommitted(
  h: Harness,
  before: BuilderPublicationCandidate,
  context: string,
): Promise<void> {
  await assertCandidateUnchanged(h.candidateStore, before, context);
  await assertNoOrphanAcca(h, before.candidateId, context);
}

test("candidate missing", async () => {
  const h = createHarness();
  const candidate = await seedApprovedCandidate(h.candidateStore);
  const request = createRequest(candidate, { candidateId: "cand_does_not_exist" });
  failureWithCode(
    await h.service.createAccaDraftFromCandidate(request),
    "candidate_not_found",
  );
  await assertNothingCommitted(h, candidate, "candidate missing");
});

test("candidate still DRAFT", async () => {
  const h = createHarness();
  const draft = await seedDraftCandidate(h.candidateStore);
  const failed = failureWithCode(
    await h.service.createAccaDraftFromCandidate(createRequest(draft)),
    "candidate_status_conflict",
  );
  assert.equal(failed.currentStatus, "DRAFT");
  assert.equal(failed.currentVersion, 1);
  await assertNothingCommitted(h, draft, "candidate DRAFT");
});

test("candidate REJECTED", async () => {
  const h = createHarness();
  const rejected = await seedRejectedCandidate(h.candidateStore);
  const failed = failureWithCode(
    await h.service.createAccaDraftFromCandidate(createRequest(rejected)),
    "candidate_status_conflict",
  );
  assert.equal(failed.currentStatus, "REJECTED");
  await assertNothingCommitted(h, rejected, "candidate REJECTED");
});

test("candidate already CONVERTED reports the specific code, not a bare status conflict", async () => {
  const h = createHarness();
  const candidate = await seedApprovedCandidate(h.candidateStore);
  const first = success(
    await h.service.createAccaDraftFromCandidate(createRequest(candidate)),
  ).acca;

  const converted = await h.candidateStore.getCandidate(candidate.candidateId);
  assert.ok(converted);

  const failed = failureWithCode(
    await h.service.createAccaDraftFromCandidate(
      createRequest(candidate, {
        expectedCandidateVersion: converted.version,
        title: "A different title",
      }),
    ),
    "candidate_already_converted",
  );
  assert.equal(failed.existingAccaId, first.accaId, "must name the Acca that already exists");

  // Exactly one Acca for this candidate, and the candidate did not move again.
  const page = await h.accaStore.listAccas(
    listFilters({ sourceCandidateId: candidate.candidateId }),
  );
  assert.equal(page.total, 1);
  await assertCandidateUnchanged(h.candidateStore, converted, "second conversion attempt");
});

test("stale expected candidate version", async () => {
  const h = createHarness();
  const candidate = await seedApprovedCandidate(h.candidateStore);
  const failed = failureWithCode(
    await h.service.createAccaDraftFromCandidate(
      createRequest(candidate, { expectedCandidateVersion: 1 }),
    ),
    "candidate_version_conflict",
  );
  assert.equal(failed.currentStatus, "APPROVED");
  assert.equal(failed.currentVersion, 2);
  await assertNothingCommitted(h, candidate, "stale version");
});

test("expected version ahead of reality is also a conflict", async () => {
  const h = createHarness();
  const candidate = await seedApprovedCandidate(h.candidateStore);
  failureWithCode(
    await h.service.createAccaDraftFromCandidate(
      createRequest(candidate, { expectedCandidateVersion: 99 }),
    ),
    "candidate_version_conflict",
  );
  await assertNothingCommitted(h, candidate, "future version");
});

test("invalid actor, title and locale each abort before any write", async () => {
  const h = createHarness();
  const candidate = await seedApprovedCandidate(h.candidateStore);
  const cases: Array<Record<string, unknown>> = [
    { createdBy: "superuser" },
    { title: "" },
    { title: "x".repeat(500) },
    { locale: "not-a-locale" },
  ];
  for (const over of cases) {
    failureWithCode(
      await h.service.createAccaDraftFromCandidate(createRequest(candidate, over as never)),
      "invalid_metadata",
    );
    await assertNothingCommitted(h, candidate, JSON.stringify(over));
  }
});

/**
 * Return a candidate store whose reads yield a doctored candidate.
 *
 * The Builder Approval input validation rejects a malformed combination at candidate creation
 * time, so a genuinely broken snapshot cannot be produced through the front door. Doctoring
 * the read is how a candidate that was corrupted after storage — the case the mapper exists to
 * catch — is simulated. Writes still go to the real store, so rollback assertions stay honest.
 */
function withDoctoredCandidate(
  inner: CandidateStore,
  doctor: (candidate: BuilderPublicationCandidate) => BuilderPublicationCandidate,
): CandidateStore {
  return {
    ...inner,
    async getCandidate(candidateId: string) {
      const found = await inner.getCandidate(candidateId);
      return found ? doctor(structuredClone(found)) : null;
    },
  };
}

test("invalid candidate selection is rejected as invalid_candidate_snapshot", async () => {
  const base = createHarness();
  const candidate = await seedApprovedCandidate(base.candidateStore);

  const doctored = withDoctoredCandidate(base.candidateStore, (c) => {
    const combination = (c.payload as Record<string, Record<string, unknown>>).combination;
    const legs = combination.legs as Record<string, unknown>[];
    delete legs[1].marketKey; // fixture identifier present, market identifier gone
    return c;
  });
  const h = createHarness({ candidateStore: doctored });

  const failed = failureWithCode(
    await h.service.createAccaDraftFromCandidate(createRequest(candidate)),
    "invalid_candidate_snapshot",
  );
  assert.equal(failed.detail, "invalid_leg");
  assert.equal(failed.legIndex, 1, "must name the offending leg");
  // Verified against the UNDOCTORED store: the doctored wrapper corrupts the candidate on
  // every read by design, so reading through it would report its own simulation as drift.
  await assertCandidateUnchanged(base.candidateStore, candidate, "invalid selection");
  await assertNoOrphanAcca(h, candidate.candidateId, "invalid selection");
});

test("an unusable price is rejected as invalid_odds, not silently skipped", async () => {
  const base = createHarness();
  const candidate = await seedApprovedCandidate(base.candidateStore);

  const doctored = withDoctoredCandidate(base.candidateStore, (c) => {
    const combination = (c.payload as Record<string, Record<string, unknown>>).combination;
    (combination.legs as Record<string, unknown>[])[0].odds = 1;
    return c;
  });
  const h = createHarness({ candidateStore: doctored });

  const failed = failureWithCode(
    await h.service.createAccaDraftFromCandidate(createRequest(candidate)),
    "invalid_odds",
  );
  assert.equal(failed.detail, "odds_below_minimum");
  assert.equal(failed.legIndex, 0);
  await assertCandidateUnchanged(base.candidateStore, candidate, "invalid odds");
  await assertNoOrphanAcca(h, candidate.candidateId, "invalid odds");
});

test("a leg count outside the contract is a snapshot failure", async () => {
  const base = createHarness();
  const candidate = await seedApprovedCandidate(base.candidateStore);
  const doctored = withDoctoredCandidate(base.candidateStore, (c) => {
    const combination = (c.payload as Record<string, Record<string, unknown>>).combination;
    combination.legs = [leg()];
    return c;
  });
  const h = createHarness({ candidateStore: doctored });
  const failed = failureWithCode(
    await h.service.createAccaDraftFromCandidate(createRequest(candidate)),
    "invalid_candidate_snapshot",
  );
  assert.equal(failed.detail, "too_few_legs");
  await assertCandidateUnchanged(base.candidateStore, candidate, "too few legs");
  await assertNoOrphanAcca(h, candidate.candidateId, "too few legs");
});

test("a title and discriminator that both normalize to nothing is invalid_slug", async () => {
  const h = createHarness();
  const candidate = await seedApprovedCandidate(h.candidateStore);
  const failed = failureWithCode(
    await h.service.createAccaDraftFromCandidate(
      // Emoji-only title with an override discriminator that also normalizes away, so no
      // readable base and no uniqueness token survive.
      createRequest(candidate, { title: "\u{1F389}\u{1F389}", slugDiscriminator: "!!!" }),
    ),
    "invalid_slug",
  );
  assert.equal(failed.detail, "slug_empty");
  await assertNothingCommitted(h, candidate, "empty slug");
});

test("duplicate slug across two different candidates is rejected", async () => {
  const h = createHarness();
  const a = await seedApprovedCandidate(h.candidateStore);
  const b = await seedApprovedCandidate(h.candidateStore);

  // A fixed discriminator plus the same title forces the identical slug.
  const first = success(
    await h.service.createAccaDraftFromCandidate(
      createRequest(a, { title: "Shared Title", slugDiscriminator: "fixed" }),
    ),
  ).acca;
  assert.equal(first.slug, "shared-title-fixed");

  const failed = failureWithCode(
    await h.service.createAccaDraftFromCandidate(
      createRequest(b, { title: "Shared Title", slugDiscriminator: "fixed" }),
    ),
    "slug_conflict",
  );
  assert.equal(failed.slug, "shared-title-fixed");

  await assertNothingCommitted(h, b, "duplicate slug");
  // The winner is untouched and still the only holder of that slug.
  const bySlug = await h.accaStore.getAccaBySlug("shared-title-fixed");
  assert.equal(bySlug?.accaId, first.accaId);
});

test("the default discriminator prevents identical titles from colliding", async () => {
  const h = createHarness();
  const a = await seedApprovedCandidate(h.candidateStore);
  const b = await seedApprovedCandidate(h.candidateStore);
  const first = success(
    await h.service.createAccaDraftFromCandidate(createRequest(a, { title: "Same Title" })),
  ).acca;
  const second = success(
    await h.service.createAccaDraftFromCandidate(createRequest(b, { title: "Same Title" })),
  ).acca;
  assert.notEqual(first.slug, second.slug);
  assert.ok(first.slug.startsWith("same-title-"));
  assert.ok(second.slug.startsWith("same-title-"));
});

test("a candidate transition conflict raised by the store aborts the whole unit", async () => {
  const h = createHarness({ candidateStore: undefined });
  const candidate = await seedApprovedCandidate(h.candidateStore);

  // Move the candidate out from under the caller between validation and the store call.
  const racing = {
    ...h.candidateStore,
    async transitionCandidateStatus(input: Parameters<CandidateStore["transitionCandidateStatus"]>[0]) {
      return {
        ok: false as const,
        code: "status_conflict" as const,
        currentStatus: "CONVERTED" as const,
        currentVersion: 3,
      };
    },
  };
  const raced = createHarness({ candidateStore: racing as never });
  const failed = failureWithCode(
    await raced.service.createAccaDraftFromCandidate(createRequest(candidate)),
    "candidate_already_converted",
  );
  assert.equal(failed.existingAccaId, null);
  await assertNoOrphanAcca(raced, candidate.candidateId, "transition conflict");
});

test("a typed storage failure from the candidate store aborts the whole unit", async () => {
  const base = createHarness();
  const candidate = await seedApprovedCandidate(base.candidateStore);
  const h = createHarness({ candidateStore: failConversion(base.candidateStore) });

  failureWithCode(
    await h.service.createAccaDraftFromCandidate(createRequest(candidate)),
    "storage_failed",
  );
  await assertNothingCommitted(h, candidate, "typed storage failure");
});

/* ================================================================== *
 * 3. Failure injection
 *
 * Hooks are supplied by dependency injection at construction. No production caller can reach
 * them, and with `faults` omitted the create path contains no hook call at all.
 * ================================================================== */

test("fault before Acca insertion leaves the pre-operation state exactly restored", async () => {
  const base = createHarness();
  const candidate = await seedApprovedCandidate(base.candidateStore);
  const h = createHarness({
    candidateStore: base.candidateStore,
    faults: {
      beforeAccaInsertion: () => {
        throw new Error("injected: before insertion");
      },
    },
  });

  failureWithCode(
    await h.service.createAccaDraftFromCandidate(createRequest(candidate)),
    "storage_failed",
  );
  await assertNothingCommitted(h, candidate, "fault before insertion");
});

test("fault after a tentative Acca insertion discards the staged draft", async () => {
  const base = createHarness();
  const candidate = await seedApprovedCandidate(base.candidateStore);
  const h = createHarness({
    candidateStore: base.candidateStore,
    faults: {
      afterTentativeAccaInsertion: () => {
        throw new Error("injected: after tentative insertion");
      },
    },
  });

  failureWithCode(
    await h.service.createAccaDraftFromCandidate(createRequest(candidate)),
    "storage_failed",
  );
  await assertNothingCommitted(h, candidate, "fault after tentative insertion");

  // The slug reservation was released, so the same slug is usable afterwards.
  const clean = createHarness({ candidateStore: base.candidateStore });
  success(await clean.service.createAccaDraftFromCandidate(createRequest(candidate)));
});

test("fault immediately before the commit point rolls the whole unit back", async () => {
  const base = createHarness();
  const candidate = await seedApprovedCandidate(base.candidateStore);
  const h = createHarness({
    candidateStore: base.candidateStore,
    faults: {
      beforeCandidateConversion: () => {
        throw new Error("injected: before commit");
      },
    },
  });

  failureWithCode(
    await h.service.createAccaDraftFromCandidate(createRequest(candidate)),
    "storage_failed",
  );
  await assertNothingCommitted(h, candidate, "fault before commit");

  // Every one of the six lifecycle fields is byte-identical, checked field by field so a
  // partial restore cannot hide behind a deepEqual on a subset.
  const after = await h.candidateStore.getCandidate(candidate.candidateId);
  assert.ok(after);
  const before = lifecycleImage(candidate);
  const now = lifecycleImage(after);
  assert.equal(now.status, before.status);
  assert.equal(now.version, before.version);
  assert.equal(now.statusChangedAt, before.statusChangedAt);
  assert.equal(now.statusActor, before.statusActor);
  assert.equal(now.rejectionReason, before.rejectionReason);
  assert.equal(now.convertedAccaId, before.convertedAccaId);
});

test("a conversion that throws WITHOUT writing rolls back completely", async () => {
  const base = createHarness();
  const candidate = await seedApprovedCandidate(base.candidateStore);
  const h = createHarness({ candidateStore: throwBeforeConversion(base.candidateStore) });

  failureWithCode(
    await h.service.createAccaDraftFromCandidate(createRequest(candidate)),
    "storage_failed",
  );
  await assertCandidateUnchanged(base.candidateStore, candidate, "throwing conversion");
  await assertNoOrphanAcca(h, candidate.candidateId, "throwing conversion");
});

test("a conversion that throws AFTER the write landed recovers forward, never partially", async () => {
  const base = createHarness();
  const candidate = await seedApprovedCandidate(base.candidateStore);
  const h = createHarness({ candidateStore: throwAfterConversion(base.candidateStore) });

  // The store cannot tell from the rejected promise whether the candidate moved, so it
  // re-reads. The candidate IS converted, so abandoning the Acca would strand it forever.
  const created = success(
    await h.service.createAccaDraftFromCandidate(createRequest(candidate)),
  ).acca;

  const after = await base.candidateStore.getCandidate(candidate.candidateId);
  assert.ok(after);
  assert.equal(after.status, "CONVERTED");
  assert.equal(after.convertedAccaId, created.accaId);
  assert.equal(after.version, candidate.version + 1);
  assert.ok(await h.accaStore.getAccaById(created.accaId), "the Acca must exist");
  assert.ok(await h.accaStore.getAccaBySlug(created.slug));
});

test("a post-commit fault cannot un-commit and never yields a partial state", async () => {
  const base = createHarness();
  const candidate = await seedApprovedCandidate(base.candidateStore);
  let fired = 0;
  const h = createHarness({
    candidateStore: base.candidateStore,
    faults: {
      afterCandidateConversion: () => {
        fired += 1;
        throw new Error("injected: after the commit point");
      },
    },
  });

  const created = success(
    await h.service.createAccaDraftFromCandidate(createRequest(candidate)),
  ).acca;
  assert.equal(fired, 1, "the post-commit hook must actually have fired");

  // The transaction committed, so BOTH sides must be present. Reporting a failure here would
  // be a lie about consistent, committed state.
  const after = await base.candidateStore.getCandidate(candidate.candidateId);
  assert.equal(after?.status, "CONVERTED");
  assert.equal(after?.convertedAccaId, created.accaId);
  assert.ok(await h.accaStore.getAccaById(created.accaId));
});

test("a fault after publication also leaves a fully committed state", async () => {
  const base = createHarness();
  const candidate = await seedApprovedCandidate(base.candidateStore);
  const h = createHarness({
    candidateStore: base.candidateStore,
    faults: {
      afterTransactionCommit: () => {
        throw new Error("injected: after commit");
      },
    },
  });
  const created = success(
    await h.service.createAccaDraftFromCandidate(createRequest(candidate)),
  ).acca;
  const after = await base.candidateStore.getCandidate(candidate.candidateId);
  assert.equal(after?.convertedAccaId, created.accaId);
  assert.ok(await h.accaStore.getAccaById(created.accaId));
});

test("a failed transaction never corrupts an unrelated candidate", async () => {
  const base = createHarness();
  const victim = await seedApprovedCandidate(base.candidateStore);
  const target = await seedApprovedCandidate(base.candidateStore);

  const h = createHarness({
    candidateStore: base.candidateStore,
    faults: {
      beforeCandidateConversion: () => {
        throw new Error("injected");
      },
    },
  });
  failureWithCode(
    await h.service.createAccaDraftFromCandidate(createRequest(target)),
    "storage_failed",
  );

  await assertCandidateUnchanged(base.candidateStore, victim, "unrelated candidate");
  await assertCandidateUnchanged(base.candidateStore, target, "target candidate");

  // And the unrelated candidate can still be converted normally afterwards.
  const clean = createHarness({ candidateStore: base.candidateStore });
  const created = success(
    await clean.service.createAccaDraftFromCandidate(
      createRequest(victim, { title: "Unrelated Acca" }),
    ),
  ).acca;
  assert.equal(created.sourceCandidateId, victim.candidateId);
});

/* ================================================================== *
 * 4. Guard against pre-check-only uniqueness
 * ================================================================== */

test("the second conversion of one candidate fails even with a fresh Acca id", async () => {
  const h = createHarness();
  const candidate = await seedApprovedCandidate(h.candidateStore);
  const first = success(
    await h.service.createAccaDraftFromCandidate(createRequest(candidate)),
  ).acca;

  // Bypass the service and go straight at the store with a brand-new id and slug, so the
  // rejection cannot be coming from the service's own pre-checks.
  const outcome = await h.accaStore.createDraftFromCandidate(
    {
      schemaVersion: first.schemaVersion,
      accaId: mintAccaId(),
      sourceCandidateId: candidate.candidateId,
      status: "DRAFT",
      title: "Direct store attempt",
      summary: null,
      locale: "en",
      legs: [...first.legs],
      combinedOdds: first.combinedOdds,
      evidenceSnapshot: { ...first.evidenceSnapshot },
      qualificationSnapshot: { ...first.qualificationSnapshot },
      sourceReferences: { ...first.sourceReferences },
      slug: "direct-store-attempt",
      version: 1,
      createdAt: "2026-07-27T00:00:00.000Z",
      updatedAt: "2026-07-27T00:00:00.000Z",
      createdBy: "admin",
    },
    {
      candidateId: candidate.candidateId,
      expectedStatus: "APPROVED",
      expectedVersion: 2,
      actor: "admin",
      transitionedAt: "2026-07-27T00:00:00.000Z",
    },
  );
  failureWithCode(outcome, "acca_already_exists_for_candidate");

  const page = await h.accaStore.listAccas(
    listFilters({ sourceCandidateId: candidate.candidateId }),
  );
  assert.equal(page.total, 1, "still exactly one Acca for this candidate");
  assert.equal(await h.accaStore.getAccaBySlug("direct-store-attempt"), null);
});

test("a candidate approved after a rejection cannot be double-converted", async () => {
  const h = createHarness();
  const candidate = await seedApprovedCandidate(h.candidateStore);
  const created = success(
    await h.service.createAccaDraftFromCandidate(createRequest(candidate)),
  ).acca;

  // CONVERTED is terminal: no further lifecycle move is legal, so there is no path back to
  // APPROVED that could produce a second Acca.
  const moved = await transitionBuilderCandidate({
    candidateId: candidate.candidateId,
    expectedStatus: "CONVERTED",
    expectedVersion: 3,
    nextStatus: "APPROVED",
    store: h.candidateStore,
  });
  assert.equal(moved.ok, false, "CONVERTED -> APPROVED must be rejected");

  const after = await h.candidateStore.getCandidate(candidate.candidateId);
  assert.equal(after?.status, "CONVERTED");
  assert.equal(after?.convertedAccaId, created.accaId);
});
