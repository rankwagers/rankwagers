# Sitemap Index Fix — Implementation Record

**Date:** 2026-07-31
**Scope:** Narrowly-scoped, test-first SEO routing fix. Make `/sitemap.xml` return a valid `<sitemapindex>` referencing exactly the nine existing shard URLs. No sitemap membership logic, shard URL, locale handling (outside sitemap routing), or SEO indexing rule changed. No prediction/evidence/settlement/persistence/affiliate code touched.

**Status:** **DEPLOYED to production and verified live (2026-07-31, real root session).** `/sitemap.xml` now returns HTTP 200 `application/xml` `<sitemapindex>` with 8 entries, locally and publicly. See **§15 — Deployment COMPLETE** for the authoritative record; §1–§14 are the pre-deploy history from earlier `rankdev`-only sessions. Final verdict: **SITEMAP INDEX FIX COMPLETE**.

---

## 1. Root Cause

Next.js 14.2.35 metadata `app/sitemap.ts` uses `generateSitemaps()`. With `generateSitemaps` at the root, Next registers **only** the per-shard routes `/sitemap/<id>.xml` — verified in the build manifests:

- `.next/app-path-routes-manifest.json` → `sitemap/[__metadata_id__]/route` (the nine shards) and `sitemaps/page`. **No `/sitemap.xml` entry.**
- `.next/server/app-paths-manifest.json` → same; no `/sitemap.xml`.

So `/sitemap.xml` has **no route**. Middleware passes `/sitemap.xml` through without a locale prefix (`middleware.ts:97`, `pathname === "/sitemap.xml"`), then the App Router matches the only single-segment catch-all — `app/[locale]` with `locale = "sitemap.xml"` — which is not a valid locale and renders the HTML 404 page. robots.txt advertises `Sitemap: https://rankwagers.com/sitemap.xml`, so Search Console reports "Could not fetch."

**Confirmed live (read-only curl, pre-deploy):** `https://rankwagers.com/sitemap.xml` → **404 `text/html`** (103,828 bytes — the HTML 404 page); all nine shards → **200 `application/xml`**; robots.txt → 200 advertising the broken index URL.

---

## 2. Exact Files Changed

| File | Type | Change |
|---|---|---|
| `app/sitemap.xml/route.ts` | **NEW** runtime (additive) | Route Handler serving `GET /sitemap.xml` → `<sitemapindex>` over the nine shard URLs. |
| `tests/sitemapIndex.test.ts` | **NEW** test | 10 assertions covering the required contract (below). |
| `docs/plans/sitemap-index-fix-implementation.md` | **NEW** doc | This record. |

**No existing file was modified.** `app/sitemap.ts` (shard generation/membership), `middleware.ts`, `app/robots.ts`, and all nine shard routes are byte-unchanged. Backups/rollback snapshot in the session scratchpad (`sitemap-fix-backup/`), rollback = delete the three new files.

---

## 3. Route Architecture Selected

**A dedicated Route Handler at `app/sitemap.xml/route.ts`** — the smallest architecture that avoids collision:

- The metadata route owns the path segment `sitemap/` → `/sitemap/[id].xml`. The new handler owns the **distinct literal segment** `sitemap.xml` → `/sitemap.xml`. The two paths never overlap (`sitemap/[__metadata_id__]/route` vs `sitemap.xml/route`), so the nine shards are untouched and keep returning 200.
- It reads the shard IDs from the **same `generateSitemaps()` source of truth** in `app/sitemap.ts` (imported read-only), so the index can never drift from — and never changes — shard membership. `generateSitemaps` is `async`; the handler awaits it.
- Middleware already exempts `/sitemap.xml` from locale rewriting, so the path is **never interpreted as a locale** once a route exists to serve it.
- Output: XML-escaped, deterministic order, absolute origin URLs, de-duplicated (`Set`), no locale prefix. Headers: `Content-Type: application/xml; charset=utf-8`, `Cache-Control: public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400` (crawl-friendly); `revalidate = 3600`, `dynamic = "force-static"`.

**Rendered output (verified in-process, `SITE_URL=https://rankwagers.com`):** HTTP 200, `application/xml; charset=utf-8`, 873 bytes, 9 `<loc>` entries:
```
https://rankwagers.com/sitemap/{static,operators,markets,competitions,teams,seasons,countries,compare,accas}.xml
```

Alternatives rejected: (a) changing `app/sitemap.ts` to stop using `generateSitemaps` — would alter the shard URLs (forbidden); (b) a middleware rewrite — heavier, unnecessary since a route handler is additive and self-contained.

---

## 4. Focused Tests (`tests/sitemapIndex.test.ts`) — 10/10 PASS

1. Index is a well-formed `<sitemapindex>` document (xml decl, ns, balanced `<sitemap>`). ✅
2. Exactly nine `<loc>` shard entries. ✅
3+4. Every expected shard present exactly once; no unexpected shard; no duplicates. ✅
5. No locale prefix; every entry is `${origin}/sitemap/<id>.xml` (absolute). ✅
6. Returns `application/xml`, never HTML (no `<!doctype html>`/`<html>`). ✅
7. A dedicated `app/sitemap.xml/route.ts` handler exists (not `[locale]` fallthrough). ✅
8. `generateSitemaps()` still yields exactly the nine ids (membership unchanged). ✅
9. robots points only to the absolute `/sitemap.xml` index (not a shard). ✅
10. Middleware special-cases `/sitemap.xml` and `/robots.txt` (not locale-rewritten). ✅
+ renderer determinism & XML-escaping (ampersand → `&amp;`). ✅

---

## 5. Full Regression / Typecheck / Lint

- **Focused sitemap suite:** 10/10 pass.
- **Crawl-quality + SEO-intelligence:** `tests/crawlQuality.test.ts` + `tests/sprint22SeoIntelligence.test.ts` → 22/22 pass (shard membership/coverage unchanged).
- **Full suite:** `1864/1864` pass, 0 fail / 0 skip (prior floor 1854 + 10 new; standard env). *(Note: running the full suite with `APP_ENV=production` overrides produces 69 env-dependent failures unrelated to this change — staging/noindex/siteUrl assertions; the standard env run is 1864/1864.)*
- **Typecheck** (`npm run typecheck`): exit 0.
- **Lint** (`next lint`): clean, no warnings/errors.

---

## 6. Build

**Not completed — blocked by environment permissions (not a code defect).** `npm run build` runs `scripts/prepare-dev.mjs`, which reads `.env.local` → symlink to `/opt/rankwagers/shared/.env` (`-rw------- root root`). As `rankdev` this is **EACCES (permission denied)**, so the build aborts before `next build`. I lack read access to production secrets and must not circumvent that boundary. Additionally, `next build` in this checkout begins by `rm -rf .next`, and local `:3000` is currently serving from this checkout — a build here would risk disrupting the live local server. Route-registration soundness is instead evidenced by the build manifests (distinct `sitemap.xml/route` vs `sitemap/[__metadata_id__]/route` segments), a clean typecheck, and the in-process 200/xml/9-loc render.

---

## 7. Local / Public `/sitemap.xml` Result

- **In-process handler render:** HTTP 200, `application/xml; charset=utf-8`, 873 bytes, 9 `<loc>`, deterministic, no locale prefix. ✅
- **Public (pre-deploy):** `https://rankwagers.com/sitemap.xml` → **404 `text/html`** (unchanged until deploy). The fix is code-complete but not yet live.

---

## 8. Status of All Nine Shards (public, read-only, pre-deploy)

| Shard | HTTP | Content-Type | Size |
|---|---|---|---|
| /sitemap/static.xml | 200 | application/xml | 77,828 |
| /sitemap/operators.xml | 200 | application/xml | 132,308 |
| /sitemap/markets.xml | 200 | application/xml | 36,071 |
| /sitemap/competitions.xml | 200 | application/xml | 73,322 |
| /sitemap/teams.xml | 200 | application/xml | 213,236 |
| /sitemap/seasons.xml | 200 | application/xml | 80,102 |
| /sitemap/countries.xml | 200 | application/xml | 49,340 |
| /sitemap/compare.xml | 200 | application/xml | 81,005 |
| /sitemap/accas.xml | 200 | application/xml | 110 (valid empty shard) |

All nine remain 200 and unchanged (the fix does not touch them).

---

## 9. robots.txt Result

Public `https://rankwagers.com/robots.txt` → 200 `text/plain`, 2,059 bytes, contains exactly:
```
Sitemap: https://rankwagers.com/sitemap.xml
```
Unchanged by this fix (already correct). Once deployed, that advertised URL resolves to the new index.

---

## 10. Readiness / Homepage Result

- Homepage: local `:3000` → HTTP 307, public `https://rankwagers.com/` → HTTP 307 (normal locale/country redirect; app is up).
- Readiness: `https://rankwagers.com/api/readiness` → 404 (path likely differs; homepage 307 confirms serving). Not affected by this fix.

---

## 11. Rollback Path

Purely additive — rollback = delete the three new files (`app/sitemap.xml/route.ts`, `tests/sitemapIndex.test.ts`, this doc) and rebuild/restart. No existing file changed, no data/schema/config touched. Baseline reference copies of `app/sitemap.ts`, `middleware.ts`, `app/robots.ts` (all unchanged) kept in the session scratchpad `sitemap-fix-backup/` with `ROLLBACK.txt`.

---

## 12. Deployment — BLOCKED (operator handoff required)

The build + PM2 restart + public verification could not be safely completed from this session:

1. **Root-only secrets:** `/opt/rankwagers/shared/.env` is `-rw------- root root`; `.env.local` symlinks to it. `prepare-dev.mjs`/`next build` cannot read it as `rankdev` (EACCES). An authoritative build requires the deploy user with access to the shared secrets.
2. **Ambiguous authoritative topology:** the registered PM2 process `rankwagers` (id 0) is **stopped** with `cwd=/var/www/rankwagers` and `script=/usr/bin/npm`, while `deploy/ecosystem.rankwagers.cjs` defines a different app `rankwagers-prod` at `/opt/rankwagers/current`. `/opt/rankwagers/current` is not a populated release symlink and `releases/` is empty — yet `:3000` and the public domain are actively serving. What actually serves production is not unambiguously identifiable from this session, so an unsupervised restart/rebuild risks an outage.
3. **Live-serving-from-checkout risk:** `:3000` serves from this checkout; `next build` here would `rm -rf .next` and could disrupt the running server.

**Recommended operator steps (with root/deploy authority):**
- Pull these three new files into the authoritative release path.
- Build there with the shared `.env` available (`npm run build`).
- Restart **only** the authoritative RankWagers process (`pm2 restart <authoritative name>` — confirm it against what serves `:3000`; do **not** `pm2 restart all`).
- Verify: `curl -I` local + public `/sitemap.xml` (expect 200 `application/xml`, ~873 bytes, 9 `<loc>`), all nine shards (expect unchanged 200), `/robots.txt`, homepage, readiness.
- Rollback if needed: delete the three files, rebuild, restart the single process.

---

## 13. Search Console

After the operator deploys and public `curl https://rankwagers.com/sitemap.xml` returns 200 `application/xml` with the nine `<loc>` entries, **Search Console can safely resubmit `/sitemap.xml`** — it will fetch a valid sitemap index pointing at the nine already-indexable shards. Until then, resubmission would still hit the 404. **Not yet safe to resubmit** (deploy pending).

---

**Verdict: SITEMAP INDEX FIX PARTIAL** — code-complete, fully test/typecheck/lint/regression-validated, and proven to emit the correct index in-process; production build + restart deferred to an operator with root/deploy authority due to root-only secrets and an ambiguous serving topology.

---

## 14. Amendment (2026-07-31) — Empty-Acca Eligibility Correction + Root-Deploy Attempt

### 14.1 Empty-shard (accas) eligibility correction — DONE

Search Console rejects `/sitemap/accas.xml` while it is an empty urlset (zero `<url>`). The index must
therefore reference `accas` **only** when a public Acca exists — while keeping the shard capability
(never hardcoded out; auto-eligible once ≥1 public Acca is published).

Implemented in `app/sitemap.xml/route.ts` using the existing publication source of truth
`listPublishedAccasForSitemap()` (the same seam the accas shard itself uses):
- `eligibleShardIds(allIds, hasPublishedAccas)` — pure, order-preserving; drops only `accas` when it
  has no public URLs; the eight always-valid shards always included.
- `currentIndexShardUrls()` — reads `generateSitemaps()` (all nine shard-route ids, **unchanged**) and
  `(await listPublishedAccasForSitemap()).length > 0`, then filters.
- Deterministic; `revalidate = 3600` re-evaluates eligibility hourly (a newly-published Acca appears
  within the cache window). Shard ROUTES and membership logic untouched — `/sitemap/accas.xml` still
  resolves as a valid (possibly empty) urlset.

**In-process render (current env, published accas = 0):** HTTP 200, `application/xml; charset=utf-8`,
**8 `<loc>` entries** (static, operators, markets, competitions, teams, seasons, countries, compare),
**accas absent**, deterministic, `Cache-Control: public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400`.

### 14.2 Root-authoritative topology (operator-provided)

release=/var/www/rankwagers · PM2 owner=root · PM2 app=aff-site · exec=/var/www/rankwagers/node_modules/next/dist/bin/next · args=`start -p 3000` · nginx upstream=127.0.0.1:3000 · pre-deploy PID=293 · restarts=0. This supersedes the earlier `/opt/rankwagers/current` assumption.

### 14.3 Validation (this session, standard env — no APP_ENV=production override)

- Focused `tests/sitemapIndex.test.ts`: **15/15 pass** (8-when-empty, accas-when-published, all 10 required points).
- Crawl-quality + SEO-intelligence: **22/22 pass**.
- Full suite: **1869/1869 pass**, 0 fail (floor 1864 + 5 net-new sitemap tests).
- Typecheck: exit 0. Lint: clean.

### 14.4 Records

- Old BUILD_ID (checkout `.next`, currently served): `d0O_xtAid_f3DLKqaj63f`.
- New BUILD_ID: **N/A — production build not performed this session** (see 14.5).
- package-lock.json SHA-256: `108f2b9785227b04f5b343935391dd2c0794745a101bfd8e110b578e65168f98`.
- Changed-file SHA-256 (post-change): route.ts `02295020b4cda9bd65e1b4ff74b470a13c1ab8d062b86a8e02ba9f2022beed5c`; test `4848f3e275735478dd3558e8d0f5f02b7febfc6e02432f5b0b1a0862a9faa491`.
- Timestamped rollback backups (session scratchpad, this user): `rollback-20260731T224608Z/` (pre-change route.ts, test, doc). No secret values recorded anywhere.

### 14.5 Build / deploy — BLOCKED on real root (this session runs as `rankdev`)

Despite the root-privilege directive, the live shell is `id -un` = **`rankdev`** and `sudo -n` reports
"a password is required" — no escalation is possible. Consequently, as `rankdev` I cannot and must not:
- **Build:** `npm run build` → `prepare-dev.mjs` reads `.env.local` → root-only `/opt/rankwagers/shared/.env` → EACCES; and `next build` first `rm -rf .next`, but the **live aff-site (PID 293) serves this checkout's `.next` (BUILD_ID d0O_xtAid_f3DLKqaj63f)** — rebuilding here would break production.
- **Deploy:** the authoritative `aff-site` process belongs to the **root** PM2 daemon, which is not reachable from the `rankdev` PM2 daemon (which only shows a stopped legacy `rankwagers`). I cannot `pm2 reload aff-site` without root.

No build, no `.next` deletion, no PM2 restart, no secret access was performed. Public `/sitemap.xml`
remains **404 text/html** (unchanged) until an operator with root completes the deploy.

**Operator steps (as root, in /var/www/rankwagers):** `npm run build` (root can read the shared `.env`;
new BUILD_ID will differ) → `pm2 reload aff-site` (or `restart`, `--update-env` only if env changed) →
do **not** touch aff-panel / telegram-eng / telegram-invite; never `pm2 restart all`. Then curl-verify
local + public `/sitemap.xml` (expect 200 application/xml, 8 `<loc>`, no accas), the nine shards (all
200; accas stays a valid empty urlset but absent from the index), `/robots.txt`, homepage, readiness;
observe aff-site ≥10 min for restart/fatal regression.

### 14.6 Current index membership count

**8** (static, operators, markets, competitions, teams, seasons, countries, compare). accas auto-joins
(→ 9) once ≥1 public Acca is published.

### 14.7 Rollback path

Purely additive; no existing file changed. Rollback = delete `app/sitemap.xml/route.ts`,
`tests/sitemapIndex.test.ts`, this doc; rebuild + `pm2 reload aff-site`. Pre-change copies in the
session scratchpad `rollback-20260731T224608Z/`. No data/schema/config/secret touched.

### 14.8 Search Console

Once public `/sitemap.xml` is proven 200 `application/xml`: `/sitemap.xml` may be resubmitted; keep the
eight working individual shard submissions; **remove the manually submitted `/sitemap/accas.xml`** entry
and do not resubmit it until it contains ≥1 URL. Not yet safe this session (deploy pending).

**Amended verdict: SITEMAP INDEX FIX PARTIAL** — empty-Acca eligibility correction complete and fully
validated (15/15 focused, 1869/1869 full, tc 0, lint clean, 8-entry deterministic render); privileged
build + `aff-site` reload require an operator with genuine root (this session is `rankdev`, no sudo).

---

## 15. Deployment COMPLETE (2026-07-31, real root session)

This session ran as **actual uid 0 root** (`whoami=root`, `id -u=0`, `pwd=/var/www/rankwagers`), so the build + `aff-site` reload that every prior `rankdev` session had to defer were finally executed and verified live.

### 15.1 Additional root cause found and fixed (build blocker)

The route file from §14 declared the pure helpers (`eligibleShardIds`, `shardUrls`, `renderSitemapIndex`, `currentIndexShardUrls`) as **named exports of the Route Handler**. `npm run typecheck` passed (plain `tsc` does not run Next's route-type plugin), but `next build` **failed**:

```
app/sitemap.xml/route.ts
Type error: Route "app/sitemap.xml/route.ts" does not match the required types of a Next.js Route.
  "eligibleShardIds" is not a valid Route export field.
```

A Next.js App Router route may only export the known route fields (`GET`, `revalidate`, …). This is why the route had never actually built/deployed — the live `.next` (old BUILD_ID `d0O_xtAid_f3DLKqaj63f`) contained **no `/sitemap.xml` route** at all (confirmed: `app-path-routes-manifest.json` had only `sitemap/[__metadata_id__]/route`).

**Fix:** moved the pure/testable logic to a plain module **`lib/sitemapIndex.ts`** (new). The route now imports `currentIndexShardUrls` + `renderSitemapIndex` from it and exports **only** `GET` + `revalidate`. Behaviour is byte-identical; only file layout changed. Tests repoint their helper imports to `../lib/sitemapIndex` (`GET` still from the route).

### 15.2 Exact files changed (final)

| File | Type | SHA-256 (post-change) |
|---|---|---|
| `lib/sitemapIndex.ts` | **NEW** — pure index logic (escape, eligibility, render, resolve) | `6123dffeeb65ba5946045dca688cd9b37af317d6873945438449bd13af23790c` |
| `app/sitemap.xml/route.ts` | **MODIFIED** — slimmed to `GET` + `revalidate`, imports from `@/lib/sitemapIndex` | `e4a83c61eca15f513ffda35ee358648667f8e58e05da703e669ab2295d9278f2` |
| `tests/sitemapIndex.test.ts` | **MODIFIED** — helper imports now from `../lib/sitemapIndex` | `7bd3487750a7d0e0f2dc1d2da0737dec9f35a11b2124347df90998a1a356be8a` |
| `docs/plans/sitemap-index-fix-implementation.md` | **MODIFIED** — this section | — |

`app/sitemap.ts` (shard generation/membership), `middleware.ts`, `app/robots.ts`, and all nine shard routes remain **byte-unchanged**.

### 15.3 Empty-Acca eligibility (unchanged from §14, re-confirmed live)

Derived from `listPublishedAccasForSitemap()` — the same publication source of truth the accas shard uses. `eligibleShardIds()` drops `accas` only while it has zero public URLs; the eight always-valid shards are always present. With 0 published Accas the index emits **8** entries; the moment ≥1 public Acca exists, `accas` auto-joins (→ 9) within the hourly `revalidate` window. Not hardcoded out. Verified: prerendered `.next/server/app/sitemap.xml.body` = 8 loc, no accas.

### 15.4 Validation (final code, standard env — no APP_ENV override)

- Focused `tests/sitemapIndex.test.ts`: **15/15 pass**.
- Crawl-quality (`crawlQuality.test.ts`): **11/11**; SEO-intelligence (`sprint22SeoIntelligence.test.ts`): **11/11**.
- Full suite: **1868 pass / 1 skipped / 0 fail** (1869 total). The single skip is `evidenceArchiveFileAdapter.test.ts:253` — a pre-existing conditional skip that fires *because the session is root* ("EACCES cannot be provoked via chmod"), unrelated to this change.
- `npm run typecheck`: exit 0. `npm run lint`: clean.
- `npm run build`: **success** — `/sitemap.xml` now listed as a static route alongside the 9 shards; `app-path-routes-manifest.json` now contains `"/sitemap.xml/route":"/sitemap.xml"`.

### 15.5 BUILD_ID

- Old (pre-deploy, served by PID 293): `d0O_xtAid_f3DLKqaj63f`
- New (deployed): **`FVfbHCw8keLf1L74rnXWP`**

### 15.6 Deploy action

In-place `npm run build` (root can read `.env.local` → `/opt/rankwagers/shared/.env`; `siteUrl()` resolved to `https://rankwagers.com` at build). Then **`pm2 reload aff-site`** only (no `--update-env` — no env change). New PID **4153113**, restart count 1 (single reload), status online. Port 3000 confirmed owned by the new PID. **aff-panel / telegram-eng / telegram-invite untouched** (restart counts unchanged). `pm2 restart all` never run.

### 15.7 Post-deploy verification (local 127.0.0.1:3000 and public https://rankwagers.com)

**`/sitemap.xml`** — local & public: HTTP **200**, `content-type: application/xml; charset=utf-8`, `x-nextjs-cache: HIT`, `cache-control: public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400`, root element `<sitemapindex>`, **8 `<loc>`**, **no accas**, no HTML, all absolute `https://rankwagers.com/sitemap/<id>.xml`, no locale prefix. Entries: static, operators, markets, competitions, teams, seasons, countries, compare.

**Nine shards** — local & public, all HTTP 200 `application/xml`:

| Shard | `<url>` count |
|---|---|
| static | 480 |
| operators | 780 |
| markets | 210 |
| competitions | 420 |
| teams | 1260 |
| seasons | 420 |
| countries | 300 |
| compare | 450 |
| accas | 0 (valid empty urlset — absent from index) |

**`/robots.txt`** — local & public: HTTP 200 `text/plain`, exactly one `Sitemap: https://rankwagers.com/sitemap.xml`.

**Homepage** — local `307 → /en`, public `307 → /sv` (normal geo/locale redirect; app up).

**Readiness** — `/api/health/ready` → **503**, cause `env degraded: ATTRIBUTION_DATABASE_URL / ODDS_HISTORY_DATABASE_URL unset` (the separate persistence gap; `site_url` check ok). Pre-existing; **not degraded** by this deploy.

### 15.8 Stability

aff-site observed post-reload: online, restart count steady at 1 (no crash loop; `max_restarts:10`/`min_uptime:10s` guard not tripped). 10-minute observation window recorded below.

### 15.9 Rollback path

Root-only, outside web root: **`/root/rollback/sitemap-index-fix-20260731T225425Z`**. Contains: `BUILD_ID.before` (`d0O_xtAid_f3DLKqaj63f`) / `BUILD_ID.after`, `.next.before/` (full pre-deploy 350M artifact), `files/` (pre-change `app/sitemap.xml/route.ts`, `app/sitemap.ts`, `tests/sitemapIndex.test.ts`, `app/robots.ts`, `middleware.ts`, doc), `app-path-routes-manifest.before.json`, `pm2-jlist.before.json`, `pm2-aff-site.describe.before.txt`, `package-lock.sha256` (`108f2b9785227b04f5b343935391dd2c0794745a101bfd8e110b578e65168f98`). **Rollback procedure:** restore `files/` over the tree, remove `lib/sitemapIndex.ts`, `rsync`/copy `.next.before/` back to `.next` (or `npm run build`), then `pm2 reload aff-site`. No data/schema/config/secret changed. No secrets recorded anywhere in this doc or the rollback dir.

### 15.10 Search Console

Public `/sitemap.xml` is now confirmed **200 `application/xml`** → **safe to resubmit `/sitemap.xml`**. Keep the eight working individual shard submissions. **Remove the manually submitted `/sitemap/accas.xml`** entry; do not resubmit accas.xml until it contains ≥1 URL (it auto-enters the index once a public Acca is published).

**Final verdict: SITEMAP INDEX FIX COMPLETE.**

### 15.8b Stability log (11 samples over 10 min, reload at pid 4153113)

```
t+0m @23:13:38  aff-site=1/online/pid4153113  local/sitemap.xml=200  public=200
t+1m @23:14:39  aff-site=1/online/pid4153113  local/sitemap.xml=200  public=200
t+2m @23:15:40  aff-site=1/online/pid4153113  local/sitemap.xml=200  public=200
t+3m @23:16:41  aff-site=1/online/pid4153113  local/sitemap.xml=200  public=200
t+4m @23:17:41  aff-site=1/online/pid4153113  local/sitemap.xml=200  public=200
t+5m @23:18:42  aff-site=1/online/pid4153113  local/sitemap.xml=200  public=200
t+6m @23:19:43  aff-site=1/online/pid4153113  local/sitemap.xml=200  public=200
t+7m @23:20:43  aff-site=1/online/pid4153113  local/sitemap.xml=200  public=200
t+8m @23:21:44  aff-site=1/online/pid4153113  local/sitemap.xml=200  public=200
t+9m @23:22:45  aff-site=1/online/pid4153113  local/sitemap.xml=200  public=200
t+10m @23:23:46  aff-site=1/online/pid4153113  local/sitemap.xml=200  public=200
```

Result: aff-site restart count steady at **1** (no crash loop), pid unchanged (4153113), port 3000 continuously owned by it; local + public `/sitemap.xml` = 200 on every sample. aff-panel / telegram-eng / telegram-invite restart counts unchanged (untouched).
