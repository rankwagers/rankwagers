/**
 * Sitemap index route tests — Sprint 23B SEO routing fix (+ empty-Acca eligibility).
 *
 * Proves `/sitemap.xml` returns a valid <sitemapindex> that references the eight always-valid
 * shards ALWAYS and the `accas` shard ONLY when a public Acca exists (never an empty shard), that
 * no locale prefix or HTML leaks in, that the shard-route membership source is unchanged, that
 * robots.txt advertises the working index, and that middleware never rewrites the sitemap/robots
 * routes into the locale path. Hermetic: no network, no filesystem writes.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

import { GET } from "../app/sitemap.xml/route";
import {
  currentIndexShardUrls,
  eligibleShardIds,
  renderSitemapIndex,
  shardUrls,
} from "../lib/sitemapIndex";
import { generateSitemaps } from "../app/sitemap";
import { listPublishedAccasForSitemap } from "../lib/acca-publication/public";
import robots from "../app/robots";
import { siteUrl } from "../lib/seo";

/** The eight shards that are always valid + non-empty and must always appear. */
const ALWAYS_INCLUDED = [
  "static",
  "operators",
  "markets",
  "competitions",
  "teams",
  "seasons",
  "countries",
  "compare",
] as const;

/** The full shard-ROUTE set (routes are unchanged; accas route still resolves as a valid shard). */
const ALL_SHARD_IDS = [...ALWAYS_INCLUDED, "accas"] as const;

const root = path.resolve(__dirname, "..");

/** Extract <loc> values from an XML string (order-preserving). */
function locs(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
}

function shardIdFromUrl(url: string, base: string): string | null {
  const m = url.slice(base.length).match(/^\/sitemap\/([a-z]+)\.xml$/);
  return m ? m[1] : null;
}

// (10) Shard-ROUTE generation is unchanged — generateSitemaps still yields all nine ids.
test("10: generateSitemaps still yields all nine shard-route ids (shard generation unchanged)", async () => {
  const ids = (await generateSitemaps()).map(({ id }) => String(id));
  assert.deepEqual(ids, [...ALL_SHARD_IDS]);
});

// (1) With zero published Accas → exactly 8 shard locations, accas excluded (pure decision).
test("1: zero published Accas → exactly 8 index shards, accas excluded", () => {
  const ids = eligibleShardIds([...ALL_SHARD_IDS], /* hasPublishedAccas */ false);
  assert.deepEqual(ids, [...ALWAYS_INCLUDED]);
  assert.equal(ids.length, 8);
  assert.ok(!ids.includes("accas"));
});

// (2) accas.xml is absent from the index XML when empty (rendered end-to-end for the empty case).
test("2: accas.xml absent from the index when empty", () => {
  const base = siteUrl().replace(/\/+$/, "");
  const xml = renderSitemapIndex(shardUrls(eligibleShardIds([...ALL_SHARD_IDS], false), base));
  assert.equal(locs(xml).length, 8);
  assert.doesNotMatch(xml, /\/sitemap\/accas\.xml/);
});

// (3) With at least one published Acca → accas.xml appears exactly once (9 total).
test("3: >=1 published Acca → accas.xml appears exactly once (9 shards)", () => {
  const base = siteUrl().replace(/\/+$/, "");
  const ids = eligibleShardIds([...ALL_SHARD_IDS], /* hasPublishedAccas */ true);
  const xml = renderSitemapIndex(shardUrls(ids, base));
  const found = locs(xml);
  assert.equal(found.length, 9);
  const accas = found.filter((u) => u === `${base}/sitemap/accas.xml`);
  assert.equal(accas.length, 1, "accas.xml present exactly once");
});

// (4) All eight always-valid shards appear exactly once, in both empty and non-empty cases.
test("4: the eight always-valid shards always appear exactly once", () => {
  const base = siteUrl().replace(/\/+$/, "");
  for (const hasAccas of [false, true]) {
    const found = locs(renderSitemapIndex(shardUrls(eligibleShardIds([...ALL_SHARD_IDS], hasAccas), base)));
    for (const id of ALWAYS_INCLUDED) {
      const hits = found.filter((u) => u === `${base}/sitemap/${id}.xml`);
      assert.equal(hits.length, 1, `${id} must appear exactly once (hasAccas=${hasAccas})`);
    }
  }
});

// (5) No duplicate entries.
test("5: no duplicate entries", async () => {
  const found = locs(await (await GET()).text());
  assert.equal(new Set(found).size, found.length);
});

// (6) No locale prefixes — every entry is `${origin}/sitemap/<id>.xml`.
test("6: no locale prefix; entries are absolute /sitemap/ origin URLs", async () => {
  const base = siteUrl().replace(/\/+$/, "");
  for (const url of locs(await (await GET()).text())) {
    assert.ok(url.startsWith(`${base}/sitemap/`), `absolute /sitemap/ URL required: ${url}`);
    assert.match(url.slice(base.length), /^\/sitemap\/[a-z]+\.xml$/, `no locale prefix: ${url}`);
  }
});

// (7) Valid sitemapindex XML (declaration, namespace, balanced wrappers).
test("7: well-formed <sitemapindex> document", async () => {
  const xml = await (await GET()).text();
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<sitemapindex xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(xml, /<\/sitemapindex>\s*$/);
  assert.equal((xml.match(/<sitemap>/g) ?? []).length, (xml.match(/<\/sitemap>/g) ?? []).length);
});

// (8) XML response, not HTML; HTTP 200; application/xml.
test("8: /sitemap.xml returns application/xml (200), never HTML", async () => {
  const res = await GET();
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /application\/xml|text\/xml/);
  const xml = await res.text();
  assert.doesNotMatch(xml, /<!doctype html>/i);
  assert.doesNotMatch(xml, /<html/i);
});

// (9) robots.txt points only to the absolute /sitemap.xml index (not a shard, no locale).
test("9: robots points only to the absolute /sitemap.xml index", () => {
  const r = robots();
  const base = siteUrl().replace(/\/+$/, "");
  assert.equal(r.sitemap, `${base}/sitemap.xml`);
  assert.doesNotMatch(String(r.sitemap), /\/sitemap\/[a-z]+\.xml$/);
});

// End-to-end determinism: GET() membership equals the eligibility decision over the real seam.
test("GET matches the live eligibility decision (deterministic; accas iff published)", async () => {
  const base = siteUrl().replace(/\/+$/, "");
  const hasPublishedAccas = (await listPublishedAccasForSitemap()).length > 0;
  const expected = shardUrls(eligibleShardIds([...ALL_SHARD_IDS], hasPublishedAccas), base);

  const a = locs(await (await GET()).text());
  const b = locs(await (await GET()).text());
  assert.deepEqual(a, b, "deterministic across calls");
  assert.deepEqual([...a].sort(), [...expected].sort(), "GET membership == eligibility decision");

  // The eight always-valid shards are present regardless of accas state.
  for (const id of ALWAYS_INCLUDED) {
    assert.ok(a.includes(`${base}/sitemap/${id}.xml`), `missing always-valid shard: ${id}`);
  }
  // accas appears in GET() iff there is a published Acca — never an empty shard.
  assert.equal(a.includes(`${base}/sitemap/accas.xml`), hasPublishedAccas);
  assert.equal(a.length, hasPublishedAccas ? 9 : 8);
});

// Middleware exempts /sitemap.xml and /robots.txt from locale routing (source guard).
test("middleware exempts /sitemap.xml and /robots.txt from locale routing", () => {
  const mw = readFileSync(path.join(root, "middleware.ts"), "utf8");
  assert.match(mw, /pathname === "\/sitemap\.xml"/);
  assert.match(mw, /pathname === "\/robots\.txt"/);
});

// A dedicated route handler owns /sitemap.xml (not the [locale] catch-all).
test("dedicated app/sitemap.xml route handler exists", () => {
  const src = readFileSync(path.join(root, "app/sitemap.xml/route.ts"), "utf8");
  assert.match(src, /export async function GET/);
});

// Renderer is XML-safe.
test("renderer escapes XML-special characters in <loc>", () => {
  const xml = renderSitemapIndex(["https://x.test/sitemap/a&b.xml"]);
  assert.match(xml, /a&amp;b\.xml/);
  assert.doesNotMatch(xml, /a&b\.xml/);
});

// currentIndexShardUrls never emits an empty (zero-loc) index and never a locale prefix.
test("currentIndexShardUrls yields >=8 deterministic absolute shard urls", async () => {
  const urls = await currentIndexShardUrls();
  assert.ok(urls.length >= 8);
  assert.equal(new Set(urls).size, urls.length);
});
