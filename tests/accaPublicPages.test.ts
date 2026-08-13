import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test, { beforeEach } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { getAccaService } from "../lib/api/accaComposition";
import type { AccaRecord } from "../lib/acca-publication/contracts";
import {
  PUBLIC_LIST_LIMIT,
  getPublishedAccaBySlug,
  listPublishedAccas,
  listPublishedAccasForSitemap,
  publicAccaIndexPath,
  publicAccaPath,
} from "../lib/acca-publication/public";
import { toPublicAccaView } from "../lib/acca-publication/publicView";
import { accaBreadcrumbLd, accaDetailLd, accaIndexLd } from "../lib/acca-publication/schema";
import { predictionsEn } from "../lib/translations/predictionsEn";
import { buildPrimaryNav } from "../lib/navigation/primaryNav";
import { installTestEnv, postRequest, read, resetAll, seedApproved, url } from "./accaApiFixtures";
import * as createAccaRoute from "../app/api/admin/builder-approval/candidates/[candidateId]/create-acca/route";

/**
 * Sprint 20B-B stage B5 — public Acca pages, homepage, navigation, SEO and sitemap.
 *
 * The governing question for every assertion here is the manifesto's: does this page deserve to
 * exist independently, and does it tell the reader the truth?
 */

(globalThis as { React?: unknown }).React = require("react");

installTestEnv();
beforeEach(resetAll);

const root = process.cwd();
const readSource = (rel: string) => readFileSync(path.join(root, rel), "utf8");

/**
 * Executable text only. These files document their own constraints in prose — the detail route's
 * header explains why it has NO `generateStaticParams` — so a negative assertion against raw
 * source would fail on the documentation rather than on any code.
 */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

/* eslint-disable @typescript-eslint/no-var-requires */
const { PublicAccaIndexView } = require("../components/acca-publication/PublicAccaIndexView") as typeof import("../components/acca-publication/PublicAccaIndexView");
const { PublicAccaDetailView } = require("../components/acca-publication/PublicAccaDetailView") as typeof import("../components/acca-publication/PublicAccaDetailView");
const { HomepagePublishedAccas } = require("../components/homepage/HomepagePublishedAccas") as typeof import("../components/homepage/HomepagePublishedAccas");
const accaSitemap = (require("../app/sitemap") as { default: (p: { id: string }) => Promise<Array<{ url: string }>> }).default;
/* eslint-enable @typescript-eslint/no-var-requires */

const html = (tree: unknown): string => renderToStaticMarkup(tree as never);

/**
 * Sprint 24 — the public components and the structured-data builders now take the redacted
 * PUBLIC PROJECTION rather than the storage record, so that a component cannot render an internal
 * identifier even by accident. Every assertion below is unchanged; only the call shape is.
 *
 * A fixed clock keeps freshness derivation deterministic. It sits after the fixtures' kick-off
 * times, so the default rendering in these suites is a closed Acca — the state most of them are
 * really about.
 */
const NOW = "2026-08-02T09:00:00.000Z";
const view = (acca: AccaRecord) => toPublicAccaView(acca, NOW);

/* ------------------------------------------------------------------ *
 * Seeding
 * ------------------------------------------------------------------ */

async function createDraft(title: string, locale = "en") {
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

async function publish(acca: AccaRecord): Promise<AccaRecord> {
  const result = await getAccaService().transitionAccaLifecycle({
    accaId: acca.accaId,
    expectedStatus: "DRAFT",
    expectedVersion: acca.version,
    nextStatus: "PUBLISHED",
    actor: "admin",
    transitionedAt: "2026-08-01T09:00:00.000Z",
  });
  assert.ok(result.ok, JSON.stringify(result));
  return result.acca;
}

async function archive(acca: AccaRecord): Promise<AccaRecord> {
  const result = await getAccaService().transitionAccaLifecycle({
    accaId: acca.accaId,
    expectedStatus: "PUBLISHED",
    expectedVersion: acca.version,
    nextStatus: "ARCHIVED",
    actor: "admin",
    transitionedAt: "2026-09-01T09:00:00.000Z",
  });
  assert.ok(result.ok, JSON.stringify(result));
  return result.acca;
}

async function createPublished(title: string, locale = "en"): Promise<AccaRecord> {
  return publish(await createDraft(title, locale));
}

/* ================================================================== *
 * 1. Visibility boundary — the core safety property
 * ================================================================== */

test("only PUBLISHED Accas are publicly listed", async () => {
  const draft = await createDraft("Still a draft");
  const live = await createPublished("Actually published");
  const archived = await archive(await createPublished("Was published"));

  const page = await listPublishedAccas({ locale: "en" });
  const ids = page.rows.map((a) => a.accaId);
  assert.deepEqual(ids, [live.accaId], "exactly the published Acca");
  assert.equal(ids.includes(draft.accaId), false, "a draft must never be listed");
  assert.equal(ids.includes(archived.accaId), false, "an archive must never be listed");
});

test("a draft, an archive and an unknown slug are all indistinguishable 404s", async () => {
  const draft = await createDraft("Draft slug");
  const archived = await archive(await createPublished("Archived slug"));

  assert.equal(await getPublishedAccaBySlug({ slug: draft.slug, locale: "en" }), null);
  assert.equal(await getPublishedAccaBySlug({ slug: archived.slug, locale: "en" }), null);
  assert.equal(await getPublishedAccaBySlug({ slug: "no-such-acca", locale: "en" }), null);
  assert.equal(await getPublishedAccaBySlug({ slug: "Not A Slug", locale: "en" }), null);
  // A published one resolves, so the nulls above are a real filter and not a broken lookup.
  const live = await createPublished("Reachable");
  assert.ok(await getPublishedAccaBySlug({ slug: live.slug, locale: "en" }));
});

test("archiving removes a page from the public surface immediately", async () => {
  const live = await createPublished("Temporarily live");
  assert.ok(await getPublishedAccaBySlug({ slug: live.slug, locale: "en" }));
  await archive(live);
  assert.equal(
    await getPublishedAccaBySlug({ slug: live.slug, locale: "en" }),
    null,
    "an archived Acca must stop being reachable at once",
  );
});

test("an Acca is published under its own locale only", async () => {
  const english = await createPublished("English combination", "en");

  // Not reachable from another locale's path...
  assert.equal(await getPublishedAccaBySlug({ slug: english.slug, locale: "tr" }), null);
  // ...and not listed there either.
  const turkish = await listPublishedAccas({ locale: "tr" });
  assert.equal(turkish.rows.length, 0, "no cross-locale duplication");
  assert.equal(turkish.indexable, false);

  const englishPage = await listPublishedAccas({ locale: "en" });
  assert.equal(englishPage.rows.length, 1);
});

test("public reads fail soft rather than throwing", async () => {
  const { setAccaStoreForTests, getAccaStore } = await import("../lib/api/accaComposition");
  const real = getAccaStore();
  setAccaStoreForTests({
    ...real,
    async listAccas() {
      throw new Error("storage down");
    },
    async getAccaBySlug() {
      throw new Error("storage down");
    },
  } as never);
  try {
    const page = await listPublishedAccas({ locale: "en" });
    assert.deepEqual(page, { rows: [], total: 0, indexable: false });
    assert.equal(await getPublishedAccaBySlug({ slug: "anything-here", locale: "en" }), null);
    assert.deepEqual(await listPublishedAccasForSitemap(), []);
  } finally {
    setAccaStoreForTests(null);
  }
});

test("the public list is bounded", async () => {
  const page = await listPublishedAccas({ locale: "en", limit: 9999 });
  assert.ok(page.rows.length <= PUBLIC_LIST_LIMIT);
  assert.equal(PUBLIC_LIST_LIMIT, 24);
});

/* ================================================================== *
 * 2. Indexability is earned
 * ================================================================== */

test("an empty locale is not indexable; one published Acca makes it indexable", async () => {
  assert.equal((await listPublishedAccas({ locale: "en" })).indexable, false);
  await createPublished("First one");
  assert.equal((await listPublishedAccas({ locale: "en" })).indexable, true);
});

test("the index route gates robots on having content", () => {
  const src = readSource("app/[locale]/accas/page.tsx");
  assert.match(src, /index: page\.indexable/, "robots must follow content, not be assumed");
  assert.match(src, /export const dynamic = "force-dynamic"/);
});

test("a missing Acca detail page is noindex", () => {
  const src = readSource("app/[locale]/accas/[slug]/page.tsx");
  assert.match(src, /index: false/);
  assert.match(src, /notFound\(\)/);
  assert.equal(
    /generateStaticParams/.test(codeOnly(src)),
    false,
    "published Accas are operational state; pre-rendering would serve a stale page after archiving",
  );
});

/* ================================================================== *
 * 3. The page must deserve to exist
 * ================================================================== */

test("the detail page explains rather than dumps", async () => {
  const acca = await createPublished("Weekend two-fold");
  const markup = html(PublicAccaDetailView({ view: view(acca) }));

  // Aggregation and synthesis, not a field dump.
  assert.match(markup, /The 2 selections/);
  assert.match(markup, /What this was built on/);
  assert.match(markup, /Limitations/);
  assert.match(markup, /Check the record/);
  // Every selection is explained with its own market and captured price.
  assert.match(markup, /Odds at publication/);
  // Named as the provider figure it is — "Model confidence" claimed both our authorship and a
  // confidence, and the archived record carries no sample for it.
  assert.match(markup, /Provider potential/);
  assert.equal(/Model confidence/.test(markup), false);
  // Derivation of the headline number is stated.
  assert.match(markup, /product of the individual prices/);
  assert.match(markup, /not a probability and not a return estimate/);
  // Internal linking to the surfaces that substantiate it.
  assert.match(markup, /\/en\/methodology/);
  assert.match(markup, /\/en\/archive/);
  assert.match(markup, /\/en\/acca\/builder/);
});

test("limitations are a heading, not a footnote, even when none were recorded", async () => {
  const acca = await createPublished("No warnings here");
  const stripped: AccaRecord = { ...acca, evidenceSnapshot: {} };
  const markup = html(PublicAccaDetailView({ view: view(stripped) }));
  assert.match(markup, /<h2[^>]*>\s*Limitations/);
  // The standing risks are stated regardless of whether the record carried warnings.
  assert.match(markup, /Every selection must land/);
  assert.match(markup, /not re-checked/);
  assert.match(markup, /not a probability of the combination succeeding/);
  // And the absence is stated honestly rather than implying safety.
  assert.match(markup, /That is not a statement that none exist/);
});

test("captured-odds provenance and the not-advice framing appear above the selections", async () => {
  const acca = await createPublished("Framing check");
  const markup = html(PublicAccaDetailView({ view: view(acca) }));
  const framingAt = markup.indexOf("not a recommendation or a tip");
  const tableAt = markup.indexOf("<table");
  assert.ok(framingAt > 0, "the not-advice framing must be present");
  assert.ok(framingAt < tableAt, "framing must precede the selections, not follow them");
  assert.match(markup, /captured when this Acca was created and are never re-fetched/);
});

test("no public surface uses hype, certainty or tip language", async () => {
  const acca = await createPublished("Tone check");
  const surfaces = [
    html(PublicAccaDetailView({ view: view(acca) })),
    html(PublicAccaIndexView({ locale: "en", views: [view(acca)] })),
    html(PublicAccaIndexView({ locale: "en", views: [] })),
  ];
  const banned = [
    /\bguaranteed?\b/i, /\bsure thing\b/i, /\bwill win\b/i, /\bcan't lose\b/i,
    /\bbanker\b/i, /\block\b/i, /\bAI (says|predicts)\b/i, /\btipster\b/i,
    /\bour tip\b/i, /\bbest bet\b/i, /\bwinning\b/i, /\bprofit\b/i,
  ];
  for (const markup of surfaces) {
    for (const pattern of banned) {
      assert.equal(pattern.test(markup), false, `public copy must not contain ${pattern}`);
    }
  }
});

test("the empty index states the truth and routes to real content", () => {
  const markup = html(PublicAccaIndexView({ locale: "en", views: [] }));
  assert.match(markup, /Nothing published yet/);
  assert.match(markup, /stays empty until there is something real to show/);
  assert.match(markup, /\/en\/acca\/builder/);
  assert.match(markup, /\/en\/archive/);
  assert.equal(/<table/.test(markup), false, "no skeleton content on an empty page");
});

test("no affiliate or bookmaker call-to-action was added to a public Acca page", async () => {
  const acca = await createPublished("No CTA");
  const markup = html(PublicAccaDetailView({ view: view(acca) }));
  for (const pattern of [/\/go\//, /bet now/i, /claim bonus/i, /sign up/i, /deposit/i, /rel="sponsored"/]) {
    assert.equal(pattern.test(markup), false, `no affiliate CTA in stage B5 (${pattern})`);
  }
});

/* ================================================================== *
 * 4. Homepage
 * ================================================================== */

test("the homepage section renders nothing when no Acca is published", async () => {
  const rendered = await HomepagePublishedAccas({ locale: "en" });
  assert.equal(rendered, null, "the homepage must be unchanged when nothing is published");
});

test("the homepage section appears once an Acca is published, bounded to three", async () => {
  for (let i = 0; i < 5; i++) await createPublished(`Homepage entry ${i}`);
  const rendered = await HomepagePublishedAccas({ locale: "en" });
  assert.notEqual(rendered, null);
  const markup = html(rendered);
  assert.match(markup, /Recently published Accas/);
  assert.match(markup, /Not tips/);
  const cards = (markup.match(/<article/g) ?? []).length;
  assert.equal(cards, 3, "the homepage is an entry point, not a feed");
  assert.match(markup, /\/en\/accas/);
});

test("the homepage integration is additive and placed after the research surfaces", () => {
  const src = readSource("app/[locale]/page.tsx");
  const homeAt = src.indexOf("<RankWagersHome");
  const accasAt = src.indexOf("<HomepagePublishedAccas");
  assert.ok(homeAt > 0 && accasAt > homeAt, "research first, combinations second");
  // The large existing home component was not modified to accommodate this.
  assert.equal(
    /RankWagersHome[\s\S]{0,400}accas/i.test(src.slice(homeAt, homeAt + 400)),
    false,
    "no prop threading into RankWagersHome",
  );
});

/* ================================================================== *
 * 5. Navigation
 * ================================================================== */

test("navigation gains exactly one Research entry and no existing entry changes", () => {
  // Language sweep: buildPrimaryNav now takes the dictionary.
  const nav = buildPrimaryNav("en", predictionsEn);
  const research = nav.groups.find((g) => g.id === "research");
  assert.ok(research);
  const hrefs = research.items.map((i) => i.href);
  assert.ok(hrefs.includes("/en/accas"), "Published Accas must be reachable");
  assert.equal(hrefs.filter((h) => h === "/en/accas").length, 1);

  // It must not displace an existing compact-desktop entry.
  const entry = research.items.find((i) => i.href === "/en/accas");
  assert.equal(entry?.desktopPrimary, undefined, "must not claim a compact desktop slot");
  assert.equal(entry?.label, predictionsEn.nvAccasPublished);

  // Every pre-existing Research href still present.
  for (const href of ["/en", "/en/acca", "/en/acca/builder", "/en/archive", "/en/methodology"]) {
    assert.ok(hrefs.includes(href), `${href} must still exist`);
  }
});

/* ================================================================== *
 * 6. Sitemap
 * ================================================================== */

test("the sitemap emits no Acca URLs when nothing is published", async () => {
  const entries = await accaSitemap({ id: "accas" });
  assert.deepEqual(entries, [], "an empty listing must never be advertised to a crawler");
});

test("a published Acca appears exactly once, under its own locale", async () => {
  const acca = await createPublished("Sitemap entry", "en");
  const entries = await accaSitemap({ id: "accas" });
  const detail = entries.filter((e) => e.url.includes(`/accas/${acca.slug}`));
  assert.equal(detail.length, 1, "exactly one URL per Acca, not one per locale");
  assert.match(detail[0].url, /\/en\/accas\//);

  // The index URL is emitted only for the locale that has content.
  const indexes = entries.filter((e) => e.url.endsWith("/accas"));
  assert.equal(indexes.length, 1);
  assert.match(indexes[0].url, /\/en\/accas$/);
});

test("drafts and archives never reach the sitemap", async () => {
  const draft = await createDraft("Draft not in sitemap");
  const archived = await archive(await createPublished("Archived not in sitemap"));
  const live = await createPublished("Live in sitemap");

  const entries = await accaSitemap({ id: "accas" });
  const urls = entries.map((e) => e.url).join(" ");
  assert.ok(urls.includes(live.slug));
  assert.equal(urls.includes(draft.slug), false);
  assert.equal(urls.includes(archived.slug), false);
});

test("the accas shard is registered and the other shards are untouched", async () => {
  const { generateSitemaps } = await import("../app/sitemap");
  const ids = (await generateSitemaps()).map((s) => s.id);
  assert.ok(ids.includes("accas"));
  for (const existing of [
    // `compare` left this list with the commercial conversion pass (route retired).
    "static", "operators", "markets", "competitions", "teams", "seasons", "countries",
  ] as const) {
    assert.ok(ids.includes(existing), `${existing} shard must survive`);
  }
  // A pre-existing shard still produces entries, so making the function async broke nothing.
  const staticEntries = await accaSitemap({ id: "static" });
  assert.ok(staticEntries.length > 0);
  assert.equal(
    staticEntries.some((e) => e.url.includes("/accas")),
    false,
    "the static shard must not carry Acca URLs",
  );
});

/* ================================================================== *
 * 7. Structured data
 * ================================================================== */

test("structured data models an Article, never a commercial Offer or a rating", async () => {
  const acca = await createPublished("Schema check");
  const ld = accaDetailLd(view(acca));
  assert.equal(ld["@type"], "Article");
  const serialized = JSON.stringify(ld);
  for (const forbidden of ["Offer", "aggregateRating", "reviewCount", "priceValidUntil", "Product", "ratingValue"]) {
    assert.equal(
      serialized.includes(forbidden),
      false,
      `research must not be marked up as ${forbidden}`,
    );
  }
  assert.equal(ld.headline, acca.title);
  assert.equal(ld.inLanguage, "en");
  assert.equal(ld.datePublished, acca.publishedAt);
  // Author is the organisation; no invented individual.
  assert.equal((ld.author as Record<string, unknown>)["@type"], "Organization");
  assert.equal((ld.publisher as Record<string, unknown>).name, "RankWagers");
  // Fixtures are described, no outcome is claimed.
  const about = ld.about as Array<Record<string, unknown>>;
  assert.equal(about.length, 2);
  assert.equal(about[0]["@type"], "SportsEvent");
});

test("index structured data counts only what is on the page", async () => {
  const a = await createPublished("One");
  const b = await createPublished("Two");
  const ld = accaIndexLd({ locale: "en", views: [view(a), view(b)] });
  assert.equal(ld["@type"], "CollectionPage");
  const list = ld.mainEntity as Record<string, unknown>;
  assert.equal(list.numberOfItems, 2, "no inventory inflation");
  assert.equal((list.itemListElement as unknown[]).length, 2);
});

test("breadcrumbs are well-formed for both index and detail", async () => {
  const acca = await createPublished("Crumbs");
  const index = accaBreadcrumbLd({ locale: "en" });
  assert.equal((index.itemListElement as unknown[]).length, 2);
  const detail = accaBreadcrumbLd({ locale: "en", view: view(acca) });
  const items = detail.itemListElement as Array<Record<string, unknown>>;
  assert.equal(items.length, 3);
  assert.equal(items[2].name, acca.title);
  assert.match(String(items[2].item), /\/en\/accas\//);
});

/* ================================================================== *
 * 8. Architecture
 * ================================================================== */

test("public surfaces reach storage only through the public visibility boundary", () => {
  for (const rel of [
    "app/[locale]/accas/page.tsx",
    "app/[locale]/accas/[slug]/page.tsx",
    "components/acca-publication/PublicAccaIndexView.tsx",
    "components/acca-publication/PublicAccaDetailView.tsx",
    "components/acca-publication/PublicAccaCard.tsx",
    "components/homepage/HomepagePublishedAccas.tsx",
  ]) {
    const src = readSource(rel);
    for (const forbidden of [/getAccaService/, /getAccaStore/, /getCandidateStore/, /adapters\//]) {
      assert.equal(
        forbidden.test(src),
        false,
        `${rel} must not bypass lib/acca-publication/public.ts (${forbidden})`,
      );
    }
  }
});

test("the visibility rule is applied through the single central predicate", () => {
  const src = readSource("lib/acca-publication/public.ts");
  assert.match(src, /isPubliclyVisible/);
  // Every public read path re-applies it.
  assert.equal((src.match(/isPubliclyVisible\(/g) ?? []).length >= 3, true);
});

test("path helpers are the single source of truth for public URLs", () => {
  assert.equal(publicAccaPath("en", "some-slug"), "/en/accas/some-slug");
  assert.equal(publicAccaIndexPath("tr"), "/tr/accas");
  // Components use the helper rather than hand-built strings.
  assert.match(readSource("components/acca-publication/PublicAccaCard.tsx"), /publicAccaPath\(/);
});

test("no admin surface leaked onto a public page", async () => {
  const acca = await createPublished("Leak check");
  const surfaces = [
    html(PublicAccaDetailView({ view: view(acca) })),
    html(PublicAccaIndexView({ locale: "en", views: [view(acca)] })),
  ];
  for (const markup of surfaces) {
    for (const forbidden of [
      /\/admin\//, /Publish Acca/, /Archive Acca/, /candidateId/i,
      /payloadChecksum/i, /Not durable/, /schemaVersion/i, /sourceCandidateId/i,
    ]) {
      assert.equal(forbidden.test(markup), false, `public page leaked ${forbidden}`);
    }
    assert.equal(markup.includes(acca.sourceCandidateId), false);
    assert.equal(markup.includes(acca.accaId), false, "internal ids do not belong on a public page");
  }
});
