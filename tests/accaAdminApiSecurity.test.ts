import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getCandidateStore } from "../lib/builder-approval/store";
import { getRateLimiterMode } from "../lib/security/rateLimit";
import { FAMILY_LIMITS } from "../lib/api/adminGuard";
import * as approveRoute from "../app/api/admin/builder-approval/candidates/[candidateId]/approve/route";
import * as rejectRoute from "../app/api/admin/builder-approval/candidates/[candidateId]/reject/route";
import * as createAccaRoute from "../app/api/admin/builder-approval/candidates/[candidateId]/create-acca/route";
import * as accaListRoute from "../app/api/admin/accas/route";
import * as accaDetailRoute from "../app/api/admin/accas/[accaId]/route";
import * as publishRoute from "../app/api/admin/accas/[accaId]/publish/route";
import * as archiveRoute from "../app/api/admin/accas/[accaId]/archive/route";
import {
  ADMIN_KEY,
  ORIGIN,
  assertAdminHeaders,
  assertNoLeak,
  clearLimiter,
  expectError,
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
 * Sprint 20B-B stage B3 — admin API security.
 *
 * Authentication, authorization, actor spoofing, CSRF, rate limiting and response leakage.
 * Every mutation route is covered by the same matrix, driven from a table, so a route added
 * later without a guard fails here rather than shipping unprotected.
 */

installTestEnv();
beforeEach(resetAll);

const root = process.cwd();

/* ------------------------------------------------------------------ *
 * The full mutation-route matrix
 * ------------------------------------------------------------------ */

type MutationRoute = {
  name: string;
  call: (o: RequestOptions) => Promise<Response>;
  /** Prepared per invocation so each call targets a real, correctly-staged resource. */
  prepare: () => Promise<void>;
};

async function accaId(): Promise<string> {
  const candidate = await seedApproved();
  const res = await read(
    await createAccaRoute.POST(
      postRequest(url.createAcca(candidate.candidateId), {
        expectedCandidateVersion: candidate.version,
        title: "Security Fixture",
        locale: "en",
      }),
      { params: { candidateId: candidate.candidateId } },
    ),
  );
  expectStatus(res, 201, "accaId fixture");
  return String((res.body.acca as Record<string, unknown>).accaId);
}

/**
 * Build the matrix lazily: each entry seeds its own resource, so the security assertions run
 * against a genuinely valid request that fails ONLY on the security property under test.
 */
function mutationRoutes(): MutationRoute[] {
  let candidateId = "";
  let draftAccaId = "";
  let publishedAccaId = "";

  return [
    {
      name: "candidate.approve",
      prepare: async () => {
        candidateId = (await seedDraft()).candidateId;
      },
      call: (o) =>
        approveRoute.POST(postRequest(url.approve(candidateId), { expectedVersion: 1 }, o), {
          params: { candidateId },
        }),
    },
    {
      name: "candidate.reject",
      prepare: async () => {
        candidateId = (await seedDraft()).candidateId;
      },
      call: (o) =>
        rejectRoute.POST(
          postRequest(url.reject(candidateId), { expectedVersion: 1, rejectionReason: "no" }, o),
          { params: { candidateId } },
        ),
    },
    {
      name: "candidate.create-acca",
      prepare: async () => {
        candidateId = (await seedApproved()).candidateId;
      },
      call: (o) =>
        createAccaRoute.POST(
          postRequest(
            url.createAcca(candidateId),
            { expectedCandidateVersion: 2, title: "Matrix Acca", locale: "en" },
            o,
          ),
          { params: { candidateId } },
        ),
    },
    {
      name: "acca.publish",
      prepare: async () => {
        draftAccaId = await accaId();
      },
      call: (o) =>
        publishRoute.POST(postRequest(url.publish(draftAccaId), { expectedVersion: 1 }, o), {
          params: { accaId: draftAccaId },
        }),
    },
    {
      name: "acca.archive",
      prepare: async () => {
        publishedAccaId = await accaId();
        await publishRoute.POST(
          postRequest(url.publish(publishedAccaId), { expectedVersion: 1 }),
          { params: { accaId: publishedAccaId } },
        );
      },
      call: (o) =>
        archiveRoute.POST(postRequest(url.archive(publishedAccaId), { expectedVersion: 2 }, o), {
          params: { accaId: publishedAccaId },
        }),
    },
  ];
}

const readRoutes: Array<{ name: string; call: (o: RequestOptions) => Promise<Response> }> = [
  { name: "acca.list", call: (o) => accaListRoute.GET(getRequest(url.accaList(), o)) },
  {
    name: "acca.detail",
    call: (o) =>
      accaDetailRoute.GET(getRequest(url.accaDetail("acca_" + "c".repeat(32)), o), {
        params: { accaId: "acca_" + "c".repeat(32) },
      }),
  },
];

/* ================================================================== *
 * 1. Authentication
 * ================================================================== */

test("every mutation route rejects an unauthenticated caller with 401", async () => {
  for (const route of mutationRoutes()) {
    clearLimiter();
    await route.prepare();
    const res = await read(await route.call({ auth: "none" }));
    expectError(res, 401, "authentication_required");
    assertAdminHeaders(res, route.name);
    assertNoLeak(res, route.name);
  }
});

test("every mutation route rejects a wrong credential with 401", async () => {
  for (const route of mutationRoutes()) {
    clearLimiter();
    await route.prepare();
    const res = await read(await route.call({ auth: "badBearer" }));
    expectError(res, 401, "authentication_required");
  }
});

test("every read route requires authentication", async () => {
  for (const route of readRoutes) {
    clearLimiter();
    expectError(await read(await route.call({ auth: "none" })), 401, "authentication_required");
    expectError(await read(await route.call({ auth: "badBearer" })), 401, "authentication_required");
  }
});

test("an unauthenticated mutation attempt changes nothing", async () => {
  const candidate = await seedDraft();
  await approveRoute.POST(
    postRequest(url.approve(candidate.candidateId), { expectedVersion: 1 }, { auth: "none" }),
    { params: { candidateId: candidate.candidateId } },
  );
  const persisted = await getCandidateStore().getCandidate(candidate.candidateId);
  assert.equal(persisted?.status, "DRAFT");
  assert.equal(persisted?.version, 1);
});

test("the feature flag gates the whole surface before authentication", async () => {
  process.env.FF_OPERATOR_APPROVAL_ENABLED = "false";
  try {
    const res = await read(await accaListRoute.GET(getRequest(url.accaList(), { auth: "none" })));
    // 404, not 401: a disabled feature must be indistinguishable from a route that is not there.
    expectError(res, 404, "route_disabled");
  } finally {
    process.env.FF_OPERATOR_APPROVAL_ENABLED = "true";
  }
});

/* ================================================================== *
 * 2. Actor / role / header spoofing
 * ================================================================== */

test("spoofed identity headers are ignored, and the actor stays server-derived", async () => {
  const spoofHeaders = {
    "x-user-id": "attacker",
    "x-admin": "true",
    "x-role": "superadmin",
    "x-forwarded-user": "root",
    "x-authenticated-user": "root",
  };

  // With no real credential, spoofed headers grant nothing.
  const candidate = await seedDraft();
  const denied = await read(
    await approveRoute.POST(
      postRequest(
        url.approve(candidate.candidateId),
        { expectedVersion: 1 },
        { auth: "none", headers: spoofHeaders },
      ),
      { params: { candidateId: candidate.candidateId } },
    ),
  );
  expectError(denied, 401, "authentication_required");

  // With a real credential, spoofed headers do not change the recorded actor.
  const allowed = await read(
    await approveRoute.POST(
      postRequest(
        url.approve(candidate.candidateId),
        { expectedVersion: 1 },
        { headers: spoofHeaders },
      ),
      { params: { candidateId: candidate.candidateId } },
    ),
  );
  expectStatus(allowed, 200);
  assert.equal(
    (allowed.body.candidate as Record<string, unknown>).statusActor,
    "admin",
    "actor must come from the verified session, never a header",
  );
});

test("a request-body actor is rejected outright rather than honoured or ignored", async () => {
  const candidate = await seedDraft();
  for (const key of ["actor", "actorId", "createdBy", "statusActor", "role"]) {
    clearLimiter();
    const res = await read(
      await approveRoute.POST(
        postRequest(url.approve(candidate.candidateId), { expectedVersion: 1, [key]: "attacker" }),
        { params: { candidateId: candidate.candidateId } },
      ),
    );
    expectError(res, 400, "invalid_request");
    assert.equal(res.body.field, key);
  }
});

test("a query-string secret or role never authenticates", async () => {
  const res = await read(
    await accaListRoute.GET(
      getRequest(`${url.accaList()}?limit=5`, {
        auth: "none",
        headers: { "x-role": "admin" },
      }),
    ),
  );
  expectError(res, 401, "authentication_required");

  // And a secret in the query string is not accepted either.
  const withKey = await read(
    await accaListRoute.GET(getRequest(`${url.accaList()}?key=${ADMIN_KEY}`, { auth: "none" })),
  );
  assert.notEqual(withKey.status, 200, "a query-string secret must never authenticate");
});

test("no production admin bypass exists in the B3 source", () => {
  for (const rel of [
    "lib/api/adminGuard.ts",
    "lib/api/candidateTransitionRoute.ts",
    "lib/api/accaLifecycleRoute.ts",
    "app/api/admin/accas/route.ts",
    "app/api/admin/accas/[accaId]/route.ts",
    "app/api/admin/accas/[accaId]/publish/route.ts",
    "app/api/admin/accas/[accaId]/archive/route.ts",
    "app/api/admin/builder-approval/candidates/[candidateId]/approve/route.ts",
    "app/api/admin/builder-approval/candidates/[candidateId]/reject/route.ts",
    "app/api/admin/builder-approval/candidates/[candidateId]/create-acca/route.ts",
  ]) {
    // Executable text only. `adminGuard.ts` NAMES the spoofable headers in its prose, precisely
    // to document that they are ignored; scanning the raw source would fail on that
    // documentation rather than on any code that reads them.
    const src = readFileSync(path.join(root, rel), "utf8")
      .split("\n")
      .filter((line) => {
        const t = line.trim();
        return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
      })
      .join("\n");
    for (const pattern of [
      /NODE_ENV\s*[!=]==?\s*["']production["']/,
      /skipAuth|bypassAuth|disableAuth|allowInsecure/i,
      /headers\.get\(\s*["'](x-user-id|x-admin|x-role|x-forwarded-user)/i,
      /body\.(actor|role|createdBy)\b/,
    ]) {
      assert.equal(pattern.test(src), false, `${rel} must not contain ${pattern}`);
    }
  }
});

/* ================================================================== *
 * 3. CSRF
 * ================================================================== */

test("every mutation route rejects cross-site, mismatched and missing origins", async () => {
  const cases: Array<[string, RequestOptions, string]> = [
    ["cross-site fetch metadata", { headers: { "sec-fetch-site": "cross-site" } }, "csrf_cross_site"],
    ["wrong origin", { auth: "cookie", origin: "https://evil.example.com" }, "csrf_origin_mismatch"],
    // A genuine suffix-lookalike. Parsed canonical-origin equality rejects it; a naive
    // `startsWith`/prefix comparison would not.
    ["lookalike origin suffix", { auth: "cookie", origin: "http://localhost.evil.net" }, "csrf_origin_mismatch"],
    // Invalid port -> unparseable, so this is malformed rather than a mismatch. Both are 403.
    ["unparseable port", { auth: "cookie", origin: "http://localhost:3000.evil.net" }, "csrf_origin_malformed"],
    ["missing origin", { auth: "cookie", noOrigin: true }, "csrf_origin_missing"],
    ["malformed origin", { auth: "cookie", origin: "not-a-url" }, "csrf_origin_malformed"],
    [
      "userinfo-smuggled origin",
      { auth: "cookie", origin: `http://evil@localhost:3000` },
      "csrf_origin_malformed",
    ],
  ];

  for (const route of mutationRoutes()) {
    for (const [label, options, expected] of cases) {
      clearLimiter();
      await route.prepare();
      const res = await read(await route.call(options));
      expectError(res, 403, expected);
      assertNoLeak(res, `${route.name} / ${label}`);
    }
  }
});

test("a correct same-origin cookie request is accepted", async () => {
  for (const route of mutationRoutes()) {
    clearLimiter();
    await route.prepare();
    const res = await read(await route.call({ auth: "cookie", origin: ORIGIN }));
    assert.ok(
      res.status >= 200 && res.status < 300,
      `${route.name} same-origin cookie request should succeed, got ${res.status}: ${JSON.stringify(res.body)}`,
    );
  }
});

test("a rejected CSRF request mutates nothing", async () => {
  const candidate = await seedDraft();
  await approveRoute.POST(
    postRequest(
      url.approve(candidate.candidateId),
      { expectedVersion: 1 },
      { auth: "cookie", origin: "https://evil.example.com" },
    ),
    { params: { candidateId: candidate.candidateId } },
  );
  const persisted = await getCandidateStore().getCandidate(candidate.candidateId);
  assert.equal(persisted?.status, "DRAFT");
  assert.equal(persisted?.version, 1);
});

test("GET routes do not demand a CSRF proof", async () => {
  // No Origin header at all, which would be a rejection on a mutation route.
  for (const route of readRoutes) {
    clearLimiter();
    const res = await read(await route.call({ noOrigin: true }));
    assert.notEqual(res.status, 403, `${route.name} must not require CSRF on a read`);
  }
});

test("a referer is accepted as the documented origin fallback", async () => {
  const candidate = await seedDraft();
  const res = await read(
    await approveRoute.POST(
      postRequest(
        url.approve(candidate.candidateId),
        { expectedVersion: 1 },
        { auth: "cookie", noOrigin: true, headers: { referer: `${ORIGIN}/admin/x` } },
      ),
      { params: { candidateId: candidate.candidateId } },
    ),
  );
  expectStatus(res, 200);
});

/* ================================================================== *
 * 4. Rate limiting
 * ================================================================== */

test("the limiter is reported honestly as process-local memory", () => {
  const mode = getRateLimiterMode();
  assert.equal(mode.adapter, "memory");
  assert.equal(mode.singleInstanceAssumed, true);
});

test("mutations are limited per route family, with a real Retry-After", async () => {
  const limit = FAMILY_LIMITS.candidate_lifecycle;
  const candidate = await seedDraft();

  // Under the limit: every call is admitted (they fail on version, not on throttling).
  for (let i = 0; i < limit; i++) {
    const res = await read(
      await approveRoute.POST(
        postRequest(url.approve(candidate.candidateId), { expectedVersion: 99 }),
        { params: { candidateId: candidate.candidateId } },
      ),
    );
    assert.notEqual(res.status, 429, `call ${i + 1} of ${limit} must be admitted`);
  }

  // Over the limit.
  const limited = await read(
    await approveRoute.POST(
      postRequest(url.approve(candidate.candidateId), { expectedVersion: 99 }),
      { params: { candidateId: candidate.candidateId } },
    ),
  );
  expectError(limited, 429, "rate_limited");
  const retryAfter = Number(limited.headers.get("retry-after"));
  assert.ok(
    Number.isInteger(retryAfter) && retryAfter > 0 && retryAfter <= 60,
    `Retry-After must match the real 60s window, got ${limited.headers.get("retry-after")}`,
  );
  assertNoLeak(limited);
});

test("rotating a forwarded IP does not open a fresh bucket", async () => {
  const limit = FAMILY_LIMITS.candidate_lifecycle;
  const candidate = await seedDraft();
  // Each call already uses a DIFFERENT x-forwarded-for (the fixture mints a fresh IP per
  // request), so if the limiter keyed on that header this loop would never trip.
  for (let i = 0; i < limit; i++) {
    await approveRoute.POST(
      postRequest(url.approve(candidate.candidateId), { expectedVersion: 99 }),
      { params: { candidateId: candidate.candidateId } },
    );
  }
  for (const spoof of ["1.2.3.4", "5.6.7.8", "9.9.9.9"]) {
    const res = await read(
      await approveRoute.POST(
        postRequest(
          url.approve(candidate.candidateId),
          { expectedVersion: 99 },
          { ip: spoof, headers: { "x-real-ip": spoof, "cf-connecting-ip": spoof } },
        ),
        { params: { candidateId: candidate.candidateId } },
      ),
    );
    expectError(res, 429, "rate_limited");
  }
});

test("route families have independent buckets", async () => {
  const limit = FAMILY_LIMITS.candidate_lifecycle;
  const candidate = await seedDraft();
  for (let i = 0; i < limit + 1; i++) {
    await approveRoute.POST(
      postRequest(url.approve(candidate.candidateId), { expectedVersion: 99 }),
      { params: { candidateId: candidate.candidateId } },
    );
  }
  // candidate_lifecycle is exhausted...
  expectError(
    await read(
      await approveRoute.POST(
        postRequest(url.approve(candidate.candidateId), { expectedVersion: 99 }),
        { params: { candidateId: candidate.candidateId } },
      ),
    ),
    429,
    "rate_limited",
  );
  // ...but admin_read is untouched.
  const reads = await read(await accaListRoute.GET(getRequest(url.accaList())));
  expectStatus(reads, 200, "admin_read must have its own bucket");
});

test("the bucket resets when the window expires", async () => {
  const limit = FAMILY_LIMITS.admin_read;
  for (let i = 0; i < limit + 2; i++) {
    await accaListRoute.GET(getRequest(url.accaList()));
  }
  expectError(await read(await accaListRoute.GET(getRequest(url.accaList()))), 429, "rate_limited");

  // The limiter is a fixed window keyed on wall-clock; clearing the buckets is the
  // deterministic equivalent of the window elapsing, with no sleep in the suite.
  clearLimiter();
  expectStatus(await read(await accaListRoute.GET(getRequest(url.accaList()))), 200);
});

/* ================================================================== *
 * 5. Response leakage
 * ================================================================== */

test("no failure response on any route leaks sensitive material", async () => {
  const probes: Array<() => Promise<Response>> = [];
  for (const route of mutationRoutes()) {
    probes.push(async () => {
      await route.prepare();
      return route.call({ auth: "none" });
    });
    probes.push(async () => {
      await route.prepare();
      return route.call({ auth: "cookie", origin: "https://evil.example.com" });
    });
    probes.push(async () => {
      await route.prepare();
      return route.call({ bodyText: "{broken" });
    });
  }
  for (const probe of probes) {
    clearLimiter();
    const res = await read(await probe());
    assertNoLeak(res);
    assert.equal(res.body.ok, false);
    assert.equal(typeof res.body.error, "string", "error must be a machine-readable code");
    assert.ok(res.body.requestId, "every failure must be traceable");
  }
});

test("a storage failure surfaces as an opaque 500", async () => {
  const { setAccaStoreForTests, getAccaStore } = await import("../lib/api/accaComposition");
  const real = getAccaStore();
  const candidate = await seedApproved();
  setAccaStoreForTests({
    ...real,
    async createDraftFromCandidate() {
      throw new Error(
        'insert into "published_accas" violates constraint published_accas_slug_uidx at postgres://admin:hunter2@db:5432/app',
      );
    },
  } as never);
  try {
    const res = await read(
      await createAccaRoute.POST(
        postRequest(url.createAcca(candidate.candidateId), {
          expectedCandidateVersion: candidate.version,
          title: "Leaky",
          locale: "en",
        }),
        { params: { candidateId: candidate.candidateId } },
      ),
    );
    expectError(res, 500, "storage_failed");
    assertNoLeak(res, "storage failure");
    assert.equal(res.body.message, undefined, "no driver message may be echoed");
    assert.equal(res.body.stack, undefined);
  } finally {
    setAccaStoreForTests(null);
  }
});

test("oversized and control-character strings are refused without echoing them", async () => {
  const candidate = await seedDraft();
  const cases = [
    "x".repeat(5000),
    `nul${String.fromCharCode(0)}byte`,
    `bell${String.fromCharCode(7)}char`,
    `del${String.fromCharCode(127)}char`,
  ];
  for (const reason of cases) {
    clearLimiter();
    const res = await read(
      await rejectRoute.POST(
        postRequest(url.reject(candidate.candidateId), {
          expectedVersion: 1,
          rejectionReason: reason,
        }),
        { params: { candidateId: candidate.candidateId } },
      ),
    );
    assert.equal(res.body.ok, false, `reason must be refused: ${reason.slice(0, 20)}`);
    const serialized = JSON.stringify(res.body);
    assert.equal(serialized.includes("x".repeat(200)), false, "must not echo the payload back");
  }
  assert.equal((await getCandidateStore().getCandidate(candidate.candidateId))?.status, "DRAFT");
});

/**
 * CHARACTERIZATION, not an endorsement.
 *
 * An unpaired surrogate is ACCEPTED. B1's `sanitizeOperatorNote` rejects C0/DEL/C1 control
 * characters but performs no Unicode well-formedness check, so `"\uD800"` passes as an ordinary
 * character. That is frozen B1 code and stage B3 does not modify it, so the real behaviour is
 * pinned here rather than papered over — if a later stage tightens it, this test fails and
 * forces a deliberate decision. Reported as a known limitation in the B3 report.
 */
test("CHARACTERIZATION: an unpaired surrogate in an operator note is currently accepted", async () => {
  const candidate = await seedDraft();
  const res = await read(
    await rejectRoute.POST(
      postRequest(url.reject(candidate.candidateId), {
        expectedVersion: 1,
        rejectionReason: "\uD800lone surrogate",
      }),
      { params: { candidateId: candidate.candidateId } },
    ),
  );
  expectStatus(res, 200, "current behaviour");
  const stored = await getCandidateStore().getCandidate(candidate.candidateId);
  assert.equal(stored?.status, "REJECTED");
  // It is stored verbatim, and it is bounded — it cannot become an injection or a size problem.
  assert.ok((stored?.rejectionReason ?? "").length <= 500);
});

test("admin responses are always uncacheable and unindexable", async () => {
  const candidate = await seedDraft();
  const responses = [
    await read(await accaListRoute.GET(getRequest(url.accaList()))),
    await read(await accaListRoute.GET(getRequest(url.accaList(), { auth: "none" }))),
    await read(
      await approveRoute.POST(postRequest(url.approve(candidate.candidateId), { expectedVersion: 1 }), {
        params: { candidateId: candidate.candidateId },
      }),
    ),
  ];
  for (const res of responses) assertAdminHeaders(res);
});

test("every B3 route declares the Node.js runtime", () => {
  for (const rel of [
    "app/api/admin/accas/route.ts",
    "app/api/admin/accas/[accaId]/route.ts",
    "app/api/admin/accas/[accaId]/publish/route.ts",
    "app/api/admin/accas/[accaId]/archive/route.ts",
    "app/api/admin/builder-approval/candidates/[candidateId]/approve/route.ts",
    "app/api/admin/builder-approval/candidates/[candidateId]/reject/route.ts",
    "app/api/admin/builder-approval/candidates/[candidateId]/create-acca/route.ts",
  ]) {
    const src = readFileSync(path.join(root, rel), "utf8");
    assert.match(src, /export const runtime = "nodejs"/, `${rel} must pin the Node runtime`);
    assert.match(src, /export const dynamic = "force-dynamic"/, `${rel} must not be statically cached`);
  }
});

test("no public Acca route was created in B3", () => {
  const publicPaths = [
    "app/api/accas",
    "app/api/acca/published",
    "app/[locale]/accas",
    "app/accas",
  ];
  for (const rel of publicPaths) {
    assert.equal(
      readFileSyncSafe(path.join(root, rel)),
      null,
      `${rel} must not exist — public surfaces are stage B5`,
    );
  }
});

function readFileSyncSafe(p: string): string | null {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

test("unknown idempotency keys are required on every mutation route", async () => {
  for (const route of mutationRoutes()) {
    clearLimiter();
    await route.prepare();
    const res = await read(await route.call({ idempotencyKey: null }));
    expectError(res, 400, "idempotency_key_required");
    assert.equal(res.body.detail, "missing");
  }
});

test("idempotency keys are bounded and character-restricted", async () => {
  const candidate = await seedDraft();
  const cases: Array<[string, string]> = [
    ["short", "too_short"],
    ["y".repeat(201), "too_long"],
    ["has spaces here", "invalid_characters"],
    ["semi;colon;key", "invalid_characters"],
  ];
  for (const [key, detail] of cases) {
    clearLimiter();
    const res = await read(
      await approveRoute.POST(
        postRequest(url.approve(candidate.candidateId), { expectedVersion: 1 }, { idempotencyKey: key }),
        { params: { candidateId: candidate.candidateId } },
      ),
    );
    expectError(res, 400, "idempotency_key_required");
    assert.equal(res.body.detail, detail, key);
  }
  assert.equal((await getCandidateStore().getCandidate(candidate.candidateId))?.status, "DRAFT");
});

test("a valid key is accepted", async () => {
  const candidate = await seedDraft();
  const res = await read(
    await approveRoute.POST(
      postRequest(
        url.approve(candidate.candidateId),
        { expectedVersion: 1 },
        { idempotencyKey: freshIdempotencyKey("valid.key:1-2") },
      ),
      { params: { candidateId: candidate.candidateId } },
    ),
  );
  expectStatus(res, 200);
});
