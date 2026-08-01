# World-Class Visual Launch — Implementation Record

**Date:** 2026-08-01
**Scope:** Launch-blocking visual and accessibility defects on the public English surfaces. Design tokens, two layout defects, and the residual axe-core colour-contrast findings. **No** product logic, evidence, settlement, archive, PostgreSQL or provider behaviour was touched. No axe rule was disabled, relaxed or scoped away, and no node was hidden to make a scan pass.

**Status:** **DEPLOYED to production and verified live (2026-08-01, real root session).** `.next` now serves BUILD_ID `zqOf0Bo20lFW6JCSSpVs3`; axe reports **0 violation nodes on the public origin** across 7 pages × 2 viewports, Lighthouse accessibility is **100** on all six public page/preset combinations, and both layout gates pass on `https://rankwagers.com`. The 15-minute observation window closed clean. See **§11 — Deployment COMPLETE** for the authoritative record; §1–§10 are the pre-deploy history. Final verdict: **WORLD-CLASS VISUAL LAUNCH COMPLETE**.

---

## 1. Session Continuity

This record covers one piece of work spread over two sessions. The first session was cut off mid-run when SSH dropped while `/opt/rankwagers/qa-tooling/a11y.mjs` was executing. The recovery inspection that opened the second session established:

| Check | Finding |
|---|---|
| Working root | `/var/www/rankwagers`, as `root`. **Not a git repository** — no `.git`, so state was reconstructed from mtimes and the `/opt/rankwagers/previous/rankwagers-20260728-103354` snapshot. |
| Concurrent writers | None. The disconnected session (PID 120902, pts/1) was idle with no open handles under the repo; the only repo file held open was PM2's own log. |
| Last edit before the drop | Saved. `components/homepage/HomepageAccaEntry.tsx` (14:31:42) already carried `text-brand underline`. |
| Interrupted a11y run | Did **not** complete. `a11y.mjs` writes only to stdout, so its output died with the connection and the scan was re-run from scratch. |
| Production | Healthy throughout (`:3000` → 200), `.next/BUILD_ID` unchanged at `7OwjZJxJ1_7t6Y03u2Xa5`. |

Nothing was reverted and no completed work was redone.

---

## 2. A Build Hazard Worth Recording

`package.json`'s `build` script is:

```
node scripts/prepare-dev.mjs && node -e "...rmSync('.next'...)" && next build
```

The `rmSync('.next')` is **unconditional** and ignores `NEXT_DIST_DIR`. PM2 `aff-site` runs `next start -p 3000` from `/var/www/rankwagers` with no `NEXT_DIST_DIR`, so it serves `.next` directly. Running `npm run build` on this host therefore deletes the live production build out from under the running server and keeps it down for the duration of the rebuild.

Every candidate build in this work used `NEXT_DIST_DIR=.next-candidate ./node_modules/.bin/next build` instead, which honours `next.config.js`'s `distDir: process.env.NEXT_DIST_DIR || ".next"` and leaves `.next` untouched. The production-build gate used `npm run build:verify`, which the repo already provides for exactly this reason: it builds into `.next-build` and never touches `.next`.

Two incidental traps hit along the way, both recorded so they are not re-hit:

- `pkill -f "next start -p 3001"` matches the *invoking shell's own* command line and kills it before the build starts.
- A foreground `cd` into `/opt/rankwagers/qa-tooling` persists across commands; a later bare `npx next build` then resolved no local Next, tried to fetch `next@16.2.12`, and failed on "Couldn't find any `pages` or `app` directory". Builds must use an explicit `cd /var/www/rankwagers` and `./node_modules/.bin/next`.

---

## 3. Accessibility — What Was Actually Wrong

The starting point for this session was 18 axe-core violation nodes (9 on `/en` at each of 1280 and 390). Every other audited page was already clean. Fixing those exposed two further defect classes that axe structurally cannot report.

### 3.1 The locked teaser's `vs` separator — 18 nodes

`UpcomingLockedRow` renders team names inside a lock treatment (`blur-[2px] opacity-70`). The separator carried `text-muted-foreground` **on top of** that 70% opacity, resolving to `#919893` on the card — **2.8:1**.

Raising the opacity would have cleared the checker while leaving the text exactly as unreadable, so the fix does not touch the lock. The separator now inherits the row's foreground ink (**5.81:1** through the same opacity) and is subordinated by `font-normal` instead of by colour. The blur is product behaviour and is unchanged.

### 3.2 Disabled controls — invisible to axe

WCAG 2.1 SC 1.4.3 **exempts inactive user-interface components**, so axe reports nothing here no matter how bad it is. Measuring the rendered controls directly (`qa-tooling/disabledprobe.mjs`) found the six Acca panel controls and the fixture-explorer pager at **2.39:1** — the "off" state was legible, the label was not.

`--opacity-disabled` went from `0.45` to `0.60` (**4.16:1** measured after the change), and the fifteen hand-written `disabled:opacity-40|50|60` literals across six components were routed to that one token, per spec §20.1. 4.16:1 clears the 3:1 UI-component bar with margin and stays far from the ~15.6:1 of an enabled control, so "disabled" still reads as disabled at a glance. It is deliberately **not** pushed to 4.5:1: 1.4.3 does not require it, and the further the dimming is walked back the less the state communicates.

### 3.3 Live-feed status badge — the intermittent node

One `color-contrast` node on `/en` at 390 (`.bg-brand/25`) appeared on one scan and vanished on the next. The badge picks one of five class pairings from **live feed data**, so axe only ever sees whichever variant the feed is serving at scan time. A green run proved nothing.

All five variants were therefore measured deterministically by mounting them into the real page against the real card surface (`qa-tooling/badgeprobe.mjs`):

| Variant | Before | | After |
|---|---|---|---|
| `won` | `--green-surface` + `text-brand` | 5.73:1 ✅ | unchanged |
| `win_pending` / `live` | `--amber-surface` + `--amber-primary` | 4.75:1 ✅ | unchanged |
| `isNew` | `bg-brand/25` + `text-brand-light` | **3.47:1 ❌** | 5.73:1 ✅ |
| `featured` | `bg-brand/15` + `text-brand-light` | **4.06:1 ❌** | 5.73:1 ✅ |

The scan had caught `isNew`. **`featured` was a second, latent failure** that would have surfaced on a different data day. Both now use the pairing `won` already shipped.

That exposed the general rule: **`text-brand-light` (`--green-positive`) fails on every alpha-tinted brand fill; `text-brand` (`--green-primary`) passes on all of them.** A sweep found seven such sites, all fixed by the one-token swap:

`LiveFeedPanel` (×3, incl. a hover state), `Methodology`, `CopyCode`, `AgeVerificationGate`, `app/admin/traffic`. Measured after: 4.57:1 on `/20`, 5.33:1 on `/10`. Standalone `text-brand-light` on plain surfaces passes at 5.07:1 and was left alone.

While fixing the badge it emerged that `ring-brand/50` and `ring-brand/35` set only `--tw-ring-color`; with no width utility they computed to `box-shadow: none` and had never rendered. Since both brand badges now share a fill, `ring-1` was supplied so the ring actually carries the new-vs-featured distinction.

The `--green-surface-strong` residual noted in `globals.css` is **stale**: that token exists in no stylesheet and is referenced by no component. The comment is the only occurrence.

### 3.4 Colour-only links

WCAG 1.4.1 is not an axe rule. `qa-tooling/coloronlylinks.mjs` checks every anchor with sibling text for a non-colour affordance in the resting state, across nine pages. The one known instance (`HomepageAccaEntry`) had been fixed before the disconnect; the sweep confirms **zero** remaining.

---

## 4. Desktop Header Clipping

The primary nav is `min-w-0 overflow-hidden`. `min-w-0` is what stops the row painting over the search box; `overflow-hidden` is only a backstop, and a backstop that engages means an entry is being cut off.

`qa-tooling/layout-gates.mjs` Gate A asserts, on 7 pages × 1280/1440/1920, that the nav's `scrollWidth` fits its `clientWidth`, that no entry's right edge escapes the nav box, and that the nav never overlaps the controls to its right. **21/21 pass**, `scrollWidth == clientWidth` exactly on every combination, five entries rendered throughout.

---

## 5. Mobile Acca Pill Over the Proof Band

This one was **not** fixed by the earlier work, and the earlier check would have reported a false pass.

The launcher had been made to hide when the slip is empty and nothing is saved. That addresses the *first visit* only. Once a selection exists — the ordinary case — the launcher mounts, and being `fixed` it passes over the proof band again on scroll. Re-measured with a seeded selection: **98×48px of the WON card** at 390×844, 360×780 and 414×896.

A gate that scans a first-visit homepage finds no pill and passes vacuously, so Gate B **asserts the pill is present before it sweeps**, and separately asserts the pill is visible at some offset so the gate cannot pass by the launcher being permanently hidden.

The fix follows the intent already documented in `AccaChrome`: emptiness was never the real condition, *sitting over the settled record* was. The launcher now yields whenever its own footprint intersects the figures, at every scroll position. Three things were needed to make that correct:

1. **Yield by opacity, not unmount.** An unmounted pill has a zero rect, reads as "no overlap", and oscillates. `pointer-events-none` + `aria-hidden` + `tabIndex={-1}` remove it from pointer, screen-reader and keyboard reach together, so nothing invisible stays focusable.
2. **Resolve the band per measurement.** The homepage fails hydration (React #418/#423, pre-existing — see §7), and on that path React discards the server DOM and rebuilds it. A node captured once at effect time is then **detached**, and a detached node's rect is all zeros — which is why the first attempt never fired.
3. **Watch for reflow, not just scroll.** Scroll and resize alone left a stale result at rest: the homepage still shifts after mount (CLS 0.331 desktop), so the band slides under a launcher that measured clear a moment earlier. Reproduced as a 98×31px overlap at scrollY=0. A `ResizeObserver` on `document.body` plus a `load` listener closes it.

The target is the `<dl>` of figures (`#verified-performance-figures`, added for this purpose), **not** the enclosing `#verified-performance` section — that section also carries recent-results and measures ~2260px at 390 wide, so yielding to it would blank the launcher for most of the page.

**Gate B: 9/9 pass** — zero intersection across 188/200/183 scroll offsets at the three viewports, with the launcher confirmed present and confirmed reachable.

---

## 6. Files Changed

| File | Change |
|---|---|
| `app/globals.css` | `--opacity-disabled` 0.45 → 0.60, with the measurement rationale. |
| `components/predictions/LiveFeedParts.tsx` | Locked-teaser `vs` separator: weight-based subordination instead of colour. |
| `components/predictions/LiveFeedPanel.tsx` | Two badge variants re-pointed to the measured green pairing; `ring-1` added so the ring renders; three `text-brand-light` → `text-brand` on brand tints. |
| `components/acca/AccaChrome.tsx` | Launcher yields while it overlaps the proof-band figures. |
| `components/bible/RankWagersHome.tsx` | `id="verified-performance-figures"` on the figures `<dl>`. |
| `components/Methodology.tsx`, `components/CopyCode.tsx`, `components/AgeVerificationGate.tsx`, `app/admin/traffic/page.tsx` | `text-brand-light` → `text-brand` on brand-tinted fills. |
| `components/acca/AccaPanelBody.tsx`, `components/bible/BibleFixtureExplorer.tsx`, `components/combo/ComboSelectionCard.tsx`, `components/acca-publication/AccaLifecycleActions.tsx`, `components/builder-approval/CandidateActions.tsx` | 15 disabled-opacity literals → `--opacity-disabled`. |

New QA tooling under `/opt/rankwagers/qa-tooling/`: `ccdetail.mjs`, `disabledprobe.mjs`, `coloronlylinks.mjs`, `badgeprobe.mjs`, `layout-gates.mjs`. `lh.mjs` restored to its three-page set so the run is comparable to the earlier baseline.

---

## 7. Known Pre-Existing Issues — Not Introduced, Not Fixed

- **Hydration failure on every page.** React #418 (`Hydration failed`) and #423 (`entire root will switch to client rendering`), 16 page errors per page across all four viewports. **Identical count in the 20260801T132033Z baseline**, so this predates the work and is unchanged by it. It is what made the naive band lookup fail in §5. Worth its own investigation; out of scope here.
- **Homepage CLS 0.331 desktop** and **TBT 560ms desktop / 4,190ms mobile.** Pre-existing; the mobile TBT in particular keeps homepage performance in the 50s.
- **Dead gradient classes** in `UpcomingLockedRow`: `from-ink/90 via-ink/50 to-transparent` with no `bg-gradient-*` utility, and the `ink` colour aliases were retired per `tailwind.config.ts`. The locked card's scrim therefore does not render. Left alone deliberately — fixing it changes the locked card's appearance and needs a visual decision, not an accessibility one.

---

## 8. Gate Results

All against the candidate preview at `127.0.0.1:3001` serving `.next-candidate`.

| Gate | Result |
|---|---|
| axe-core, 7 pages × 1280/390 | **0 violation nodes** (from 18) |
| Badge variants, all 5 measured | **5/5 pass** (2 were failing) |
| Brand-tint pairings, 11 measured | **11/11 pass** (7 were failing) |
| Disabled controls | **7/7 pass** at 4.16:1 (were 2.39:1) |
| Colour-only in-paragraph links, 9 pages | **0** |
| Gate A — header clipping, 21 combinations | **21/21 pass** |
| Gate B — Acca pill vs proof band, 3 viewports | **9/9 pass** |
| Lighthouse **accessibility** | **100** on all 3 pages × desktop/mobile (was 94 / 93 on home) |
| Screenshots, 7 pages × 4 viewports | captured, no overflow, min font 11px, page-error count identical to baseline |
| `npm run typecheck` | **pass** |
| `npm run lint` | **pass** — no warnings or errors |
| `npm test` | **pass** — 1917 tests, 1916 passed, 1 skipped, 0 failed |
| `npm run build:verify` (production build) | **pass** — exit 0, built into `.next-build`; `.next/BUILD_ID` still `7OwjZJxJ1_7t6Y03u2Xa5` and `:3000` still 200 |

Lighthouse **performance** is unchanged to slightly noisier: home 55→56 desktop and 56→56 mobile; archive 88→81 desktop; operator-detail 88→85 desktop. These are single unrepeated runs on a host that was concurrently building, and no performance work was done in either direction. They are reported as measured rather than smoothed.

Artifacts: `/opt/rankwagers/qa/20260801T185117Z/{preview,lighthouse}`. Prior baselines under `20260801T110313Z`, `20260801T125429Z`, `20260801T132033Z` and the rollback snapshot `/opt/rankwagers/rollback/visual-20260801T103640Z` are preserved untouched.

---

## 9. Deploy Plan — Held for Approval

Production PM2 `aff-site` runs `next start -p 3000`, cwd `/var/www/rankwagers`, no `NEXT_DIST_DIR`, therefore serving `.next`. `/opt/rankwagers/current` does not exist and the `releases/` layout in `deploy/release-deploy.sh` is not in use on this host. The deploy is a directory swap, matching the existing `.next-prev-20260801T061648Z` convention:

1. `mv .next .next-prev-<UTC timestamp>` — the rollback point.
2. `mv .next-candidate .next`.
3. `pm2 reload aff-site` — **root PM2, that app only.** `aff-panel`, `telegram-eng` and `telegram-invite` are not touched.
4. Public verification, then public screenshots, then a 15-minute observation window.

Rollback is the inverse swap plus a second reload, and `/opt/rankwagers/rollback/visual-20260801T103640Z` retains the pre-work `.next` artifact, PM2 dump and `package.json`.

Steps 1–3 are irreversible in the sense that matters — they change what the public sees — so they are **not** executed without explicit approval.

---

## 10. Outstanding

Every mandatory gate has passed. The last source change was 18:37:48; every gate in §8 ran after it, against this exact source, so none was repeated for its own sake.

Held for explicit approval, and **not** claimed as done:

- The `.next` swap and `pm2 reload aff-site`.
- Public verification and public screenshots (`https://rankwagers.com`).
- The 15-minute production observation window.

*(Superseded by §11 — all three were subsequently authorised and executed.)*

---

## 11. Deployment — COMPLETE

Executed 2026-08-01 19:11:15Z as root, exactly as planned in §9.

```
mv .next .next-prev-20260801T191115Z     # rollback point, BUILD_ID 7OwjZJxJ1_7t6Y03u2Xa5
mv .next-candidate .next                 # promoted,       BUILD_ID zqOf0Bo20lFW6JCSSpVs3
pm2 reload aff-site                      # root PM2, that app only
```

### 11.1 Mandatory post-deploy gates

| # | Gate | Result |
|---|---|---|
| 1 | `aff-site` online | ✅ online, restart 5 → 6 (the reload itself), pid 189458 |
| 2 | Port 3000 ownership | ✅ pid 189458 owns `*:3000` |
| 3 | Homepage | ✅ 200 local and public |
| 4 | `/sitemap.xml` | ✅ **200 `application/xml; charset=utf-8`**, 792 bytes |
| 5 | Core public pages | ✅ 9/9 local, 8/8 public — archive, methodology, operators, operator detail, how-we-rank, fixture detail, acca, robots.txt |
| 6 | No crash loop | ✅ restart count constant at 6 across the full window; 0 `"level":"error"` entries all day |
| 7 | No secret leakage | ✅ homepage HTML + 12 first-party JS bundles scanned for DB URLs, private keys, bot tokens, session/admin secrets — no match |
| 8 | PostgreSQL persistence active | ✅ both URLs up on `rankwagers`; `odds_history` **65,078 → 66,890 rows during the window** — actively writing, not merely reachable |
| 9 | Raw provider archive unchanged | ✅ `/opt/rankwagers/shared/evidence-archive` absent before **and** after — the archive ships dormant and stayed dormant |
| 10 | Other PM2 apps untouched | ✅ `aff-panel`, `telegram-eng`, `telegram-invite` — restarts 0, uptime unbroken at 4649m |

### 11.2 New build confirmed genuinely public

Not inferred from a 200. `https://rankwagers.com/en` serves `"buildId":"zqOf0Bo20lFW6JCSSpVs3"` and contains `verified-performance-figures` — the id introduced by this work, which cannot exist in the previous build.

### 11.3 Public verification

- **axe-core, 7 pages × 1280/390 against `https://rankwagers.com`: 0 violation nodes.**
- **Lighthouse accessibility 100** on home / archive / operator-detail × desktop / mobile.
- **Gate A 21/21** and **Gate B 9/9** on the public origin.
- Public screenshots (`qa/20260801T185117Z/public-after`) match the isolated preview exactly on status, page-error and console-error counts across all 7 pages × 4 viewports.

Public Lighthouse performance: home 58 desktop / 54 mobile, archive 81 / 66, operator-detail 84 / 66. Unchanged in character from the pre-existing baseline; no performance work was done in either direction.

### 11.4 Observation window

30 samples at 30s intervals, 19:17:22Z → 19:33:35Z (16m13s). Home, `/sitemap.xml` and archive returned **200 on every sample**; zero non-200. PM2 `online` and restart count 6 throughout. RSS 442MB, stable.

The only entries in the aff-site error log during the window are `provider_retry … rate_limited` warnings from the footystats provider — **1400 of them logged before the deploy versus 42 after**, so they are pre-existing background noise, not a deployment effect. No non-provider entry appeared after the reload.

### 11.5 Rollback

Not needed; no gate failed. The rollback point is retained at `.next-prev-20260801T191115Z` (BUILD_ID `7OwjZJxJ1_7t6Y03u2Xa5`). Rollback is the inverse swap plus one `pm2 reload aff-site`. `/opt/rankwagers/rollback/visual-20260801T103640Z` additionally retains the pre-work artifact, PM2 dump and `package.json`. All QA artifacts from every stage are preserved.

### 11.6 Carried forward

The pre-existing items in §7 are unchanged and remain open: the hydration failure on every page (React #418/#423, identical 16 errors/page before and after), homepage CLS/TBT, and the dead gradient classes on the locked card. None was introduced by this work and none blocks the launch.

---

## 12. Incident correction — 2026-08-01: today-path same-day archive fallback

**Type:** production functional fix. Scope: today's daily-list source selection only.

### 12.1 Root cause

Not the visual deploy. FootyStats became unavailable at ~19:21Z; the circuit breaker opened.
`getDailyMatchListsForDate` served today from `unstable_cache(fetchDailyListsUncached)` and, on
provider failure, `executeProviderCallSoft` returned `null`, `raw?.data ?? []` produced an empty day,
and every downstream stage — normalized, qualified, top picks, live matches, Live Signals — became 0.

A valid same-day archive holding 132 fixtures existed on disk the entire time (`savedAt`
19:21:39Z). Today's branch never reads it; only past dates do. That logic is **byte-identical in
`.next` and `.next-prev-20260801T191115Z`**, so the deploy neither caused the outage nor could a
rollback have fixed it. The deploy's only contribution was the 19:11:15Z restart, which cleared the
warm `unstable_cache` that had been masking the outage on the pre-existing process (PID 181456,
port 3001, still serving 132 from a pre-outage entry).

The defect: a provider failure and a genuinely empty day were indistinguishable, so the system could
not tell "substitute the archive" from "publish an empty day".

### 12.2 Files changed

| File | Change |
|---|---|
| `lib/footystats/types.ts` | `DailyListsSource`, `DailyListsProvenance`; optional `provenance` on `DailyMatchLists` |
| `lib/footystats/archiveFallback.ts` | **new** — acceptance rules, bounded rejection codes, local strict read, provenance builder |
| `lib/footystats/servingState.ts` | **new** — in-process `serving_fresh` / `serving_stale` / `unavailable` |
| `lib/footystats/client.ts` | `fetchJsonResult` surfaces the failure code; failure returns `unavailable` and does **not** write the archive; today-branch fallback |
| `lib/footystats/dailyArchive.ts` | exported `dailyArchiveDir()` |
| `lib/monitoring/health.ts` | `daily_lists` check; `providers` reports `degraded` (not `fail`) while stale is served |
| `app/api/live-feed/route.ts` | stale serving builds the feed from no rows |
| `components/bible/RankWagersHome.tsx` | stale notice above the affected list |
| `lib/translations/predictionsEn.ts` | `staleArchiveNotice` |
| `tests/todayArchiveFallback.test.ts` | **new** — 33 tests |

### 12.3 Fallback contract

- **Past date** — unchanged: archive first, no provider call.
- **Today + success** — fresh response used, normalization/qualification unchanged, archive written
  exactly as before, `source: fresh_provider`.
- **Today + failure** (`circuit_open`, `timeout`, `network`, `upstream_5xx`, `unavailable`,
  `quota_exhausted`, `rate_limited`, `unknown`) — same-day archive becomes the raw source and flows
  through the existing pipeline; `source: stale_daily_archive`.
- **Today + successful EMPTY response** — preserved as fresh. An empty day is a fact and is never
  replaced.
- **Fail closed** only when the provider failed **and** no valid same-day archive exists.

The failure marker stays inside the 300s cache, so the provider is not re-hit any harder than
before; the archive read sits outside it and picks up a recovery capture immediately.

### 12.4 Archive validation

Accepted only if: file exists · JSON parses · `archive.date` equals the requested date · at least one
row with a positive integer `matchId` and two named teams. Rejected as `absent`, `unreadable`
(malformed, truncated, empty, wrong root type, IO fault), `date_mismatch`, `no_valid_fixture`.

Provenance is bounded and secret-free: `source`, `requestedDate`, `archiveCapturedAt`,
`archiveAgeSeconds`, `providerFailureReasonCode`. No key, URL, credential or payload.

### 12.5 Results

- Focused: **33/33**. Full suite: **1950 pass, 0 fail** (floor 1917). Typecheck exit 0. Lint clean.
- M10 Stage 2E Slice 3's zero-production-caller invariant on the dormant strict reader was
  **preserved**, not weakened: the ~15-line strict read is restated locally so an emergency hotfix
  does not activate a component another milestone holds dormant.
- **Isolated proof** against the real `2026-08-01` archive, zero provider calls, across five failure
  codes: raw rows **263**, unique fixtures **132**, qualified **263**, top picks **6**,
  `source: stale_daily_archive`, provenance bounded.

### 12.6 Production state

| | Before (19:42Z) | After provider recovery (20:07Z) |
|---|---|---|
| Qualified | 0 | 132 |
| Top picks | 0 | 18 |
| `/en` bytes | 175,885 | 449,390 |
| Providers | `fail :: unavailable` | `degraded` |

The provider recovered on its own at ~20:02Z, exactly as the incident report predicted. The outage is
over; the fix prevents the next one.

### 12.7 Not deployed — blocked, then held by decision

**Decision 2026-08-01:** hold. Code lands on disk undeployed; production had already recovered, so
the fallback is scheduled for the next planned release rather than an incident-window reload. No
`.next` swap, no `pm2 reload`, no process was touched. The orphan QA process (PID 181456, port 3001)
was left running — its cleanup was gated on verifying the production fix, which did not occur.


The fix is **not in production**. `npm run build` cannot run as `rankdev`: `scripts/prepare-dev.mjs`
reads `.env.local` → `/opt/rankwagers/shared/.env` (root `0600`) → `EACCES`. The `.next` swap and
`pm2 reload` are root-owned. Deploy requires an operator.

**Hazard for whoever deploys:** `npm run build` runs
`rmSync('.next', {recursive:true, force:true})` **before** building, and `NEXT_DIST_DIR` does not
redirect it. Run on this host it deletes the live build before producing a replacement. Build to a
staging directory and swap, or accept a serving gap. On 2026-08-01 it aborted at the env read before
reaching the delete; `.next` (`zqOf0Bo20lFW6JCSSpVs3`) was verified intact afterwards.

### 12.8 Rollback path

Unchanged: `.next-prev-20260801T191115Z` (BUILD_ID `7OwjZJxJ1_7t6Y03u2Xa5`), inverse swap plus one
`pm2 reload aff-site`. This change is additive and flag-free; reverting the ten files above restores
the prior behaviour exactly, and no data written under it needs migration — `provenance` is optional
and ignored by every existing consumer.
