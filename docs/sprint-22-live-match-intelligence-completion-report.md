# Sprint 22 — Live Match Intelligence — completion report

> Filename note: the repository already contains `docs/sprint-22-completion-report.md` (SEO
> Intelligence) from an earlier numbering scheme. This sprint is filed under its own name to
> avoid overwriting it.

Goal: turn RankWagers from a static football intelligence platform into a **live** one, by
introducing a reusable Live Match layer. No affiliate functionality, no operator changes, no
CTA changes.

## Files added

**Contracts**
- `types/live/index.ts`

**Domain (`lib/live/`)**
- `status.ts` — `LiveMatchStatus`
- `events.ts` — `LiveEvents`
- `timeline.ts` — `LiveTimeline`
- `momentum.ts` — `LiveMomentum`
- `statistics.ts` — `LiveStatistics`
- `snapshot.ts`, `adapter.ts`, `diff.ts`, `store.ts`, `context.ts`, `announce.ts`,
  `analytics.ts`, `paths.ts`, `rateLimit.ts`, `server.ts`

**Components (`components/live/`)**
- `LiveMatchHeader.tsx`, `LiveTimelineCard.tsx`, `LiveMomentumGraph.tsx`,
  `LiveEventBadge.tsx`, `LiveStatisticsTable.tsx`
- `LiveMatchSection.tsx` (server shell), `LiveMatchProvider.tsx` (hydration island),
  `LiveAnnouncer.tsx`, `LiveConnectionNotice.tsx`, `LiveSectionViewTracker.tsx`

**Route**
- `app/api/live-match/route.ts`

**Tests**
- `tests/liveMatchIntelligence.test.ts` (54), `tests/liveMatchUi.test.ts` (19)

**Docs**
- `docs/live-match-architecture.md`, `docs/live-match-component-registry.md`,
  `docs/live-match-analytics.md`, this report

## Files modified (3, all minimal)

| File | Change |
| --- | --- |
| `lib/fixtures/loadMatchPage.server.ts` | `liveMatch` added to `MatchPageBundle`, built from the already-fetched live context (no extra provider call) |
| `components/fixtures/MatchDetailView.tsx` | One import, one `<LiveMatchSection>` in the left column |
| `lib/analytics/types.ts` | Live event names — **already registered by a parallel sprint** while this sprint was in flight; the duplicate block was removed rather than left in |

## Execution order

1. Contracts → 2. pure domain modules → 3. composition + adapter → 4. diff/store/context →
5. components → 6. server shell → 7. route → 8. fixture-page wiring → 9. tests → 10. docs.

## Verification — observed results

| Command | Exit | Result |
| --- | --- | --- |
| `node --test tests/liveMatchIntelligence.test.ts tests/liveMatchUi.test.ts` | **0** | 73 tests, 73 pass, 0 fail |
| `node --test` on 5 adjacent suites (match detail, fixture presentation, analytics, CTA client boundary, trust layer boundary) | **0** | 38 tests, 38 pass, 0 fail |
| `npm run lint` | **0** | No ESLint warnings or errors |
| `npm run typecheck` | **2** | 4 errors — **all in the parallel Acca sprint**, zero in Sprint 22 files |
| `SITE_URL=… npm run build` | **1** | `✓ Compiled successfully`; type-check phase stops at `app/[locale]/accas/[slug]/page.tsx:62` — the parallel Acca sprint |

### Route-contract defect — fixed

A production build exposed `.next/types/app/api/live-match/route.ts:8:13 — Property
'LIVE_MATCH_RATE_LIMIT' is incompatible with index signature. Type 'number' is not assignable
to type 'never'.` Next validates the generated route type against a closed set of allowed
exports.

Fixed by moving `LIVE_MATCH_RATE_LIMIT` and `LIVE_MATCH_RATE_WINDOW_MS` into
`lib/live/rateLimit.ts` (following the existing `lib/combo/rateLimit.ts` /
`lib/acca-builder/rateLimit.ts` convention) behind a `rateLimitLiveMatch()` helper. The route
now exports only `GET`, `dynamic` and `revalidate`. `tests/liveMatchUi.test.ts` gained a
source-level guard enumerating the allowed route exports, because a source-only typecheck does
not catch this class of defect.

Confirmed cleared: the rebuild compiles successfully and the type-check phase no longer
reports the live-match route.

### Blocking defect in another sprint — not touched

`app/[locale]/accas/[slug]/page.tsx:62`, `app/[locale]/accas/page.tsx:62`,
`components/acca-publication/PublicAccaDetailView.tsx:480`,
`components/homepage/HomepagePublishedAccas.tsx:43` — the Acca publication components were
migrated from an `acca: AccaRecord` prop to a `view: PublicAccaView` prop, and the call sites
still pass the old prop. The same defect causes 5 runtime test failures
(`TypeError: Cannot read properties of undefined (reading 'freshness')` at
`PublicAccaCard.tsx:29`) in `accaEndToEnd.test.ts` and `accaPublicPages.test.ts`.

Not modified — a different sprint's domain. Full suite is 1319 tests, 1314 pass, 5 fail, all
five being this defect.

## Restricted-area confirmation

Nothing under operator pages, operator CTA components, affiliate routing, the ranking engine,
go links, operator analytics or operator feature flags was modified. Enforced by test, not
just by inspection:

- `tests/liveMatchIntelligence.test.ts` — no `lib/affiliate`, `lib/operators`, `lib/ranking`,
  `buildGoPath`, `signAffiliateOffers` or operator event names anywhere in `lib/live/`
- `tests/liveMatchUi.test.ts` — same for `components/live/`, plus no `outboundPath` /
  `sponsored`, plus the route contains no `affiliate|operator` string at all

## Known limitations

1. **Client re-render behaviour is verified structurally, not in a browser.** The repo has no
   DOM or React test-renderer harness. Identity preservation, slice diffing and store
   notification are proven directly (`applyLiveUpdate` returns the previous object;
   subscribers are not called on a no-op). That each component subscribes to exactly one slice
   is asserted at source level. What is *not* executed anywhere is React's bail-out itself.
2. **Provider event coverage is thin.** The current feed reports only goals and red cards as
   discrete events. Penalty, VAR, yellow card, substitution, corner and dangerous-attack
   handling is implemented and unit-tested, but will stay dormant until a feed supplies them.
   Consequence: on this feed the momentum *graph* is usually driven by goals alone.
3. **Momentum is a heuristic.** Weights (goal 30, penalty 18, corner 5, dangerous attack 3)
   are engineering judgement, not a calibrated model. This is why `method` is always printed
   and why the reading is labelled derived.
4. **Not production-verified.** No live fixture has been observed through this code path.
   Everything below "tested locally" in the completion percentages reflects that.
5. **Not integrated:** `docs/analytics-tracking-plan.md` untouched (parallel-sprint conflict
   risk); localisation — all live copy is English, matching the surrounding match page.

---

## 1. Tamamlanma yüzdesi

### Sprint bazında — **~92%**

| State | Weighted share | What |
| --- | --- | --- |
| Implemented + tested locally | ~85% | All five domain modules, all five reusable components, diff/store/context, server shell, API route, fixture wiring, 73 tests |
| Integrated into UI | included | Section renders in the real fixture page through the real loader |
| Structurally verified only | ~7% | React bail-out behaviour; polling loop (fetch/backoff/visibility paths never executed) |
| Publicly visible / production verified | 0% | No live fixture observed |

Remaining 8%: a DOM-level test harness for the re-render and polling paths, and one observed
live fixture.

### MVP bazında — **~78% → ~81%**

Live match intelligence was a named MVP gap; it moves from absent to implemented-and-wired.
Still open at MVP level: the Acca publication defect above (another sprint), the 4 external
launch blockers and 2 dark flows in `npm run launch:readiness`.

### Tüm roadmap bazında — **~63% → ~65%**

The live layer is a foundation other roadmap items depend on (live index page, live
notifications, in-play markets). It is built and reusable, but none of those consumers exist
yet, so the roadmap gain is smaller than the sprint gain.

## 2. Teknik borç listesi

### Bu sprintte ertelenenler (deferred)

1. **DOM-level render harness** — needed to execute React bail-out and the polling loop.
   Deferred because adding a test framework mid-sprint, while a parallel sprint edits shared
   test infrastructure, is a merge hazard.
2. **`docs/analytics-tracking-plan.md` integration** — deferred purely to avoid a conflict.
3. **Momentum weight calibration** — weights are unvalidated against outcomes.
4. **Second provider adapter** — the seam exists (`LiveMatchSource`); no second feed written.
5. **Localisation of live copy** — English only.
6. **`homeLogo`/`awayLogo`** are carried in the snapshot but not rendered (deliberate payload
   choice); either render them or drop them from the contract.

### Bilinçli olarak kapsam dışı bırakılanlar (deliberately out of scope)

1. **WebSockets / SSE.** Polling with backoff is correct for a 60s-revalidate provider cache;
   a socket would add infrastructure without fresher data.
2. **Server-side diffing.** Deliberately stateless — see the architecture doc.
3. **In-play odds, live CTAs, live operator surfacing.** Sprint brief: no affiliate, no
   operator, no CTA.
4. **Live index / "matches in play" page.** Layer is reusable enough to build it; not asked
   for.
5. **Mapping `cardsHome/Away` to yellow cards.** It is a combined total; mapping it would
   overstate bookings.
6. **Persisting live snapshots.** No historical live storage; out of scope and would need a
   retention decision.

## 3. Bir sonraki sprint planı

**Next: unblock the build, then harden what this sprint could only verify structurally.**

1. **Fix the Acca publication prop migration** (4 call sites, 5 failing tests). It blocks
   `npm run build` and `npm run typecheck` repository-wide, so nothing else can be verified
   end to end until it lands. It is another sprint's domain — needs an owner decision.
2. **Add a DOM test harness** and convert the two structurally-verified claims into executed
   ones: React bail-out on unchanged slices, and the polling loop's backoff / visibility /
   abort paths.
3. **Observe one real live fixture** through `/api/live-match` and record the provider's
   actual event and statistic coverage — this is the only way to know how much of the
   implemented event vocabulary is reachable in production.
4. **Then** build the live index page on top of the layer, which is where the reusability
   investment pays off.

Ordered this way because (1) is a hard build blocker, (2) and (3) close the evidence gaps this
report declares, and (4) is only worth doing once the layer is proven against a real feed.
