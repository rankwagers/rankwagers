import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test, { beforeEach } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { analyticsEventNames } from "../lib/analytics/types";
import { findClaimViolations, hasUnqualifiedRanking, stripComments } from "../lib/trust/claims";
import { getAccaService } from "../lib/api/accaComposition";
import { getFeatureFlags } from "../lib/config/featureFlags";
import type { AccaRecord } from "../lib/acca-publication/contracts";
import {
  PUBLIC_ACCA_ANALYTICS_EVENTS,
  PUBLIC_ACCA_ANALYTICS_PROPERTY_KEYS,
  publicAccaAnalyticsProperties,
} from "../lib/acca-publication/analytics";
import {
  ACCA_ODDS_STALE_AFTER_HOURS,
  accaFreshness,
  availabilityLabel,
  oddsFreshnessLabel,
  settlementLabel,
} from "../lib/acca-publication/freshness";
import {
  publicAccaCanonicalUrl,
  publicAccaIndexPath,
  publicAccaPath,
} from "../lib/acca-publication/paths";
import {
  PUBLIC_ACCA_MAX_SCAN,
  PUBLIC_ACCA_PAGE_SIZE,
  buildPublicAccaIndexPage,
  parsePublicAccaIndexQuery,
  publicAccaFacets,
  publicAccaIndexHref,
  type PublicAccaIndexQuery,
} from "../lib/acca-publication/publicIndex";
import {
  PUBLIC_ACCA_REDACTED_FIELDS,
  accaOddsBand,
  legEvidenceStrength,
  toPublicAccaView,
  type PublicAccaView,
} from "../lib/acca-publication/publicView";
import {
  getPublicAccaView,
  listPublicAccaViews,
  publicAccaPagesEnabled,
} from "../lib/acca-publication/public";
import { accaBreadcrumbLd, accaDetailLd, accaIndexLd } from "../lib/acca-publication/schema";
import { accaDetailDescription, accaDetailMetadata, accaIndexMetadata } from "../lib/acca-publication/seo";
import {
  clearLimiter,
  expectError,
  getRequest,
  installTestEnv,
  postRequest,
  read,
  resetAll,
  seedApproved,
  seedDraft,
  url,
} from "./accaApiFixtures";
import * as createAccaRoute from "../app/api/admin/builder-approval/candidates/[candidateId]/create-acca/route";
import * as publishRoute from "../app/api/admin/accas/[accaId]/publish/route";
import * as rejectRoute from "../app/api/admin/builder-approval/candidates/[candidateId]/reject/route";

/**
 * Sprint 24 — public Acca pages and shareable Accas.
 *
 * This sprint did NOT build a publication chain: Sprint 20B-B already did, and its domain,
 * persistence, atomicity, idempotency and admin-security suites still stand unchanged. What this
 * sprint added is the READER surface on top of it — freshness, the public/private field boundary,
 * filtering, pagination, sharing, analytics and the SEO that follows from all of it.
 *
 * These tests therefore assert the NEW guarantees and the boundaries between them and the
 * existing ones. Where a property is already proven elsewhere it is referenced rather than
 * re-implemented, except where the brief for this sprint names it explicitly — publication
 * idempotency and the draft/rejected refusals are re-asserted end to end here, through the real
 * HTTP handlers, because "publishing must consume the approved candidate exactly once" is the
 * precondition everything on the public page depends on.
 */

(globalThis as { React?: unknown }).React = require("react");

installTestEnv();
beforeEach(resetAll);

const root = process.cwd();
const readSource = (rel: string) => readFileSync(path.join(root, rel), "utf8");
const html = (tree: unknown): string => renderToStaticMarkup(tree as never);

/* eslint-disable @typescript-eslint/no-var-requires */
const { predictionsEn } = require("../lib/translations/predictionsEn") as typeof import("../lib/translations/predictionsEn");
const { PublicAccaIndexView } = require("../components/acca-publication/PublicAccaIndexView") as typeof import("../components/acca-publication/PublicAccaIndexView");
const { PublicAccaDetailView } = require("../components/acca-publication/PublicAccaDetailView") as typeof import("../components/acca-publication/PublicAccaDetailView");
const { PublicAccaCard } = require("../components/acca-publication/PublicAccaCard") as typeof import("../components/acca-publication/PublicAccaCard");
const { PublicAccaFilters } = require("../components/acca-publication/PublicAccaFilters") as typeof import("../components/acca-publication/PublicAccaFilters");
const { PublicAccaPagination } = require("../components/acca-publication/PublicAccaPagination") as typeof import("../components/acca-publication/PublicAccaPagination");
const { AccaShareControls } = require("../components/acca-publication/AccaShareControls") as typeof import("../components/acca-publication/AccaShareControls");
const indexRoute = require("../app/[locale]/accas/page") as typeof import("../app/[locale]/accas/page");
const detailRoute = require("../app/[locale]/accas/[slug]/page") as typeof import("../app/[locale]/accas/[slug]/page");
const accaSitemap = (require("../app/sitemap") as { default: (p: { id: string }) => Promise<Array<{ url: string }>> }).default;
/* eslint-enable @typescript-eslint/no-var-requires */

/** After the fixtures' kick-offs (2026-07-27T18:00Z) and after publication. */
const NOW_CLOSED = "2026-08-02T09:00:00.000Z";
/** Before the fixtures' kick-offs. */
const NOW_AHEAD = "2026-07-27T09:00:00.000Z";

const EMPTY_QUERY: PublicAccaIndexQuery = {
  page: 1,
  profile: null,
  competition: null,
  state: null,
};

/* ------------------------------------------------------------------ *
 * Seeding
 * ------------------------------------------------------------------ */

async function createDraft(title: string, locale = "en"): Promise<AccaRecord> {
  clearLimiter();
  const candidate = await seedApproved();
  const res = await read(
    await createAccaRoute.POST(
      postRequest(url.createAcca(candidate.candidateId), {
        expectedCandidateVersion: candidate.version,
        title,
        locale,
      }),
      { params: { candidateId: candidate.candidateId } },
    ),
  );
  assert.equal(res.status, 201, `seed failed: ${JSON.stringify(res.body)}`);
  const accaId = String((res.body.acca as Record<string, unknown>).accaId);
  const loaded = await getAccaService().getAcca(accaId);
  assert.ok(loaded.ok);
  return loaded.acca;
}

async function publishViaApi(acca: AccaRecord): Promise<AccaRecord> {
  clearLimiter();
  const res = await read(
    await publishRoute.POST(
      postRequest(url.publish(acca.accaId), { expectedVersion: acca.version }),
      { params: { accaId: acca.accaId } },
    ),
  );
  assert.equal(res.status, 200, `publish failed: ${JSON.stringify(res.body)}`);
  const loaded = await getAccaService().getAcca(acca.accaId);
  assert.ok(loaded.ok);
  return loaded.acca;
}

async function createPublished(title: string, locale = "en"): Promise<AccaRecord> {
  return publishViaApi(await createDraft(title, locale));
}

/** A record built by hand, for the pure functions. Never used where storage matters. */
function syntheticRecord(over: Partial<AccaRecord> = {}): AccaRecord {
  return {
    schemaVersion: "20b-b.1.0.0",
    accaId: "acca_synthetic_0000000000000000",
    sourceCandidateId: "cand_synthetic",
    status: "PUBLISHED",
    title: "Synthetic combination",
    summary: null,
    locale: "en",
    legs: [
      {
        matchId: 1,
        homeTeam: "Alpha",
        awayTeam: "Beta",
        competition: "League One",
        kickoffAt: "2026-07-27T18:00:00.000Z",
        marketKey: "over25",
        marketLabel: "Over 2.5 Goals",
        capturedOdds: 1.7,
        confidence: 70,
        evidenceSummary: ["Both sides average over 3 goals a game."],
      },
      {
        matchId: 2,
        homeTeam: "Gamma",
        awayTeam: "Delta",
        competition: "League Two",
        kickoffAt: "2026-07-28T18:00:00.000Z",
        marketKey: "over15",
        capturedOdds: 1.5,
      },
    ],
    combinedOdds: 2.55,
    evidenceSnapshot: { summary: ["Built from the daily qualified list."], warnings: [] },
    qualificationSnapshot: { legCount: 2, oddsComplete: true, riskMode: "balanced" },
    sourceReferences: {
      candidateId: "cand_synthetic",
      sourceRequestId: null,
      sourceSnapshotId: null,
      sourceDate: null,
      candidatePayloadChecksum: "checksum_synthetic_deadbeef",
      candidateChecksumVersion: "checksumversion_synthetic",
    },
    slug: "synthetic-combination-abcd",
    version: 2,
    createdAt: "2026-07-26T12:00:00.000Z",
    updatedAt: "2026-07-26T13:00:00.000Z",
    publishedAt: "2026-07-26T13:00:00.000Z",
    archivedAt: null,
    createdBy: "admin",
    publishedBy: "admin",
    archivedBy: null,
    ...over,
  };
}

function syntheticView(over: Partial<AccaRecord> = {}, now = NOW_CLOSED): PublicAccaView {
  return toPublicAccaView(syntheticRecord(over), now);
}

/* ================================================================== *
 * 1. Publication lifecycle — the precondition the public page rests on
 * ================================================================== */

test("PUBLICATION: an APPROVED candidate converts and publishes, and the public page appears", async () => {
  const acca = await createPublished("Approved and published");
  assert.equal(acca.status, "PUBLISHED");
  const view = await getPublicAccaView({ slug: acca.slug, locale: "en", now: NOW_CLOSED });
  assert.ok(view, "a published Acca must be publicly readable");
  assert.equal(view.publicId, acca.slug);
});

test("PUBLICATION: a DRAFT candidate cannot be converted", async () => {
  const draft = await seedDraft();
  const res = await read(
    await createAccaRoute.POST(
      postRequest(url.createAcca(draft.candidateId), {
        expectedCandidateVersion: draft.version,
        title: "Should not exist",
        locale: "en",
      }),
      { params: { candidateId: draft.candidateId } },
    ),
  );
  expectError(res, 409, "candidate_status_conflict");
});

test("PUBLICATION: a REJECTED candidate cannot be converted", async () => {
  const candidate = await seedDraft();
  clearLimiter();
  const rejected = await read(
    await rejectRoute.POST(
      postRequest(url.reject(candidate.candidateId), {
        expectedVersion: candidate.version,
        rejectionReason: "not suitable",
      }),
      { params: { candidateId: candidate.candidateId } },
    ),
  );
  assert.equal(rejected.status, 200, JSON.stringify(rejected.body));
  clearLimiter();
  const res = await read(
    await createAccaRoute.POST(
      postRequest(url.createAcca(candidate.candidateId), {
        expectedCandidateVersion: 2,
        title: "Should not exist",
        locale: "en",
      }),
      { params: { candidateId: candidate.candidateId } },
    ),
  );
  expectError(res, 409, "candidate_status_conflict");
});

test("PUBLICATION: a stale candidate version cannot be converted", async () => {
  const candidate = await seedApproved();
  clearLimiter();
  const res = await read(
    await createAccaRoute.POST(
      postRequest(url.createAcca(candidate.candidateId), {
        // The candidate is at version 2 after approval.
        expectedCandidateVersion: 1,
        title: "Stale precondition",
        locale: "en",
      }),
      { params: { candidateId: candidate.candidateId } },
    ),
  );
  expectError(res, 409, "candidate_version_conflict");
});

test("PUBLICATION: one candidate can never produce two public Accas", async () => {
  const candidate = await seedApproved();
  clearLimiter();
  const first = await read(
    await createAccaRoute.POST(
      postRequest(url.createAcca(candidate.candidateId), {
        expectedCandidateVersion: candidate.version,
        title: "Only once",
        locale: "en",
      }),
      { params: { candidateId: candidate.candidateId } },
    ),
  );
  assert.equal(first.status, 201);

  clearLimiter();
  const second = await read(
    await createAccaRoute.POST(
      postRequest(url.createAcca(candidate.candidateId), {
        expectedCandidateVersion: candidate.version,
        title: "Only once",
        locale: "en",
      }),
      { params: { candidateId: candidate.candidateId } },
    ),
  );
  assert.equal(second.status >= 400, true, "a second conversion must be refused");

  const listed = await getAccaService().listAccas({
    status: null,
    locale: null,
    sourceCandidateId: candidate.candidateId,
    createdBefore: null,
    createdAfter: null,
    publishedBefore: null,
    publishedAfter: null,
    limit: 50,
    offset: 0,
  });
  assert.ok(listed.ok);
  assert.equal(listed.page.total, 1, "exactly one Acca per candidate, ever");
});

test("PUBLICATION: a replayed publish with the same idempotency key does not double-publish", async () => {
  const draft = await createDraft("Idempotent publish");
  const key = "sprint24-publish-replay-key";
  clearLimiter();
  const first = await read(
    await publishRoute.POST(
      postRequest(url.publish(draft.accaId), { expectedVersion: draft.version }, {
        idempotencyKey: key,
      }),
      { params: { accaId: draft.accaId } },
    ),
  );
  assert.equal(first.status, 200, JSON.stringify(first.body));

  clearLimiter();
  const replay = await read(
    await publishRoute.POST(
      postRequest(url.publish(draft.accaId), { expectedVersion: draft.version }, {
        idempotencyKey: key,
      }),
      { params: { accaId: draft.accaId } },
    ),
  );
  assert.equal(replay.status, 200, "a replay returns the stored response, not a conflict");
  // The request id is per-request by design; the RECORD returned must be identical.
  assert.deepEqual(replay.body.acca, first.body.acca, "the replay returns the same Acca");

  const loaded = await getAccaService().getAcca(draft.accaId);
  assert.ok(loaded.ok);
  assert.equal(loaded.acca.version, draft.version + 1, "exactly one lifecycle move happened");
});

test("PUBLICATION: the published snapshot is not rewritten by publication", async () => {
  const draft = await createDraft("Immutable through publication");
  const before = JSON.stringify({
    title: draft.title,
    legs: draft.legs,
    combinedOdds: draft.combinedOdds,
    evidenceSnapshot: draft.evidenceSnapshot,
    qualificationSnapshot: draft.qualificationSnapshot,
    slug: draft.slug,
    createdAt: draft.createdAt,
  });
  const published = await publishViaApi(draft);
  const after = JSON.stringify({
    title: published.title,
    legs: published.legs,
    combinedOdds: published.combinedOdds,
    evidenceSnapshot: published.evidenceSnapshot,
    qualificationSnapshot: published.qualificationSnapshot,
    slug: published.slug,
    createdAt: published.createdAt,
  });
  assert.equal(after, before, "publication moves lifecycle state only");
});

/* ================================================================== *
 * 2. Freshness — the stale/expired policy
 * ================================================================== */

test("FRESHNESS: every kick-off ahead is ACTIVE", () => {
  const freshness = accaFreshness(syntheticRecord(), "2026-07-27T09:00:00.000Z");
  assert.equal(freshness.availability, "ACTIVE");
  assert.equal(freshness.legsStarted, 0);
  assert.equal(freshness.earliestKickoffAt, "2026-07-27T18:00:00.000Z");
  assert.equal(freshness.latestKickoffAt, "2026-07-28T18:00:00.000Z");
});

test("FRESHNESS: one kick-off passed is PARTIALLY_STARTED", () => {
  const freshness = accaFreshness(syntheticRecord(), "2026-07-28T09:00:00.000Z");
  assert.equal(freshness.availability, "PARTIALLY_STARTED");
  assert.equal(freshness.legsStarted, 1);
});

test("FRESHNESS: every kick-off passed is EXPIRED", () => {
  const freshness = accaFreshness(syntheticRecord(), NOW_CLOSED);
  assert.equal(freshness.availability, "EXPIRED");
  assert.equal(freshness.legsStarted, 2);
});

test("FRESHNESS: an archived record reports WITHDRAWN whatever the clock says", () => {
  const freshness = accaFreshness(
    syntheticRecord({ status: "ARCHIVED" }),
    "2026-07-01T09:00:00.000Z",
  );
  assert.equal(freshness.availability, "WITHDRAWN");
});

test("FRESHNESS: an unreadable kick-off is UNKNOWN, never guessed", () => {
  const record = syntheticRecord();
  const broken = {
    ...record,
    legs: [{ ...record.legs[0], kickoffAt: "not-a-timestamp" }, record.legs[1]],
  };
  assert.equal(accaFreshness(broken, NOW_CLOSED).availability, "UNKNOWN");
  assert.match(availabilityLabel("UNKNOWN").detail, /not stated rather than guessed/);
});

test("FRESHNESS: odds staleness follows the documented threshold exactly", () => {
  const record = syntheticRecord();
  const capture = Date.parse(record.createdAt);
  const justUnder = new Date(capture + (ACCA_ODDS_STALE_AFTER_HOURS - 1) * 3_600_000).toISOString();
  const atThreshold = new Date(capture + ACCA_ODDS_STALE_AFTER_HOURS * 3_600_000).toISOString();

  assert.equal(accaFreshness(record, justUnder).oddsFreshness, "FRESH");
  assert.equal(accaFreshness(record, atThreshold).oddsFreshness, "STALE");
  assert.equal(ACCA_ODDS_STALE_AFTER_HOURS, 24, "the documented policy is one daily list cycle");
});

test("FRESHNESS: settlement is honestly reported as absent, never fabricated", () => {
  assert.equal(accaFreshness(syntheticRecord(), NOW_CLOSED).settlement, "NOT_RECORDED");
  const label = settlementLabel("NOT_RECORDED");
  assert.match(label.detail, /never written back to/);
  assert.match(label.detail, /archive/);
});

test("FRESHNESS: every state label carries its meaning in words, not colour", () => {
  for (const state of ["ACTIVE", "PARTIALLY_STARTED", "EXPIRED", "WITHDRAWN", "UNKNOWN"] as const) {
    const label = availabilityLabel(state);
    assert.ok(label.label.length > 0, `${state} needs a text label`);
    assert.ok(label.detail.length > 20, `${state} needs an explanation`);
  }
  for (const state of ["FRESH", "STALE", "UNKNOWN"] as const) {
    assert.ok(oddsFreshnessLabel(state, 30).label.length > 0);
  }
});

/* ================================================================== *
 * 3. The public/private field boundary
 * ================================================================== */

test("BOUNDARY: the projection carries no redacted field, by name or by value", () => {
  const record = syntheticRecord();
  const view = toPublicAccaView(record, NOW_CLOSED);
  const serialized = JSON.stringify(view);

  for (const field of PUBLIC_ACCA_REDACTED_FIELDS) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(view, field),
      false,
      `${String(field)} must not be projected`,
    );
  }
  for (const value of [
    record.accaId,
    record.sourceCandidateId,
    record.sourceReferences.candidatePayloadChecksum,
    record.sourceReferences.candidateChecksumVersion,
  ]) {
    assert.equal(serialized.includes(value), false, `projection leaked "${value}"`);
  }
});

test("BOUNDARY: the public id is the slug, never the storage id", () => {
  const record = syntheticRecord();
  const view = toPublicAccaView(record, NOW_CLOSED);
  assert.equal(view.publicId, record.slug);
  assert.notEqual(view.publicId, record.accaId);
});

test("BOUNDARY: a field added to the record does not reach the projection by default", () => {
  // The mapper never spreads; this proves the same for the projection.
  const record = { ...syntheticRecord(), aFutureInternalField: "secret-value" } as AccaRecord & {
    aFutureInternalField: string;
  };
  const serialized = JSON.stringify(toPublicAccaView(record, NOW_CLOSED));
  assert.equal(serialized.includes("aFutureInternalField"), false);
  assert.equal(serialized.includes("secret-value"), false);
});

test("BOUNDARY: rendered public markup contains no internal identifier", async () => {
  const acca = await createPublished("Redaction check");
  const view = toPublicAccaView(acca, NOW_CLOSED);
  const surfaces = [
    html(PublicAccaDetailView({ view })),
    html(PublicAccaIndexView({ locale: "en", views: [view] })),
    html(PublicAccaCard({ view, position: 1, p: predictionsEn })),
  ];
  for (const markup of surfaces) {
    assert.equal(markup.includes(acca.accaId), false);
    assert.equal(markup.includes(acca.sourceCandidateId), false);
    assert.equal(markup.includes(acca.sourceReferences.candidatePayloadChecksum), false);
    for (const forbidden of [/\/admin\//, /candidateId/i, /payloadChecksum/i, /Not durable/]) {
      assert.equal(forbidden.test(markup), false, `leaked ${forbidden}`);
    }
  }
});

test("BOUNDARY: evidence strength is three honest buckets, never a manufactured score", () => {
  assert.equal(legEvidenceStrength({ evidenceSummary: ["a reason"] }), "RECORDED");
  assert.equal(legEvidenceStrength({ confidence: 70 }), "PARTIAL");
  assert.equal(legEvidenceStrength({ evidenceCompleteness: 0.5 }), "PARTIAL");
  assert.equal(legEvidenceStrength({}), "NOT_RECORDED");
});

test("BOUNDARY: the odds band describes the calculated price, never a claimed target", () => {
  assert.equal(accaOddsBand(2.55), "under_3");
  assert.equal(accaOddsBand(5), "3_to_6");
  assert.equal(accaOddsBand(11.99), "6_to_12");
  assert.equal(accaOddsBand(24.99), "12_to_25");
  assert.equal(accaOddsBand(25), "25_plus");
  assert.equal(accaOddsBand(Number.NaN), "unknown");
  // The property name must not assert a target the record does not carry.
  assert.equal(
    PUBLIC_ACCA_ANALYTICS_PROPERTY_KEYS.includes("targetOddsBand"),
    false,
    "no stored record carries a target odds range",
  );
  assert.equal(PUBLIC_ACCA_ANALYTICS_PROPERTY_KEYS.includes("oddsBand"), true);
});

/* ================================================================== *
 * 4. Index: filtering, faceting and pagination
 * ================================================================== */

function views(count: number, over: (i: number) => Partial<AccaRecord> = () => ({})) {
  return Array.from({ length: count }, (_, i) =>
    syntheticView({ slug: `acca-${i}`, title: `Acca ${i}`, ...over(i) }),
  );
}

test("INDEX: pagination is bounded, stable and non-overlapping", () => {
  const all = views(PUBLIC_ACCA_PAGE_SIZE * 2 + 3);
  const first = buildPublicAccaIndexPage({ views: all, query: EMPTY_QUERY, truncated: false });
  const second = buildPublicAccaIndexPage({
    views: all,
    query: { ...EMPTY_QUERY, page: 2 },
    truncated: false,
  });

  assert.equal(first.rows.length, PUBLIC_ACCA_PAGE_SIZE);
  assert.equal(first.totalPages, 3);
  assert.equal(first.total, all.length);
  assert.equal(first.hasPrev, false);
  assert.equal(first.hasNext, true);
  assert.equal(second.hasPrev, true);

  const overlap = first.rows.filter((row) =>
    second.rows.some((other) => other.publicId === row.publicId),
  );
  assert.deepEqual(overlap, [], "pages must not overlap");
});

test("INDEX: an out-of-range page is clamped and made non-indexable, never an error", () => {
  const page = buildPublicAccaIndexPage({
    views: views(3),
    query: { ...EMPTY_QUERY, page: 99 },
    truncated: false,
  });
  assert.equal(page.page, 1);
  assert.equal(page.clamped, true);
  assert.equal(page.indexable, false, "a clamped page renders page 1 at a different URL");
});

test("INDEX: filters narrow by real stored values", () => {
  const all = [
    syntheticView({ slug: "a", qualificationSnapshot: { legCount: 2, oddsComplete: true, riskMode: "balanced" } }),
    syntheticView({ slug: "b", qualificationSnapshot: { legCount: 2, oddsComplete: true, riskMode: "conservative" } }),
  ];
  const balanced = buildPublicAccaIndexPage({
    views: all,
    query: { ...EMPTY_QUERY, profile: "balanced" },
    truncated: false,
  });
  assert.equal(balanced.total, 1);
  assert.equal(balanced.rows[0].publicId, "a");

  const league = buildPublicAccaIndexPage({
    views: all,
    query: { ...EMPTY_QUERY, competition: "League One" },
    truncated: false,
  });
  assert.equal(league.total, 2, "both records carry a League One leg");

  const nowhere = buildPublicAccaIndexPage({
    views: all,
    query: { ...EMPTY_QUERY, competition: "Not A Competition" },
    truncated: false,
  });
  assert.equal(nowhere.total, 0);
});

test("INDEX: a filtered view is never offered for indexing", () => {
  const all = views(3);
  for (const query of [
    { ...EMPTY_QUERY, profile: "balanced" },
    { ...EMPTY_QUERY, competition: "League One" },
    { ...EMPTY_QUERY, state: "EXPIRED" as const },
  ]) {
    const page = buildPublicAccaIndexPage({ views: all, query, truncated: false });
    assert.equal(page.indexable, false, `filtered view must be noindex: ${JSON.stringify(query)}`);
  }
  const bare = buildPublicAccaIndexPage({ views: all, query: EMPTY_QUERY, truncated: false });
  assert.equal(bare.indexable, true);
});

test("INDEX: an empty result is never indexable, filtered or not", () => {
  const page = buildPublicAccaIndexPage({ views: [], query: EMPTY_QUERY, truncated: false });
  assert.equal(page.total, 0);
  assert.equal(page.indexable, false);
});

test("INDEX: no facet is offered unless the data supports more than one choice", () => {
  const single = publicAccaFacets(views(3));
  assert.deepEqual(single.profiles, [], "one profile value is not a choice");

  const mixed = publicAccaFacets([
    syntheticView({ slug: "a", qualificationSnapshot: { legCount: 2, oddsComplete: true, riskMode: "balanced" } }),
    syntheticView({ slug: "b", qualificationSnapshot: { legCount: 2, oddsComplete: true, riskMode: "aggressive" } }),
  ]);
  assert.equal(mixed.profiles.length, 2);
  assert.deepEqual(
    mixed.profiles.map((p) => p.value).sort(),
    ["aggressive", "balanced"],
  );
  for (const option of mixed.competitions) assert.ok(option.count > 0);
});

test("INDEX: facet options never include a state that is not publicly listable", () => {
  const facets = publicAccaFacets([
    syntheticView({ slug: "a" }, NOW_CLOSED),
    syntheticView({ slug: "b" }, NOW_AHEAD),
  ]);
  const states = facets.states.map((s) => s.value);
  assert.equal(states.includes("withdrawn"), false);
  assert.equal(states.includes("unknown"), false);
});

test("INDEX: query parsing rejects hostile and out-of-range input", () => {
  assert.deepEqual(parsePublicAccaIndexQuery(undefined), EMPTY_QUERY);
  assert.equal(parsePublicAccaIndexQuery({ page: "0" }).page, 1);
  assert.equal(parsePublicAccaIndexQuery({ page: "-4" }).page, 1);
  assert.equal(parsePublicAccaIndexQuery({ page: "1e9" }).page, 1);
  assert.equal(parsePublicAccaIndexQuery({ page: "abc" }).page, 1);
  assert.equal(parsePublicAccaIndexQuery({ page: "3" }).page, 3);
  assert.equal(parsePublicAccaIndexQuery({ profile: "<script>" }).profile, null);
  assert.equal(parsePublicAccaIndexQuery({ profile: "x".repeat(200) }).profile, null);
  assert.equal(parsePublicAccaIndexQuery({ state: "withdrawn" }).state, null);
  assert.equal(parsePublicAccaIndexQuery({ state: "unknown" }).state, null);
  assert.equal(parsePublicAccaIndexQuery({ state: "active" }).state, "ACTIVE");
  // An array value (a repeated query parameter) takes the first entry, never crashes.
  assert.equal(parsePublicAccaIndexQuery({ profile: ["balanced", "other"] }).profile, "balanced");
});

test("INDEX: href building is canonical, ordered and never emits page=1", () => {
  assert.equal(publicAccaIndexHref("en", EMPTY_QUERY), "/en/accas");
  assert.equal(publicAccaIndexHref("en", { ...EMPTY_QUERY, page: 1 }), "/en/accas");
  assert.equal(publicAccaIndexHref("en", { ...EMPTY_QUERY, page: 2 }), "/en/accas?page=2");
  assert.equal(
    publicAccaIndexHref("en", { page: 2, profile: "balanced", competition: "League One", state: "ACTIVE" }),
    "/en/accas?profile=balanced&competition=League%20One&state=active&page=2",
  );
  // Parameter order does not vary with the order of the object's keys.
  assert.equal(
    publicAccaIndexHref("en", { state: "ACTIVE", page: 2, competition: "League One", profile: "balanced" }),
    publicAccaIndexHref("en", { page: 2, profile: "balanced", competition: "League One", state: "ACTIVE" }),
  );
});

test("INDEX: the storage scan is bounded and reports when it truncated", async () => {
  await createPublished("Scan one");
  await createPublished("Scan two");
  const scan = await listPublicAccaViews({ locale: "en", now: NOW_CLOSED });
  assert.equal(scan.views.length, 2);
  assert.equal(scan.truncated, false);

  const narrowed = await listPublicAccaViews({ locale: "en", now: NOW_CLOSED, scanLimit: 1 });
  assert.equal(narrowed.views.length, 1);
  assert.equal(narrowed.truncated, true, "a bounded scan must say it was bounded");
  assert.equal(PUBLIC_ACCA_MAX_SCAN, 200);
});

/* ================================================================== *
 * 5. Rendering
 * ================================================================== */

test("RENDER: the detail page states every required section", () => {
  const markup = html(PublicAccaDetailView({ view: syntheticView() }));
  for (const heading of [
    "At a glance",
    "The 2 selections",
    "Why these selections",
    "What this was built on",
    "Is this still current?",
    "Limitations",
    "How this was put together",
    "Share this page",
    "Check the record",
  ]) {
    assert.ok(markup.includes(heading), `missing section: ${heading}`);
  }
});

test("RENDER: the detail page states its methodology honestly", () => {
  const markup = html(PublicAccaDetailView({ view: syntheticView() }));
  assert.match(markup, /Construction is deterministic/);
  assert.match(markup, /immutable/);
  assert.match(markup, /Odds and availability change constantly/);
  assert.match(markup, /Evidence is informational/);
  assert.match(markup, /not a promise about any outcome/);
});

test("RENDER: the detail page shows the published snapshot, not a current value", () => {
  const markup = html(PublicAccaDetailView({ view: syntheticView() }));
  assert.match(markup, /Odds at publication/);
  assert.match(markup, /captured when this Acca was created and are never re-fetched/);
  // The stored price appears; nothing recalculates it.
  assert.match(markup, /1\.70/);
  assert.match(markup, /2\.55/);
});

test("RENDER: a closed Acca says so, and names which fixtures have started", () => {
  const markup = html(PublicAccaDetailView({ view: syntheticView({}, NOW_CLOSED) }));
  assert.match(markup, /Closed/);
  assert.match(markup, /Kicked off/);
  assert.match(markup, /2<\/span> of[\s\S]{0,80}2<\/span> fixtures have kicked off/);
});

test("RENDER: an Acca whose fixtures are ahead is labelled current, not closed", () => {
  const markup = html(PublicAccaDetailView({ view: syntheticView({}, NOW_AHEAD) }));
  assert.match(markup, /Current/);
  assert.equal(/Kicked off/.test(markup), false);
});

test("RENDER: stale prices are labelled with their real age", () => {
  const view = syntheticView({}, "2026-07-29T12:00:00.000Z");
  assert.equal(view.freshness.oddsFreshness, "STALE");
  assert.equal(view.freshness.oddsAgeHours, 72);
  const markup = html(PublicAccaDetailView({ view }));
  assert.match(markup, /Captured 72 hours ago/);
  assert.match(markup, /older than one daily list cycle/);
});

test("RENDER: a selection with nothing recorded says so rather than looking endorsed", () => {
  const record = syntheticRecord();
  const stripped = {
    ...record,
    legs: record.legs.map((leg) => ({
      matchId: leg.matchId,
      homeTeam: leg.homeTeam,
      awayTeam: leg.awayTeam,
      competition: leg.competition,
      kickoffAt: leg.kickoffAt,
      marketKey: leg.marketKey,
      capturedOdds: leg.capturedOdds,
    })),
  };
  const markup = html(PublicAccaDetailView({ view: toPublicAccaView(stripped, NOW_CLOSED) }));
  assert.match(markup, /Nothing recorded/);
  assert.match(markup, /a gap in the record, not a judgement/);
});

test("RENDER: the index groups by state without ranking by apparent quality", () => {
  const markup = html(
    PublicAccaIndexView({
      locale: "en",
      views: [syntheticView({ slug: "ahead" }, NOW_AHEAD), syntheticView({ slug: "done" }, NOW_CLOSED)],
    }),
  );
  assert.match(markup, /Still ahead/);
  assert.ok(markup.indexOf("Still ahead") < markup.indexOf(">Closed<"));
  assert.match(markup, /Newest first/);
});

test("RENDER: the filtered empty state is distinct from the nothing-published state", () => {
  const filteredMarkup = html(
    PublicAccaIndexView({
      locale: "en",
      views: [],
      query: { ...EMPTY_QUERY, profile: "balanced" },
      page: buildPublicAccaIndexPage({
        views: [],
        query: { ...EMPTY_QUERY, profile: "balanced" },
        truncated: false,
      }),
    }),
  );
  assert.match(filteredMarkup, /Nothing matches that filter/);
  const bare = html(PublicAccaIndexView({ locale: "en", views: [] }));
  assert.match(bare, /Nothing published yet/);
});

test("RENDER: the builder entry point follows the existing combo route flag", () => {
  const on = html(PublicAccaIndexView({ locale: "en", views: [], builderEntryEnabled: true }));
  assert.match(on, /\/en\/acca\/builder/);
  const off = html(PublicAccaIndexView({ locale: "en", views: [], builderEntryEnabled: false }));
  assert.equal(/\/en\/acca\/builder/.test(off), false, "no link to a disabled surface");
});

test("RENDER: pagination and filters are real links, not scripted controls", () => {
  const page = buildPublicAccaIndexPage({
    views: views(PUBLIC_ACCA_PAGE_SIZE + 1),
    query: EMPTY_QUERY,
    truncated: false,
  });
  const markup = html(PublicAccaPagination({ locale: "en", page, query: EMPTY_QUERY, p: predictionsEn }));
  assert.match(markup, /<a[^>]+href="\/en\/accas\?page=2"/);
  assert.match(markup, /rel="next"/);
  assert.equal(/onclick/i.test(markup), false);

  const facets = publicAccaFacets([
    syntheticView({ slug: "a", qualificationSnapshot: { legCount: 2, oddsComplete: true, riskMode: "balanced" } }),
    syntheticView({ slug: "b", qualificationSnapshot: { legCount: 2, oddsComplete: true, riskMode: "aggressive" } }),
  ]);
  const filterMarkup = html(PublicAccaFilters({ locale: "en", facets, query: EMPTY_QUERY, p: predictionsEn }));
  assert.match(filterMarkup, /<a[^>]+href="\/en\/accas\?profile=balanced"/);
  assert.equal(/<form/.test(filterMarkup), false, "filtering must not need a form or a script");
});

test("RENDER: no public Acca surface carries an affiliate handoff", () => {
  const view = syntheticView();
  for (const markup of [
    html(PublicAccaDetailView({ view })),
    html(PublicAccaIndexView({ locale: "en", views: [view] })),
    html(PublicAccaCard({ view, position: 1, p: predictionsEn })),
  ]) {
    for (const pattern of [/\/go\//, /bet now/i, /claim bonus/i, /deposit/i, /rel="sponsored"/]) {
      assert.equal(pattern.test(markup), false, `affiliate handoff belongs to a later sprint (${pattern})`);
    }
  }
});

/* ================================================================== *
 * 6. Routes
 * ================================================================== */

async function renderIndex(searchParams?: Record<string, string | string[] | undefined>) {
  return html(
    await indexRoute.default({ params: { locale: "en" }, searchParams }),
  );
}

test("ROUTE: the index renders server-side and lists published Accas", async () => {
  await createPublished("Rendered through the route");
  const markup = await renderIndex();
  assert.match(markup, /Rendered through the route/);
  assert.match(markup, /application\/ld\+json/, "structured data on the canonical view");
});

test("ROUTE: the index renders an honest empty state without structured data", async () => {
  const markup = await renderIndex();
  assert.match(markup, /Nothing published yet/);
  assert.equal(
    /application\/ld\+json/.test(markup),
    false,
    "nothing to describe means no structured data",
  );
});

test("ROUTE: a filtered index view emits no collection structured data", async () => {
  await createPublished("Filtered view");
  const markup = await renderIndex({ profile: "balanced" });
  assert.equal(
    /application\/ld\+json/.test(markup),
    false,
    "a facet combination is not a separate collection",
  );
});

test("ROUTE: the detail page renders a published Acca and 404s for everything else", async () => {
  const acca = await createPublished("Route detail");
  const markup = html(
    await detailRoute.default({ params: { locale: "en", slug: acca.slug } }),
  );
  assert.match(markup, /Route detail/);

  await assert.rejects(
    async () => detailRoute.default({ params: { locale: "en", slug: "no-such-acca" } }),
    "an unknown slug must not render",
  );
  await assert.rejects(
    async () => detailRoute.default({ params: { locale: "tr", slug: acca.slug } }),
    "another locale's path must not render",
  );
});

test("ROUTE: a draft is a 404, indistinguishable from a slug that does not exist", async () => {
  const draft = await createDraft("Draft never rendered");
  await assert.rejects(
    async () => detailRoute.default({ params: { locale: "en", slug: draft.slug } }),
  );
  const metadata = await detailRoute.generateMetadata({
    params: { locale: "en", slug: draft.slug },
  });
  assert.equal(metadata.title, "Accumulator not found");
  assert.deepEqual(metadata.robots, { index: false, follow: true });
});

test("ROUTE: the locale segment is part of visibility, not decoration", async () => {
  const spanish = await createPublished("Publicación en español", "es");
  assert.ok(await getPublicAccaView({ slug: spanish.slug, locale: "es", now: NOW_CLOSED }));
  assert.equal(await getPublicAccaView({ slug: spanish.slug, locale: "en", now: NOW_CLOSED }), null);
});

/* ================================================================== *
 * 7. Feature flag
 * ================================================================== */

test("FLAG: publicAccaPagesEnabled defaults on and is independent of the approval flag", () => {
  assert.equal(getFeatureFlags({ NODE_ENV: "test" } as NodeJS.ProcessEnv).publicAccaPagesEnabled, true);
  assert.equal(
    getFeatureFlags({ NODE_ENV: "test", FF_OPERATOR_APPROVAL_ENABLED: "false" } as NodeJS.ProcessEnv)
      .publicAccaPagesEnabled,
    true,
    "the reader surface does not depend on the admin backend being open",
  );
  assert.equal(
    getFeatureFlags({ NODE_ENV: "test", FF_PUBLIC_ACCA_PAGES_ENABLED: "false" } as NodeJS.ProcessEnv)
      .publicAccaPagesEnabled,
    false,
  );
});

test("FLAG: disabling the public surface closes every reader path at once", async () => {
  const acca = await createPublished("Hidden by the flag");
  process.env.FF_PUBLIC_ACCA_PAGES_ENABLED = "false";
  try {
    assert.equal(publicAccaPagesEnabled(), false);
    assert.equal(await getPublicAccaView({ slug: acca.slug, locale: "en", now: NOW_CLOSED }), null);
    assert.deepEqual((await listPublicAccaViews({ locale: "en", now: NOW_CLOSED })).views, []);
    assert.deepEqual(await accaSitemap({ id: "accas" }), [], "sitemap follows public visibility");

    await assert.rejects(async () => indexRoute.default({ params: { locale: "en" } }));
    await assert.rejects(
      async () => detailRoute.default({ params: { locale: "en", slug: acca.slug } }),
    );

    const metadata = await indexRoute.generateMetadata({ params: { locale: "en" } });
    assert.deepEqual(metadata.robots, { index: false, follow: false });
  } finally {
    delete process.env.FF_PUBLIC_ACCA_PAGES_ENABLED;
  }
});

test("FLAG: disabling the public surface changes no stored record", async () => {
  const acca = await createPublished("Still published in storage");
  process.env.FF_PUBLIC_ACCA_PAGES_ENABLED = "false";
  try {
    const loaded = await getAccaService().getAcca(acca.accaId);
    assert.ok(loaded.ok);
    assert.equal(loaded.acca.status, "PUBLISHED", "the flag hides, it does not unpublish");
  } finally {
    delete process.env.FF_PUBLIC_ACCA_PAGES_ENABLED;
  }
});

/* ================================================================== *
 * 8. SEO
 * ================================================================== */

test("SEO: a detail page declares one canonical and no locale alternates", () => {
  const view = syntheticView();
  const metadata = accaDetailMetadata(view);
  const alternates = metadata.alternates as { canonical?: string; languages?: unknown };
  assert.equal(alternates.canonical, publicAccaCanonicalUrl("en", view.publicId));
  assert.equal(
    alternates.languages,
    undefined,
    "every other locale 404s for this slug; advertising them would be a lie",
  );
});

test("SEO: detail metadata is unique per Acca and claims no outcome", () => {
  const a = accaDetailMetadata(syntheticView({ slug: "a", title: "First combination" }));
  const b = accaDetailMetadata(
    syntheticView({
      slug: "b",
      title: "Second combination",
      legs: syntheticRecord().legs.slice(0, 2),
      combinedOdds: 4.2,
    }),
  );
  assert.notEqual(a.title, b.title);
  assert.notEqual(a.description, b.description);

  // Judged by the site-wide claim guard rather than a local word list, so metadata is held to
  // exactly the same standard as page copy — including its handling of honest denials, which is
  // why "not a tip" is correct here and "a tip" would not be.
  const text = `${String(a.title)} ${String(a.description)}`;
  assert.deepEqual(findClaimViolations(text), []);
  assert.equal(hasUnqualifiedRanking(text), false);
  for (const banned of [/guaranteed/i, /\bwill win\b/i, /\bprofit\b/i, /\bbest bet\b/i]) {
    assert.equal(banned.test(text), false, `metadata must not contain ${banned}`);
  }
});

test("SEO: an operator summary wins over the generated description", () => {
  assert.equal(
    accaDetailDescription(syntheticView({ summary: "A hand-written summary." })),
    "A hand-written summary.",
  );
  assert.match(accaDetailDescription(syntheticView()), /2-selection football combination/);
});

test("SEO: page one is never expressed as ?page=1", () => {
  const page = buildPublicAccaIndexPage({ views: views(30), query: EMPTY_QUERY, truncated: false });
  const metadata = accaIndexMetadata({ locale: "en", page, query: EMPTY_QUERY, index: true });
  const canonical = String((metadata.alternates as { canonical?: string }).canonical);
  assert.equal(canonical.includes("page=1"), false);
  assert.match(canonical, /\/en\/accas$/);
});

test("SEO: a real second page has its own canonical and its own title", () => {
  const all = views(30);
  const two = buildPublicAccaIndexPage({
    views: all,
    query: { ...EMPTY_QUERY, page: 2 },
    truncated: false,
  });
  const metadata = accaIndexMetadata({
    locale: "en",
    page: two,
    query: { ...EMPTY_QUERY, page: 2 },
    index: two.indexable,
  });
  assert.match(String(metadata.title), /page 2/);
  assert.match(
    String((metadata.alternates as { canonical?: string }).canonical),
    /\/en\/accas\?page=2$/,
  );
  assert.equal(
    (metadata.alternates as { languages?: unknown }).languages,
    undefined,
    "a page number is not a language",
  );
});

test("SEO: a filtered view canonicalises to the bare index and is noindex", () => {
  const query = { ...EMPTY_QUERY, profile: "balanced" };
  const page = buildPublicAccaIndexPage({ views: views(3), query, truncated: false });
  const metadata = accaIndexMetadata({ locale: "en", page, query, index: page.indexable });
  assert.match(
    String((metadata.alternates as { canonical?: string }).canonical),
    /\/en\/accas$/,
  );
  assert.deepEqual(metadata.robots, { index: false, follow: true });
});

test("SEO: structured data is built from the projection and models research, not commerce", () => {
  const view = syntheticView();
  const detail = accaDetailLd(view);
  assert.equal(detail["@type"], "Article");
  const serialized = JSON.stringify(detail);
  for (const forbidden of ["Offer", "aggregateRating", "reviewCount", "Product", "ratingValue"]) {
    assert.equal(serialized.includes(forbidden), false, `must not be marked up as ${forbidden}`);
  }
  assert.equal(serialized.includes(syntheticRecord().accaId), false, "no storage id in markup");
  // Legs are described once, as real events, not twice via a competing ItemList.
  assert.equal((detail.about as unknown[]).length, 2);
  assert.equal(serialized.includes('"ItemList"'), false);
});

test("SEO: breadcrumbs and the collection reference the canonical URLs only", () => {
  const view = syntheticView();
  const crumbs = accaBreadcrumbLd({ locale: "en", view });
  const items = crumbs.itemListElement as Array<Record<string, unknown>>;
  assert.equal(items.length, 3);
  assert.equal(items[2].item, publicAccaCanonicalUrl("en", view.publicId));

  const collection = accaIndexLd({ locale: "en", views: [view] });
  const list = collection.mainEntity as Record<string, unknown>;
  assert.equal(list.numberOfItems, 1);
  const entry = (list.itemListElement as Array<Record<string, unknown>>)[0];
  assert.equal(entry.url, publicAccaCanonicalUrl("en", view.publicId));
});

test("SEO: the sitemap carries published Accas only, once each", async () => {
  const draft = await createDraft("Draft not crawled");
  const live = await createPublished("Live and crawled");
  const entries = await accaSitemap({ id: "accas" });
  const urls = entries.map((e) => e.url);
  assert.equal(urls.filter((u) => u.includes(live.slug)).length, 1);
  assert.equal(urls.some((u) => u.includes(draft.slug)), false);
  // Exactly one index URL, for the locale that has content.
  assert.deepEqual(urls.filter((u) => u.endsWith("/accas")).length, 1);
  // No filtered or paginated variants are ever advertised.
  assert.equal(urls.some((u) => u.includes("?")), false);
});

test("SEO: no competing singular detail route exists", () => {
  assert.equal(
    existsSync(path.join(root, "app", "[locale]", "acca", "[slug]")),
    false,
    "a second indexable URL family for one document is a duplicate by construction",
  );
  assert.equal(publicAccaPath("en", "x"), "/en/accas/x");
  assert.equal(publicAccaIndexPath("en"), "/en/accas");
  assert.equal(publicAccaCanonicalUrl("en", "x").endsWith("/en/accas/x"), true);
});

/* ================================================================== *
 * 9. Analytics
 * ================================================================== */

test("ANALYTICS: every public Acca event is registered in the shared vocabulary", () => {
  for (const name of PUBLIC_ACCA_ANALYTICS_EVENTS) {
    assert.ok(
      (analyticsEventNames as readonly string[]).includes(name),
      `${name} must be in the closed event union`,
    );
  }
  for (const required of [
    "acca_index_view",
    "acca_card_impression",
    "acca_card_click",
    "acca_detail_view",
    "acca_leg_expand",
    "acca_evidence_expand",
    "acca_share_open",
    "acca_share_copy",
    "acca_share_native",
    "acca_builder_entry_click",
  ]) {
    assert.ok(
      (PUBLIC_ACCA_ANALYTICS_EVENTS as readonly string[]).includes(required),
      `${required} is required by the sprint brief`,
    );
  }
});

test("ANALYTICS: only allowlisted, privacy-safe properties are forwarded", () => {
  const forwarded = publicAccaAnalyticsProperties({
    surface: "acca_detail",
    publicAccaId: "some-slug",
    locale: "en",
    legCount: 2,
    oddsBand: "under_3",
    freshnessState: "expired",
    ...({
      email: "someone@example.com",
      ipAddress: "1.2.3.4",
      accaId: "acca_internal_id",
      referrer: "https://elsewhere.example",
    } as Record<string, unknown>),
  });
  assert.deepEqual(Object.keys(forwarded).sort(), [
    "freshnessState",
    "legCount",
    "locale",
    "oddsBand",
    "publicAccaId",
    "surface",
  ]);
  for (const leaked of ["email", "ipAddress", "accaId", "referrer"]) {
    assert.equal(leaked in forwarded, false, `${leaked} must never be forwarded`);
  }
});

test("ANALYTICS: nulls and undefined are dropped rather than sent as empty values", () => {
  const forwarded = publicAccaAnalyticsProperties({
    surface: "acca_index",
    profile: undefined,
    freshnessState: undefined,
    page: 2,
  });
  assert.deepEqual(forwarded, { surface: "acca_index", page: 2 });
});

test("ANALYTICS: impression suppression uses the shared, tested primitive", () => {
  const source = readSource("components/acca-publication/AccaIndexAnalytics.tsx");
  assert.match(source, /rememberImpression/);
  assert.match(source, /IMPRESSION_INTERSECTION_THRESHOLD/);
  assert.match(source, /observer\.unobserve/);
  // A view key, so a re-render cannot re-fire the page-level event.
  assert.match(source, /lastViewKey/);
});

test("ANALYTICS: the surface does not create a second analytics abstraction", () => {
  const source = readSource("lib/acca-publication/analytics.ts");
  assert.match(source, /from "@\/lib\/analytics\/client"/);
  for (const forbidden of [/fetch\(/, /navigator\.sendBeacon/, /new\s+\w*Analytics/]) {
    assert.equal(forbidden.test(source), false, `must not implement its own transport (${forbidden})`);
  }
});

/* ================================================================== *
 * 10. Sharing and accessibility
 * ================================================================== */

/**
 * Share controls hold hook state, so they must be rendered as an ELEMENT rather than called as a
 * function — a direct call runs outside React's dispatcher and `useState` throws.
 */
function renderShareControls(
  props: Parameters<typeof AccaShareControls>[0],
): string {
  const React = require("react") as typeof import("react");
  return renderToStaticMarkup(React.createElement(AccaShareControls, props));
}

test("SHARE: controls are keyboard-operable native buttons with an announced status", () => {
  const markup = renderShareControls({
    url: "https://example.test/en/accas/some-slug",
    title: "Some Acca",
    context: { publicAccaId: "some-slug", locale: "en", legCount: 2 },
  });
  assert.match(markup, /<button type="button"/);
  assert.match(markup, /Copy link/);
  assert.match(markup, /role="status"/);
  assert.match(markup, /aria-live="polite"/);
  assert.match(markup, /focus-visible:outline/);
  // The fallback is reachable without scripting and is labelled.
  assert.match(markup, /<label for="/);
  assert.match(markup, /readonly/);
  assert.equal(/disabled/.test(markup), false, "a disabled input is not keyboard reachable");
});

test("SHARE: only the canonical URL is ever emitted", () => {
  const view = syntheticView();
  assert.equal(view.shareUrl, publicAccaCanonicalUrl("en", view.publicId));
  // Comments are stripped: this file explains in prose why it does not read the address bar, and
  // a raw scan would match that explanation rather than any code.
  const source = stripComments(readSource("components/acca-publication/AccaShareControls.tsx"));
  assert.equal(
    /window\.location/.test(source),
    false,
    "reading the address bar would share whatever query string the reader arrived with",
  );
});

test("SHARE: the native share button is revealed in an effect, never during render", () => {
  const source = readSource("components/acca-publication/AccaShareControls.tsx");
  assert.match(source, /useEffect\(\s*\(\)\s*=>\s*\{\s*setNativeShareAvailable/);
  const markup = renderShareControls({
    url: "https://example.test/en/accas/x",
    title: "T",
    context: { publicAccaId: "x", locale: "en" },
  });
  assert.equal(/Share…/.test(markup), false, "server output must not assume a browser capability");
});

test("SHARE: no third-party or login-gated sharing was introduced", () => {
  const source = readSource("components/acca-publication/AccaShareControls.tsx");
  for (const forbidden of [/facebook/i, /twitter\.com/i, /x\.com/i, /telegram/i, /sign in/i, /log in/i]) {
    assert.equal(forbidden.test(source), false, `no third-party share target (${forbidden})`);
  }
});

test("A11Y: disclosures are native details elements, usable without JavaScript", () => {
  const markup = html(PublicAccaDetailView({ view: syntheticView() }));
  assert.match(markup, /<details[^>]+data-acca-disclosure="leg"/);
  assert.match(markup, /<details[^>]+data-acca-disclosure="evidence"/);
  assert.match(markup, /<summary/);
  assert.equal(/role="button"/.test(markup), false, "a custom widget would be worse than the native one");
});

test("A11Y: the detail page has one h1 and a logical heading order", () => {
  const markup = html(PublicAccaDetailView({ view: syntheticView() }));
  assert.equal((markup.match(/<h1/g) ?? []).length, 1);
  assert.ok((markup.match(/<h2/g) ?? []).length >= 7);
  // Every section is labelled by its own heading.
  for (const id of ["summary", "selections", "why", "evidence", "status", "limitations", "methodology", "share", "more"]) {
    assert.match(markup, new RegExp(`aria-labelledby="${id}"`), `section ${id} needs a label`);
  }
});

test("A11Y: the selections table has real semantics, not a grid of divs", () => {
  const markup = html(PublicAccaDetailView({ view: syntheticView() }));
  assert.match(markup, /<caption class="sr-only">/);
  assert.match(markup, /<th scope="col"/);
  assert.match(markup, /<th scope="row"/, "the fixture is the row header");
});

test("A11Y: navigation landmarks on the index are named", () => {
  const facets = publicAccaFacets([
    syntheticView({ slug: "a", qualificationSnapshot: { legCount: 2, oddsComplete: true, riskMode: "balanced" } }),
    syntheticView({ slug: "b", qualificationSnapshot: { legCount: 2, oddsComplete: true, riskMode: "aggressive" } }),
  ]);
  assert.match(
    html(PublicAccaFilters({ locale: "en", facets, query: EMPTY_QUERY, p: predictionsEn })),
    /aria-label="Filter published Accas"/,
  );
  const page = buildPublicAccaIndexPage({
    views: views(PUBLIC_ACCA_PAGE_SIZE + 1),
    query: EMPTY_QUERY,
    truncated: false,
  });
  assert.match(
    html(PublicAccaPagination({ locale: "en", page, query: EMPTY_QUERY, p: predictionsEn })),
    /aria-label="Published Acca pages"/,
  );
});

test("A11Y: no state is communicated by colour alone", () => {
  const markup = html(PublicAccaCard({ view: syntheticView({}, NOW_CLOSED), position: 1, p: predictionsEn }));
  assert.match(markup, /State/);
  assert.match(markup, /Closed/);
});

/* ================================================================== *
 * 11. Security
 * ================================================================== */

test("SECURITY: publication is not an unauthenticated public action", async () => {
  const draft = await createDraft("Guarded");
  clearLimiter();
  const res = await read(
    await publishRoute.POST(
      postRequest(url.publish(draft.accaId), { expectedVersion: draft.version }, { auth: "none" }),
      { params: { accaId: draft.accaId } },
    ),
  );
  assert.equal(res.status, 401, JSON.stringify(res.body));
  const loaded = await getAccaService().getAcca(draft.accaId);
  assert.ok(loaded.ok);
  assert.equal(loaded.acca.status, "DRAFT", "nothing moved");
});

test("SECURITY: no public surface can reach a mutation or an admin endpoint", () => {
  for (const rel of [
    "app/[locale]/accas/page.tsx",
    "app/[locale]/accas/[slug]/page.tsx",
    "components/acca-publication/PublicAccaIndexView.tsx",
    "components/acca-publication/PublicAccaDetailView.tsx",
    "components/acca-publication/PublicAccaCard.tsx",
    "components/acca-publication/PublicAccaFilters.tsx",
    "components/acca-publication/PublicAccaPagination.tsx",
    "components/acca-publication/AccaShareControls.tsx",
    "components/acca-publication/AccaIndexAnalytics.tsx",
    "components/acca-publication/AccaDetailAnalytics.tsx",
  ]) {
    const src = readSource(rel);
    for (const forbidden of [
      "/api/admin/",
      "transitionAccaLifecycle",
      "createAccaDraftFromCandidate",
      "getAccaService",
      "getAccaStore",
      'method: "POST"',
    ]) {
      assert.equal(src.includes(forbidden), false, `${rel} must not reach ${forbidden}`);
    }
  }
});

test("SECURITY: the client islands pull no storage or server-only code into the browser", () => {
  for (const rel of [
    "components/acca-publication/AccaShareControls.tsx",
    "components/acca-publication/AccaIndexAnalytics.tsx",
    "components/acca-publication/AccaDetailAnalytics.tsx",
  ]) {
    const src = readSource(rel);
    assert.match(src, /^"use client";/m);
    for (const forbidden of [
      "acca-publication/public",
      "acca-publication/publicView",
      "acca-publication/service",
      "acca-publication/store",
      "adapters/",
      "server-only",
      "node:",
    ]) {
      assert.equal(src.includes(forbidden), false, `${rel} must not import ${forbidden}`);
    }
  }
});

test("SECURITY: an unpublished Acca leaks nothing, not even its existence", async () => {
  const draft = await createDraft("Never seen");
  assert.equal(await getPublicAccaView({ slug: draft.slug, locale: "en", now: NOW_CLOSED }), null);
  const listed = await listPublicAccaViews({ locale: "en", now: NOW_CLOSED });
  assert.equal(listed.views.some((v) => v.publicId === draft.slug), false);
  assert.equal(listed.views.some((v) => v.title === "Never seen"), false);

  // The metadata for a draft slug and for a slug that was never minted must be identical in every
  // field that could reveal something. The canonical URL echoes the slug the caller supplied and
  // therefore tells them nothing they did not already have.
  const missing = await detailRoute.generateMetadata({
    params: { locale: "en", slug: draft.slug },
  });
  const unknown = await detailRoute.generateMetadata({
    params: { locale: "en", slug: "definitely-not-a-real-slug" },
  });
  assert.equal(missing.title, unknown.title);
  assert.equal(missing.description, unknown.description);
  assert.deepEqual(missing.robots, unknown.robots);
  assert.equal(String(missing.title), "Accumulator not found");
  assert.equal(
    JSON.stringify(missing).includes(draft.title),
    false,
    "the stored title of a draft must never appear in metadata",
  );
});

test("SECURITY: public reads fail closed and safe when storage is unavailable", async () => {
  const { setAccaStoreForTests, getAccaStore } = await import("../lib/api/accaComposition");
  const real = getAccaStore();
  setAccaStoreForTests({
    ...real,
    async listAccas() {
      throw new Error("postgres://user:pass@host/db unreachable");
    },
    async getAccaBySlug() {
      throw new Error("postgres://user:pass@host/db unreachable");
    },
  } as never);
  try {
    const scan = await listPublicAccaViews({ locale: "en", now: NOW_CLOSED });
    assert.deepEqual(scan, { views: [], truncated: false });
    assert.equal(await getPublicAccaView({ slug: "anything-here", locale: "en", now: NOW_CLOSED }), null);
    const markup = await renderIndex();
    assert.match(markup, /Nothing published yet/);
    assert.equal(/postgres:\/\//.test(markup), false, "no connection string on a public page");
    assert.equal(/unreachable/.test(markup), false, "no internal error text on a public page");
  } finally {
    setAccaStoreForTests(null);
  }
});

/* ================================================================== *
 * 12. Regression — the surfaces this sprint must not have touched
 * ================================================================== */

test("REGRESSION: the Acca Studio and Builder routes are unchanged and still noindex", () => {
  for (const rel of ["app/[locale]/acca/page.tsx", "app/[locale]/acca/builder/page.tsx"]) {
    const src = readSource(rel);
    assert.match(src, /index: false/, `${rel} must remain out of the index`);
  }
  assert.ok(existsSync(path.join(root, "app", "[locale]", "acca", "builder", "page.tsx")));
  assert.ok(existsSync(path.join(root, "app", "api", "acca", "builder", "route.ts")));
});

test("REGRESSION: the Combo Studio surface is untouched by this sprint", () => {
  const comboFiles = readdirSync(path.join(root, "components", "combo"));
  assert.ok(comboFiles.includes("ComboStudio.tsx"));
  for (const rel of ["components/combo/ComboStudio.tsx", "app/[locale]/combo/page.tsx"]) {
    const src = readSource(rel);
    assert.equal(
      /acca-publication/.test(src),
      false,
      `${rel} must not have acquired a dependency on the publication chain`,
    );
  }
});

test("REGRESSION: the approval lifecycle vocabulary and guards are unchanged", async () => {
  const { BUILDER_CANDIDATE_STATUSES } = await import("../lib/builder-approval/contracts");
  assert.deepEqual([...BUILDER_CANDIDATE_STATUSES].sort(), [
    "APPROVED",
    "CONVERTED",
    "DRAFT",
    "REJECTED",
  ]);
  const store = readSource("lib/acca-publication/store.ts");
  for (const forbidden of ["updateAcca", "patchAcca", "saveAcca", "deleteAcca"]) {
    assert.equal(new RegExp(`${forbidden}\\s*[(:]`).test(store), false);
  }
});

test("REGRESSION: the admin publication API still requires the full security pipeline", () => {
  const shared = readSource("lib/api/accaLifecycleRoute.ts");
  assert.match(shared, /guardAdminRequest\({[\s\S]*requireCsrf: true/);
  assert.match(shared, /withHttpIdempotency/);
  assert.match(shared, /validateIdempotencyKey/);
});

test("REGRESSION: no public Acca API endpoint was added", () => {
  // The pages are server-rendered, so a public JSON endpoint would be a second, unnecessary
  // surface to secure, rate-limit and version. None was introduced.
  const apiRoot = path.join(root, "app", "api", "acca");
  const entries = readdirSync(apiRoot).filter((name) =>
    statSync(path.join(apiRoot, name)).isDirectory(),
  );
  assert.deepEqual(entries.sort(), ["builder", "operators"]);
});

test("REGRESSION: primary navigation still carries exactly one Published Accas entry", async () => {
  const { buildPrimaryNav } = await import("../lib/navigation/primaryNav");
  const nav = buildPrimaryNav("en", { bestBetting: "A", bestCrypto: "B", bonuses: "C" });
  const hrefs = nav.flat.map((item) => item.href);
  assert.equal(hrefs.filter((h) => h === "/en/accas").length, 1);
  for (const href of ["/en/acca", "/en/acca/builder", "/en/archive", "/en/methodology"]) {
    assert.ok(hrefs.includes(href), `${href} must still exist`);
  }
});

test("REGRESSION: a GET to the admin Acca list is still guarded", async () => {
  const listRoute = await import("../app/api/admin/accas/route");
  const res = await read(await listRoute.GET(getRequest(url.accaList(), { auth: "none" })));
  assert.equal(res.status, 401);
});
