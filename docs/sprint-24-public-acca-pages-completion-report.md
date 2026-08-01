# Sprint 24 — Public Acca Pages & Shareable Accas

**Status:** COMPLETE on localhost · **not deployed** · Sprint 20B remains operator-gated
**Date:** 2026-07-28

> **Numbering note.** `docs/sprint-24-completion-report.md` already exists and belongs to a
> different piece of work (Prediction Calibration, Builder Quality & Decision Governance,
> 2026-07-26). The two sprint-24s are unrelated; this document is named after the feature so
> neither overwrites the other. Same for `tests/sprint24CalibrationIntelligence.test.ts` versus
> `tests/sprint24PublicAccaPages.test.ts`.

---

## 1. What already existed (audit before any change)

Sprint 20B-B stages B1–B6 had already built the entire publication chain and a first public
surface. This sprint therefore **completed a reader surface on an existing domain** rather than
building a publication layer:

| Already present | Where |
|---|---|
| Candidate lifecycle DRAFT → APPROVED / REJECTED → CONVERTED, guarded, versioned | `lib/builder-approval/*` |
| Acca lifecycle DRAFT → PUBLISHED → ARCHIVED, terminal archive, immutable snapshot | `lib/acca-publication/lifecycle.ts`, `contracts.ts` |
| Atomic candidate→Acca conversion, idempotent, one Acca per candidate | `lib/acca-publication/service.ts`, `adapters/memory.ts`, `adapters/postgres.ts` |
| Admin publish/archive API with auth, CSRF, rate limits, HTTP idempotency | `app/api/admin/accas/**`, `lib/api/accaLifecycleRoute.ts` |
| Public index + detail routes, visibility boundary, sitemap shard, breadcrumb/Article JSON-LD | `app/[locale]/accas/**`, `lib/acca-publication/public.ts`, `schema.ts` |
| PostgreSQL adapter + migration `db/migrations/20260728_create_published_accas.sql` | structurally implemented, **never executed** |

**Route family decision.** The brief proposed a singular family. The repository already establishes
the **plural** `/{locale}/accas` as canonical for public Accas — sitemap, primary navigation,
homepage section and the published operations runbook all use it — while the singular
`/{locale}/acca` family is the Studio workspace and the Builder, both `noindex`. Adding
`/{locale}/acca/{slug}` would have created a second indexable URL for one document. **No competing
route was introduced and no redirect was needed**, because no legacy route points at the singular
form. A test asserts `app/[locale]/acca/[slug]` does not exist.

## 2. Existing primitives reused

`pageMetadata` / `siteUrl` / `hreflangLanguages` (`lib/seo.ts`) · `JsonLd` · `getFeatureFlags` ·
`trackAnalyticsEvent` (`lib/analytics/client.ts`) · `rememberImpression` +
`IMPRESSION_INTERSECTION_THRESHOLD` (`lib/analytics/impressions.ts`) · `AnalyticsEventName` closed
union · `ABSENT` / `displayOdds` / `isoUtc` / `textOrAbsent` / `CAPTURED_ODDS_NOTE` /
`NOT_ADVICE_NOTE` (`lib/acca-publication/presentation.ts`) · `isPubliclyVisible` · `isValidAccaSlug`
· `getAccaService` composition · the existing branded `/opengraph-image` · `findClaimViolations`
(`lib/trust/claims.ts`, in tests) · the existing admin publish endpoint and its whole security
pipeline.

**Nothing parallel was created.** No second analytics abstraction, no second slip store, no second
URL builder, no new OG image infrastructure, no new API surface.

## 3. Files created

| File | Purpose |
|---|---|
| `lib/acca-publication/freshness.ts` | Availability + odds-age + settlement derivation (pure) |
| `lib/acca-publication/publicView.ts` | Record → public projection; the field boundary |
| `lib/acca-publication/publicIndex.ts` | Facets, filtering, paging, indexability (pure) |
| `lib/acca-publication/paths.ts` | Path + canonical URL construction, dependency-light |
| `lib/acca-publication/seo.ts` | Index and detail metadata builders |
| `lib/acca-publication/analytics.ts` | Typed wrapper over the existing analytics spine |
| `components/acca-publication/PublicAccaFilters.tsx` | Facet links (server) |
| `components/acca-publication/PublicAccaPagination.tsx` | Page links (server) |
| `components/acca-publication/AccaShareControls.tsx` | Copy + Web Share + fallback (client) |
| `components/acca-publication/AccaIndexAnalytics.tsx` | Index measurement island (client, renders null) |
| `components/acca-publication/AccaDetailAnalytics.tsx` | Detail measurement island (client, renders null) |
| `tests/sprint24PublicAccaPages.test.ts` | 88 tests |
| `docs/sprint-24-public-acca-pages-completion-report.md` | this document |

## 4. Files modified

| File | Change |
|---|---|
| `lib/acca-publication/public.ts` | Feature-flag gate; `listPublicAccaViews`, `getPublicAccaView`; path re-exports |
| `lib/acca-publication/schema.ts` | Takes the public projection instead of the storage record |
| `app/[locale]/accas/page.tsx` | searchParams, filters, pagination, flag gate, per-request memo |
| `app/[locale]/accas/[slug]/page.tsx` | Projection, flag gate, per-request memo, new metadata builder |
| `components/acca-publication/PublicAccaIndexView.tsx` | Grouping, filters, pagination, analytics island, gated Builder entry |
| `components/acca-publication/PublicAccaDetailView.tsx` | Six new sections, disclosures, share, analytics island |
| `components/acca-publication/PublicAccaCard.tsx` | Takes the projection; state label; `data-acca-*` attributes |
| `components/homepage/HomepagePublishedAccas.tsx` | Consumes the projection; hides when the flag is off |
| `lib/config/featureFlags.ts` | `publicAccaPagesEnabled` + `FF_PUBLIC_ACCA_PAGES_ENABLED` |
| `lib/analytics/types.ts` | Ten Sprint 24 event names appended |
| `tests/accaApiFixtures.ts` | Clears `FF_PUBLIC_ACCA_PAGES_ENABLED` between suites |
| `tests/accaPublicPages.test.ts` | Call sites adapted to the projection; **no assertion changed** |
| `tests/accaEndToEnd.test.ts` | Same |
| Docs | `architecture.md`, `acca-publication-operations.md`, `feature-flags.md`, `analytics-tracking-plan.md`, `seo-indexability-rules.md`, `accessibility.md`, `security.md`, `design-system.md`, `route-inventory.generated.md` |

`app/sitemap.ts` needed **no change**: it already reads through `listPublishedAccasForSitemap`,
which now returns nothing when the flag is off.

## 5. Database migrations

**None.** No schema change was required: freshness, the odds band, evidence strength and every
facet are derived from fields the existing `published_accas` row already carries. The Sprint 20B-B
migration `db/migrations/20260728_create_published_accas.sql` is unchanged and, as before, **has
never been executed against a real PostgreSQL server**.

## 6. Routes implemented

| Route | Rendering | Robots |
|---|---|---|
| `/{locale}/accas` | dynamic, server-rendered | index when ≥1 published Acca, unfiltered, page in range |
| `/{locale}/accas?page=N` | dynamic | index (own canonical, own title); `?page=1` never emitted |
| `/{locale}/accas?profile=…&competition=…&state=…` | dynamic | `noindex, follow`, canonical → bare index |
| `/{locale}/accas/{slug}` | dynamic | index; canonical only, **no hreflang alternates** |
| `/{locale}/acca`, `/{locale}/acca/builder` | unchanged | unchanged (`noindex`) |

Build output confirms `/[locale]/accas` and `/[locale]/accas/[slug]` produce no prerendered HTML —
`force-dynamic` is honoured, so an archived Acca disappears immediately.

## 7. Publication lifecycle behaviour

Unchanged and re-asserted end to end through the real HTTP handlers:

- APPROVED candidate + matching version → one Acca DRAFT, in one transaction with the candidate's
  move to CONVERTED.
- DRAFT candidate → `409 candidate_status_conflict`. REJECTED → the same.
- Stale `expectedCandidateVersion` → `409 candidate_version_conflict`.
- Second conversion of the same candidate → refused; exactly one Acca per candidate, ever.
- Replayed publish with the same `Idempotency-Key` → the stored response replays; the record moves
  one version, not two.
- Publication moves `status`, `version`, `updatedAt`, `publishedAt`, `publishedBy` only. Title,
  legs, odds, evidence, qualification, slug and `createdAt` are byte-identical before and after.
- Nothing in this sprint mutates the store. Every page and component reaches storage only through
  `lib/acca-publication/public.ts`.

## 8. Feature flags used

- **`publicAccaPagesEnabled`** (new, `FF_PUBLIC_ACCA_PAGES_ENABLED`, default **true**). Gates the
  reader surface only. Off ⇒ both routes 404, homepage section hides, sitemap shard empties, no
  stored record changes. Independent of `operatorApprovalEnabled` in both directions — full
  interaction table in `docs/feature-flags.md`.
- **`operatorApprovalEnabled`** (existing, default false) — unchanged; still gates the admin
  backend.
- **`comboRouteEnabled`** (existing) — reused to decide whether the public index offers the Acca
  Builder entry point, so it never links to a switched-off generation surface.

A new flag was added only after auditing the existing ones: none expressed *public publication
availability* as distinct from *admin publication capability*.

## 9. Analytics events added

`acca_index_view` · `acca_card_impression` · `acca_card_click` · `acca_detail_view` ·
`acca_leg_expand` · `acca_evidence_expand` · `acca_share_open` · `acca_share_copy` ·
`acca_share_native` · `acca_builder_entry_click`

Exhaustive property allowlist: `publicAccaId` (the **slug**), `surface`, `locale`, `profile`,
`legCount`, `oddsBand`, `freshnessState`, `position`, `page`, `resultCount`, `filtered`,
`shareMethod`. No free-form bag; anything else is dropped.

**Deliberate deviation from the brief:** the property is `oddsBand`, not `targetOddsBand`. The
Builder's target odds range is generation configuration and is not copied onto the published
snapshot, so a field named "target" would assert something no stored record carries. The band is
derived from the combined price the server calculated and published.

## 10. SEO changes

- **Fixed a real defect:** the detail page was emitting `hreflang` for all 30 locales, 29 of which
  return 404 for that slug. It now declares a canonical and no alternates.
- Crawlable pagination with its own canonical and title per page; `?page=1` never emitted.
- Filtered views `noindex, follow`, canonical → bare index.
- Out-of-range page numbers clamp and become non-indexable.
- Structured data now built from the redacted projection, so a field that must not appear on the
  page cannot appear in the markup either. Still `Article` in a `CollectionPage` + `BreadcrumbList`;
  no `Offer`, `Product` or rating type; **no `ItemList` for legs** — they are already described more
  precisely as `SportsEvent` under `about`, and `ItemList` would add an ordering claim the page does
  not make.
- Unique title and description per Acca, derived from leg count, competitions and combined odds when
  no operator summary exists. Verified against the site-wide claim guard, not a local word list.
- Sitemap: published only, one URL per Acca under its own locale, index URL only for locales with
  content, nothing while the flag is off, no filtered or paginated variants.

## 11. Accessibility changes

One `<h1>`; every section `aria-labelledby` its own `<h2>`; real `<table>` with `sr-only` caption,
`<th scope="col">` and `<th scope="row">`; native `<details>` disclosures rather than ARIA
reimplementations; native `<button>` share controls with one polite `role="status"` region covering
every outcome including a refused clipboard; a read-only (not disabled) labelled fallback input;
named `<nav aria-label>` landmarks with `aria-current`; every state expressed in words, never colour
alone; `focus-visible` rings throughout; no animation introduced, so nothing for reduced-motion to
suppress. Detail in `docs/accessibility.md`.

## 12. Security controls

No public API added. Publication stays behind the existing admin auth + CSRF + rate limit +
idempotency pipeline. Two enforced boundaries (which records / which fields). Draft, archived,
foreign-locale, unknown-slug and flag-off all produce the same 404 and the same metadata. Bounded,
validated query input; no request value reaches a column name or sort key. Public reads fail soft
without leaking connection strings, SQL or stack traces. Privacy-safe analytics allowlist. No
third-party script. Detail in `docs/security.md`.

## 13. Tests added

`tests/sprint24PublicAccaPages.test.ts` — **88 tests** across: publication lifecycle (8), freshness
(7), field boundary (6), index filtering/faceting/pagination (9), rendering (11), routes (5),
feature flag (3), SEO (8), analytics (5), sharing and accessibility (10), security (5), regression
(7), plus supporting cases.

No existing test was deleted, weakened or skipped. Two existing suites had call sites adapted to the
changed component and structured-data signatures (`PublicAccaDetailView({ view })` rather than
`({ acca })`); **every assertion in them is unchanged**.

## 14. Exact verification commands executed

```
npm test                                   # before any change (baseline)
npm run typecheck
npm run lint
node --require ./scripts/mock-server-only.cjs --import tsx --test tests/sprint24PublicAccaPages.test.ts
node --require ./scripts/mock-server-only.cjs --import tsx --test tests/accaEndToEnd.test.ts tests/accaPublicPages.test.ts tests/accaSprintIsolation.test.ts
npm test
node scripts/security-scan.mjs
node scripts/scan-client-cta-boundary.mjs
npm run routes:inventory
SITE_URL=https://rankwagers.com npm run build       # from C:\Users\Administrator\Desktop\aff-site
```

## 15. Results

| Gate | Result |
|---|---|
| Baseline full suite (before changes) | **1226 / 1226 PASS** |
| Sprint 24 suite | **88 / 88 PASS** |
| Acca public + E2E + isolation suites | **49 / 49 PASS** |
| Full suite (after changes) | **1479 / 1479 PASS, 0 fail** |
| Typecheck (`tsc --noEmit`) | **PASS** |
| Lint (`next lint`) | **PASS** — no warnings or errors |
| Security scan | **PASS** — `{"ok":true,"scanned":988}` |
| CTA client boundary | **PASS** — `{"ok":true,"findings":[],"scanned":946,"clientChunksScanned":131}` |
| Route inventory | **PASS** — `{"ok":true,"count":163}`; both public Acca routes listed |
| Production build | **PASS** — compiled, 6738 static pages, both Acca routes present, exit 0 |
| Acca sitemap shard at build | `<urlset>` empty — correct, nothing is published locally |

**Build environment note, stated because it cost real time.** `npm run build` **fails** when run
from `C:\Users\Administrator\desktop\aff-site` (lowercase `desktop`) with
`TypeError: Cannot read properties of null (reading 'useContext')` on `/`, `/404`, `/500`,
`/_not-found` and `/not-available`. The true on-disk directory is `Desktop`; the mixed casing makes
Node resolve two copies of React (the stack traces interleave `\Desktop\` and `\desktop\` paths),
and the failing chunk contains no application code — only Next's own error boundary. Running the
identical build from `C:\Users\Administrator\Desktop\aff-site` **passes**. This is a workstation
path-casing issue, not a code defect, and it is unrelated to this sprint.

## 16. Known limitations

1. **Settlement is not supported.** No `AccaRecord` carries a result, so no public Acca page states
   an outcome. The page says so and points at `/{locale}/archive`. Adding settled Acca history needs
   a real settlement write-back, which is a separate sprint.
2. **The generation methodology version is not recorded on the snapshot.** The page states the
   publication format version and says the methodology version is not recorded, linking to
   `/methodology`, rather than presenting one as the other.
3. **The index scans at most 200 published rows per locale.** State and competition are derived, not
   stored columns, so filtering them in the store would break adapter parity or need a schema
   change. The page says when it truncated. Revisit if a locale approaches the bound.
4. **Store ordering is `createdAt DESC`, not `publishedAt DESC`.** Unchanged from Sprint 20B-B and
   identical across both adapters. For records published shortly after creation the two agree; a
   long-held draft would sort by when it was created.
5. **No per-Acca Open Graph image.** The existing branded site image is used. Dynamic OG generation
   has no foundation in this repository and would be a sprint of its own.
6. **PostgreSQL remains unexecuted.** Unchanged from Sprint 20B-B: the adapter and migration exist
   and are structurally tested; nothing in this repository has run against a real server. Public
   pages were exercised against the memory adapter only.
7. **Per-request memoisation is process-local** (a `Map` released in `finally`). It deduplicates the
   `generateMetadata`/render pair of one request and is not, and must not become, a cache.
8. **No staging or production deployment**, and no credentials were requested.

## 17. Possible merge-conflict files (parallel Sprints 21/22/23)

| File | Why |
|---|---|
| `lib/analytics/types.ts` | Shared closed event union. Sprint 21/22/23 events were appended during this session; the Sprint 24 block was added at the end of the array and touches no other line. |
| `lib/config/featureFlags.ts` | Shared flag registry. One field, one default and one `parseBool` entry added; no existing flag touched. |
| `docs/analytics-tracking-plan.md`, `docs/security.md`, `docs/accessibility.md`, `docs/architecture.md`, `docs/design-system.md`, `docs/feature-flags.md`, `docs/seo-indexability-rules.md` | Shared docs; new sections appended, existing sections unedited. |
| `docs/route-inventory.generated.md` | Regenerated artifact — re-run `npm run routes:inventory` after merging. |
| `app/sitemap.ts` | **Not modified** by this sprint, but shared. |

## 18. Integration notes for Sprints 21, 22 and 23

**Nothing from those sprints was imported, referenced or stubbed.** No speculative compatibility
layer was created for any of them.

**Sprint 21 — Evidence-Aware Operator CTA Layer.** Public Acca pages carry **no** affiliate CTA, no
`/go` link, no operator card and no `rel="sponsored"`, and a test enforces that. The integration
point when Sprint 21 is ready is a single slot in `PublicAccaDetailView` between the "Is this still
current?" and "Limitations" sections. Two constraints from this sprint that a CTA must respect: the
odds shown are a publication snapshot and are never re-fetched, so a CTA must not imply the price is
live; and the availability state (`ACTIVE` / `PARTIALLY_STARTED` / `EXPIRED`) already exists in
`freshness.ts` and should gate whether a CTA is offered at all. Operator ranking,
`OperatorEvidenceCard`, affiliate components, `/go` routing, operator analytics and operator feature
flags were **not touched**.

**Sprint 22 — Live Match Intelligence.** Not touched. A published Acca is a pre-kick-off snapshot
and is deliberately never joined to live state; `freshness.ts` derives everything from stored
kick-off times and the server clock, and **invents no polling**. If live data later becomes
available, the honest integration is a clearly separated "current" panel beside the immutable
published snapshot — never a rewrite of the published values. Live domain, timeline, events,
momentum and statistics were not read or modified.

**Sprint 23 — Evidence Archive & Prediction Validation.** Not touched. Settlement is reported as
`NOT_RECORDED` in exactly one place (`freshness.ts`), which is the single point that must change
when real settlement data exists — extend the `AccaSettlementState` union and every exhaustive
switch will demand handling. The Evidence Archive schema, Evidence Snapshot schema and the
prediction validation lifecycle were not read or modified. Public Acca pages link to
`/{locale}/archive` by URL only.

**Homepage and shared navigation.** `lib/navigation/primaryNav.ts` was **not modified**; the
existing single "Published Accas" entry is unchanged. The homepage integration remains the
self-hiding `HomepagePublishedAccas` section — `RankWagersHome` is untouched and no props were
threaded into it.

**Decision Ledger (Sprint 26).** Remains paused and is loaded by nothing on this surface; the
existing isolation probe still proves it.

## 19. Diff summary

This repository is **not a git repository** (`git` is unavailable on this workstation and
`AGENTS.md` records that), so no `git diff` could be produced. The equivalent, verified by file
inspection:

```
 11 files created   (6 lib modules, 5 components)
 14 files modified  (3 lib, 4 components, 2 routes, 3 tests, 2 shared registries)
  1 test file added (88 tests)
  9 docs updated + 1 doc created
  0 files deleted
  0 database migrations
  0 API routes added or changed
  0 changes to operator, affiliate, live-match or evidence-archive code
```

## 20. Stop

Sprint 24 (public Acca pages & shareable Accas) is complete on localhost and awaiting approval. No
staging cycle, no production deployment, no credentials requested. Sprint 20B remains
operator-gated: `FF_OPERATOR_APPROVAL_ENABLED` is still `false` in every environment, so nothing can
be published until an operator turns it on.
