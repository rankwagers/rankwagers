import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { getCandidateStore } from "../lib/builder-approval/store";
import { getAccaService } from "../lib/api/accaComposition";
import { getPublishedAccaBySlug, listPublishedAccas } from "../lib/acca-publication/public";
import type { AccaRecord } from "../lib/acca-publication/contracts";
import { toPublicAccaView } from "../lib/acca-publication/publicView";
import { FIXTURE_COMBINED_ODDS } from "./accaFixtures";
import {
  clearLimiter,
  expectError,
  expectStatus,
  freshIdempotencyKey,
  getRequest,
  installTestEnv,
  postRequest,
  read,
  resetAll,
  seedDraft,
  url,
} from "./accaApiFixtures";
import * as approveRoute from "../app/api/admin/builder-approval/candidates/[candidateId]/approve/route";
import * as rejectRoute from "../app/api/admin/builder-approval/candidates/[candidateId]/reject/route";
import * as createAccaRoute from "../app/api/admin/builder-approval/candidates/[candidateId]/create-acca/route";
import * as accaListRoute from "../app/api/admin/accas/route";
import * as publishRoute from "../app/api/admin/accas/[accaId]/publish/route";
import * as archiveRoute from "../app/api/admin/accas/[accaId]/archive/route";

/**
 * Sprint 20B-B stage B6 — end-to-end integration.
 *
 * Every stage has been verified in isolation. This suite verifies the SEAMS: it drives one
 * candidate through the entire journey using the real HTTP handlers, the real B2 persistence and
 * the real public read layer, asserting at each step that the state observed by the NEXT layer is
 * the state the previous one actually wrote.
 *
 * Nothing is mocked. The only substitution is the memory adapter, which is the configured default
 * when no connection string is present.
 *
 * MEMORY ADAPTERS ONLY. This proves the stages compose; it proves nothing about PostgreSQL.
 */

(globalThis as { React?: unknown }).React = require("react");

installTestEnv();
beforeEach(resetAll);

/* eslint-disable @typescript-eslint/no-var-requires */
const { PublicAccaIndexView } = require("../components/acca-publication/PublicAccaIndexView") as typeof import("../components/acca-publication/PublicAccaIndexView");
const { PublicAccaDetailView } = require("../components/acca-publication/PublicAccaDetailView") as typeof import("../components/acca-publication/PublicAccaDetailView");
const { HomepagePublishedAccas } = require("../components/homepage/HomepagePublishedAccas") as typeof import("../components/homepage/HomepagePublishedAccas");
const accaSitemap = (require("../app/sitemap") as { default: (p: { id: string }) => Promise<Array<{ url: string }>> }).default;
/* eslint-enable @typescript-eslint/no-var-requires */

const html = (tree: unknown): string => renderToStaticMarkup(tree as never);

/**
 * Sprint 24 — the public components take the redacted public projection rather than the storage
 * record. A fixed clock keeps freshness derivation deterministic; every assertion is unchanged.
 */
const NOW = "2026-08-02T09:00:00.000Z";
const view = (acca: AccaRecord) => toPublicAccaView(acca, NOW);

const approve = (id: string, body: unknown) =>
  approveRoute.POST(postRequest(url.approve(id), body), { params: { candidateId: id } });
const reject = (id: string, body: unknown) =>
  rejectRoute.POST(postRequest(url.reject(id), body), { params: { candidateId: id } });
const createAcca = (id: string, body: unknown) =>
  createAccaRoute.POST(postRequest(url.createAcca(id), body), { params: { candidateId: id } });
const publish = (id: string, body: unknown) =>
  publishRoute.POST(postRequest(url.publish(id), body), { params: { accaId: id } });
const archive = (id: string, body: unknown) =>
  archiveRoute.POST(postRequest(url.archive(id), body), { params: { accaId: id } });

/* ================================================================== *
 * 1. The complete journey
 * ================================================================== */

test("E2E: DRAFT candidate -> approved -> Acca -> published -> public -> archived -> gone", async () => {
  /* ---- step 1: a candidate exists, and nothing is public ---- */
  const candidate = await seedDraft();
  assert.equal(candidate.status, "DRAFT");
  assert.equal((await listPublishedAccas({ locale: "en" })).rows.length, 0);
  assert.equal(await HomepagePublishedAccas({ locale: "en" }), null);
  assert.deepEqual(await accaSitemap({ id: "accas" }), []);

  /* ---- step 2: approve over HTTP ---- */
  clearLimiter();
  const approved = await read(await approve(candidate.candidateId, { expectedVersion: 1 }));
  expectStatus(approved, 200, "approve");
  assert.equal((approved.body.candidate as Record<string, unknown>).status, "APPROVED");

  // The store the NEXT layer will read reflects it.
  const afterApprove = await getCandidateStore().getCandidate(candidate.candidateId);
  assert.equal(afterApprove?.status, "APPROVED");
  assert.equal(afterApprove?.version, 2);
  // Approval alone publishes nothing.
  assert.equal((await listPublishedAccas({ locale: "en" })).rows.length, 0);

  /* ---- step 3: convert to an Acca over HTTP ---- */
  clearLimiter();
  const created = await read(
    await createAcca(candidate.candidateId, {
      expectedCandidateVersion: 2,
      title: "Saturday two-fold review",
      summary: "Both selections came from the same qualified list.",
      locale: "en",
    }),
  );
  expectStatus(created, 201, "create-acca");
  const accaSummary = created.body.acca as Record<string, unknown>;
  const accaId = String(accaSummary.accaId);
  const slug = String(accaSummary.slug);

  // B2's atomic conversion is observable on the real candidate store.
  const afterConvert = await getCandidateStore().getCandidate(candidate.candidateId);
  assert.equal(afterConvert?.status, "CONVERTED");
  assert.equal(afterConvert?.version, 3, "exactly one further increment");
  assert.equal(afterConvert?.convertedAccaId, accaId);
  // The server recomputed the price; it did not echo the candidate's own total.
  assert.equal(accaSummary.combinedOdds, FIXTURE_COMBINED_ODDS);

  // A DRAFT Acca is admin-visible but not public.
  const adminList = await read(await accaListRoute.GET(getRequest(url.accaList())));
  expectStatus(adminList, 200, "admin list");
  assert.equal((adminList.body.accas as unknown[]).length, 1);
  assert.equal((await listPublishedAccas({ locale: "en" })).rows.length, 0, "a draft is not public");
  assert.equal(await getPublishedAccaBySlug({ slug, locale: "en" }), null);
  assert.equal(await HomepagePublishedAccas({ locale: "en" }), null);
  assert.deepEqual(await accaSitemap({ id: "accas" }), [], "a draft is never in the sitemap");

  /* ---- step 4: publish over HTTP ---- */
  clearLimiter();
  const published = await read(await publish(accaId, { expectedVersion: 1 }));
  expectStatus(published, 200, "publish");
  assert.equal((published.body.acca as Record<string, unknown>).status, "PUBLISHED");
  assert.equal((published.body.acca as Record<string, unknown>).version, 2);

  /* ---- step 5: it is now genuinely public, on every surface ---- */
  const publicPage = await listPublishedAccas({ locale: "en" });
  assert.equal(publicPage.rows.length, 1, "published Acca is publicly listed");
  assert.equal(publicPage.indexable, true, "the index is now worth indexing");

  const publicAcca = await getPublishedAccaBySlug({ slug, locale: "en" });
  assert.ok(publicAcca, "the public detail page resolves");
  assert.equal(publicAcca.accaId, accaId);

  const detailHtml = html(PublicAccaDetailView({ view: view(publicAcca) }));
  assert.ok(detailHtml.includes("Saturday two-fold review"));
  assert.ok(detailHtml.includes("2.55"), "the recomputed price reaches the reader");
  assert.match(detailHtml, /not a recommendation or a tip/);

  const homepage = await HomepagePublishedAccas({ locale: "en" });
  assert.notEqual(homepage, null, "the homepage section appears");
  assert.ok(html(homepage).includes("Saturday two-fold review"));

  const sitemapEntries = await accaSitemap({ id: "accas" });
  assert.equal(sitemapEntries.filter((e) => e.url.includes(slug)).length, 1);
  assert.equal(sitemapEntries.filter((e) => e.url.endsWith("/en/accas")).length, 1);

  /* ---- step 6: archive over HTTP ---- */
  clearLimiter();
  const archived = await read(await archive(accaId, { expectedVersion: 2 }));
  expectStatus(archived, 200, "archive");
  assert.equal((archived.body.acca as Record<string, unknown>).status, "ARCHIVED");
  assert.equal((archived.body.acca as Record<string, unknown>).version, 3);

  /* ---- step 7: every public surface withdraws immediately ---- */
  assert.equal((await listPublishedAccas({ locale: "en" })).rows.length, 0, "delisted");
  assert.equal(await getPublishedAccaBySlug({ slug, locale: "en" }), null, "detail 404s");
  assert.equal(await HomepagePublishedAccas({ locale: "en" }), null, "homepage section hides");
  assert.deepEqual(await accaSitemap({ id: "accas" }), [], "sitemap withdraws");

  // But it remains fully visible to an operator, with its publication history intact.
  const adminAfter = await read(await accaListRoute.GET(getRequest(url.accaList())));
  const rows = adminAfter.body.accas as Array<Record<string, unknown>>;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "ARCHIVED");
  assert.ok(rows[0].publishedAt, "publication history survives archiving");
  assert.ok(rows[0].archivedAt);
});

/* ================================================================== *
 * 2. The rejection branch
 * ================================================================== */

test("E2E: a rejected candidate can never reach any public surface", async () => {
  const candidate = await seedDraft();
  clearLimiter();
  const rejected = await read(
    await reject(candidate.candidateId, {
      expectedVersion: 1,
      rejectionReason: "Kick-off times too close together.",
    }),
  );
  expectStatus(rejected, 200, "reject");

  // Conversion is refused, so no Acca can exist.
  clearLimiter();
  const attempt = await read(
    await createAcca(candidate.candidateId, {
      expectedCandidateVersion: 2,
      title: "Should never exist",
      locale: "en",
    }),
  );
  expectError(attempt, 409, "candidate_status_conflict");

  assert.equal((await listPublishedAccas({ locale: "en" })).rows.length, 0);
  assert.deepEqual(await accaSitemap({ id: "accas" }), []);
  const admin = await read(await accaListRoute.GET(getRequest(url.accaList())));
  assert.equal(admin.body.total, 0, "no Acca was created at all");
});

/* ================================================================== *
 * 3. Cross-stage invariants under the full pipeline
 * ================================================================== */

test("E2E: one candidate yields at most one public page, even under retry", async () => {
  const candidate = await seedDraft();
  clearLimiter();
  await approve(candidate.candidateId, { expectedVersion: 1 });

  const key = freshIdempotencyKey();
  const body = { expectedCandidateVersion: 2, title: "Only once", locale: "en" };

  clearLimiter();
  const first = await read(
    await createAccaRoute.POST(
      postRequest(url.createAcca(candidate.candidateId), body, { idempotencyKey: key }),
      { params: { candidateId: candidate.candidateId } },
    ),
  );
  expectStatus(first, 201);
  // Same key -> replay, no second Acca.
  const replay = await read(
    await createAccaRoute.POST(
      postRequest(url.createAcca(candidate.candidateId), body, { idempotencyKey: key }),
      { params: { candidateId: candidate.candidateId } },
    ),
  );
  expectStatus(replay, 201);
  assert.equal(replay.body.replayed, true);
  // Fresh key -> refused by the domain, still no second Acca.
  const retry = await read(
    await createAccaRoute.POST(
      postRequest(url.createAcca(candidate.candidateId), body, {
        idempotencyKey: freshIdempotencyKey(),
      }),
      { params: { candidateId: candidate.candidateId } },
    ),
  );
  expectError(retry, 409, "candidate_already_converted");

  const admin = await read(await accaListRoute.GET(getRequest(url.accaList())));
  assert.equal(admin.body.total, 1, "exactly one Acca for this candidate");
});

test("E2E: the published page shows the price the server calculated, not the candidate's claim", async () => {
  // The fixture candidate carries a deliberately wrong combinedOdds of 999.99.
  const candidate = await seedDraft();
  const stored = await getCandidateStore().getCandidate(candidate.candidateId);
  const combination = (stored?.payload as Record<string, Record<string, unknown>>).combination;
  assert.equal(combination.combinedOdds, 999.99, "the fixture's bogus total is really stored");

  clearLimiter();
  await approve(candidate.candidateId, { expectedVersion: 1 });
  clearLimiter();
  const created = await read(
    await createAcca(candidate.candidateId, {
      expectedCandidateVersion: 2,
      title: "Price integrity",
      locale: "en",
    }),
  );
  const accaId = String((created.body.acca as Record<string, unknown>).accaId);
  clearLimiter();
  await publish(accaId, { expectedVersion: 1 });

  const publicAcca = await getPublishedAccaBySlug({
    slug: String((created.body.acca as Record<string, unknown>).slug),
    locale: "en",
  });
  assert.ok(publicAcca);
  assert.equal(publicAcca.combinedOdds, FIXTURE_COMBINED_ODDS);

  const markup = html(PublicAccaDetailView({ view: view(publicAcca) }));
  assert.equal(markup.includes("999.99"), false, "the bogus total must never reach a reader");
  assert.ok(markup.includes("2.55"));
});

test("E2E: locale routing holds from creation through to the sitemap", async () => {
  // "es" is a real locale in lib/i18n. B6 found that a well-shaped but UNSERVED locale (e.g.
  // "tr") produced an unreachable Acca; the create route now refuses those, and the case is
  // covered separately below.
  const enCandidate = await seedDraft();
  const esCandidate = await seedDraft();

  for (const [candidate, locale, title] of [
    [enCandidate, "en", "English review"],
    [esCandidate, "es", "Spanish review"],
  ] as Array<[typeof enCandidate, string, string]>) {
    clearLimiter();
    await approve(candidate.candidateId, { expectedVersion: 1 });
    clearLimiter();
    const created = await read(
      await createAcca(candidate.candidateId, {
        expectedCandidateVersion: 2,
        title,
        locale,
      }),
    );
    expectStatus(created, 201, `create ${locale}`);
    clearLimiter();
    await publish(String((created.body.acca as Record<string, unknown>).accaId), {
      expectedVersion: 1,
    });
  }

  const en = await listPublishedAccas({ locale: "en" });
  const es = await listPublishedAccas({ locale: "es" });
  assert.equal(en.rows.length, 1);
  assert.equal(es.rows.length, 1);
  assert.equal(en.rows[0].title, "English review");
  assert.equal(es.rows[0].title, "Spanish review");

  // Each Acca appears exactly once in the sitemap, under its own locale.
  const entries = await accaSitemap({ id: "accas" });
  const detailUrls = entries.map((e) => e.url).filter((u) => !u.endsWith("/accas"));
  assert.equal(detailUrls.length, 2, "one URL per Acca, never one per locale");
  assert.equal(detailUrls.filter((u) => u.includes("/en/accas/")).length, 1);
  assert.equal(detailUrls.filter((u) => u.includes("/es/accas/")).length, 1);

  // The index page for each locale shows only its own.
  assert.ok(html(PublicAccaIndexView({ locale: "en", views: en.rows.map(view) })).includes("English review"));
  assert.equal(
    html(PublicAccaIndexView({ locale: "en", views: en.rows.map(view) })).includes("Spanish review"),
    false,
  );
});

/* ================================================================== *
 * 4. The feature flag governs the whole chain
 * ================================================================== */

test("E2E: disabling the flag closes the admin surface without touching stored state", async () => {
  const candidate = await seedDraft();
  clearLimiter();
  await approve(candidate.candidateId, { expectedVersion: 1 });
  clearLimiter();
  const created = await read(
    await createAcca(candidate.candidateId, {
      expectedCandidateVersion: 2,
      title: "Flag test",
      locale: "en",
    }),
  );
  const accaId = String((created.body.acca as Record<string, unknown>).accaId);
  clearLimiter();
  await publish(accaId, { expectedVersion: 1 });
  assert.equal((await listPublishedAccas({ locale: "en" })).rows.length, 1);

  process.env.FF_OPERATOR_APPROVAL_ENABLED = "false";
  try {
    clearLimiter();
    // Every admin endpoint becomes indistinguishable from a route that does not exist.
    expectError(
      await read(await accaListRoute.GET(getRequest(url.accaList()))),
      404,
      "route_disabled",
    );
    expectError(
      await read(await publish(accaId, { expectedVersion: 2 })),
      404,
      "route_disabled",
    );
    expectError(
      await read(await approve(candidate.candidateId, { expectedVersion: 3 })),
      404,
      "route_disabled",
    );

    // Stored state is untouched by the flag.
    const stillThere = await getAccaService().getAcca(accaId);
    assert.ok(stillThere.ok);
    assert.equal(stillThere.acca.status, "PUBLISHED");
  } finally {
    process.env.FF_OPERATOR_APPROVAL_ENABLED = "true";
  }
});

/* ================================================================== *
 * 5. Ordering and integrity across many records
 * ================================================================== */

test("E2E: many Accas keep deterministic public ordering and unique slugs", async () => {
  const published: string[] = [];
  for (let i = 0; i < 6; i++) {
    const candidate = await seedDraft();
    clearLimiter();
    await approve(candidate.candidateId, { expectedVersion: 1 });
    clearLimiter();
    const created = await read(
      await createAcca(candidate.candidateId, {
        expectedCandidateVersion: 2,
        // Identical titles on purpose: the slug discriminator must keep them distinct.
        title: "Identical headline",
        locale: "en",
      }),
    );
    expectStatus(created, 201, `create ${i}`);
    const acca = created.body.acca as Record<string, unknown>;
    clearLimiter();
    await publish(String(acca.accaId), { expectedVersion: 1 });
    published.push(String(acca.slug));
  }

  assert.equal(new Set(published).size, 6, "six identical titles yielded six distinct slugs");

  const page = await listPublishedAccas({ locale: "en" });
  assert.equal(page.rows.length, 6);
  // Ordering is stable across repeated reads.
  const again = await listPublishedAccas({ locale: "en" });
  assert.deepEqual(
    page.rows.map((r) => r.accaId),
    again.rows.map((r) => r.accaId),
    "public ordering must be deterministic",
  );
  // Every published slug resolves to its own page.
  for (const slug of published) {
    const found = await getPublishedAccaBySlug({ slug, locale: "en" });
    assert.ok(found, `${slug} must resolve`);
    assert.equal(found.slug, slug);
  }

  const entries = await accaSitemap({ id: "accas" });
  const detail = entries.filter((e) => !e.url.endsWith("/accas"));
  assert.equal(detail.length, 6);
  assert.equal(new Set(detail.map((e) => e.url)).size, 6, "no duplicate sitemap URLs");
});

/* ================================================================== *
 * 6. Regression: the defect B6 integration found
 * ================================================================== */

test("E2E: a locale this site does not serve is refused, not silently stranded", async () => {
  const candidate = await seedDraft();
  clearLimiter();
  await approve(candidate.candidateId, { expectedVersion: 1 });

  // "tr" is well-shaped and passes the B2 domain check, but is NOT among the locales in
  // lib/i18n. Middleware only routes known locale prefixes, so an Acca published under it could
  // never be opened by any reader. Before this fix it was accepted and stranded.
  for (const badLocale of ["tr", "zz", "xx-YY"]) {
    clearLimiter();
    const res = await read(
      await createAcca(candidate.candidateId, {
        expectedCandidateVersion: 2,
        title: "Unreachable",
        locale: badLocale,
      }),
    );
    expectError(res, 400, "invalid_metadata");
    assert.equal(res.body.field, "locale");
    assert.equal(res.body.detail, "locale_not_served_by_this_site", badLocale);
  }

  // Nothing was created, and the candidate is untouched.
  const admin = await read(await accaListRoute.GET(getRequest(url.accaList())));
  assert.equal(admin.body.total, 0);
  const stillApproved = await getCandidateStore().getCandidate(candidate.candidateId);
  assert.equal(stillApproved?.status, "APPROVED");
  assert.equal(stillApproved?.version, 2);

  // A served locale still works.
  clearLimiter();
  const ok = await read(
    await createAcca(candidate.candidateId, {
      expectedCandidateVersion: 2,
      title: "Reachable",
      locale: "de",
    }),
  );
  expectStatus(ok, 201, "a served locale must still be accepted");
});