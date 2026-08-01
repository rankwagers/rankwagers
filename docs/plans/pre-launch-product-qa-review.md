# RankWagers — Pre-Launch Product QA Review

**Type:** Final product QA. **No implementation, no code, no roadmap.** Findings only.
**Date:** 2026-08-01.
**Scope:** the public product — 34 locale pages, primary navigation, footer, shared components,
states, accessibility, visual system, performance posture.

**Method and its limits, stated honestly.** This is a static review of the shipped product surface:
routes, navigation graph, components, state boundaries, tokens, and flags. It is **not** a visual or
device review — nothing here was rendered in a browser, tested on a phone, run through a screen
reader, or measured with real Web Vitals. Findings about layout, contrast, motion, touch targets and
actual load performance require that pass and are explicitly flagged where relevant. Everything
asserted below is evidenced from the repository.

**Severity scale**

| Level | Meaning |
|---|---|
| **Critical** | Would embarrass the brand or break a core journey on day one. Fix before launch. |
| **High** | Materially damages trust, comprehension or conversion. Fix before launch or accept knowingly. |
| **Medium** | Noticeable quality gap. Acceptable at launch with a plan. |
| **Low** | Polish. Post-launch. |

**Headline judgement.** The engineering substrate is unusually disciplined — claim integrity enforced
in code, no fabricated schema signals, honest empty states, a skip link, 42 live-region roles, a
documented flag model. The problems are not sloppiness. They are **accumulated product decisions that
were each locally reasonable and are collectively confusing**: four ways to reach one feature, two
"how it works" pages, three names for the same object, and a navigation shell written in English for
a thirty-language product. This is a launch-blocking IA and localisation problem, not a code-quality
problem.

---

## 1. Navigation and information architecture

### 1.1 The navigation shell is hardcoded English across ~30 locales

**Problem.** `lib/navigation/primaryNav.ts` accepts only three translated labels (`bestBetting`,
`bestCrypto`, `bonuses`). The remaining 16 items — "Today", "Acca Studio", "Published Accas", "Acca
Builder", "Combo (→ Builder)", "Qualified Fixtures", "Live Signals", "Saved", "Archive",
"Methodology", "Operators", "Markets", "Competitions", "Teams", "Seasons", "Search" — plus all three
group headings ("Research", "Bookmakers", "Browse") are English string literals. `components/Footer.tsx`
is the same: 16 of 21 labels are hardcoded, including the section headings "Explore" and "Trust &
legal".

**Why it matters.** A German, Polish or Czech visitor gets fully translated page content wrapped in an
English chrome. Navigation is the highest-frequency text in any product — it is read on every page
view. A half-translated shell reads as a machine-translated affiliate site, which is precisely the
category this product is trying to escape, and it undermines the credibility positioning that
everything else in the strategy depends on.

**Severity: Critical.** Thirty locales multiply this defect thirty times, and it is visible within one
second of the first page load.

**Suggested direction.** Treat the navigation and footer label sets as first-class dictionary content
with the same coverage guarantee as page copy. A locale missing nav strings should be a build or test
failure, not a silent English fallback.

---

### 1.2 Four navigation entries for one feature

**Problem.** The "Research" group contains `/acca` ("Acca Studio"), `/accas` ("Published Accas"),
`/acca/builder` ("Acca Builder") and `/combo` ("Combo (→ Builder)"). Two of those URLs differ by a
single trailing character.

**Why it matters.** A new visitor cannot form a mental model of what an "Acca Studio" is versus an
"Acca Builder" versus "Published Accas", and `/acca` versus `/accas` is a genuine misclick generator —
one letter apart, adjacent in the menu, entirely different destinations. Four entries also consume a
third of the primary navigation for one concept while `/how-we-rank` gets none (§1.6).

**Severity: Critical.** This is the first thing a user must understand and the first thing they will
fail to understand.

**Suggested direction.** Resolve to one entry point with internal modes, or to at most two clearly
distinguished ones (make/browse). If both a builder and a studio must exist, they should not be
sibling menu items with near-identical names. Retire `/combo` from navigation entirely (§1.3).

---

### 1.3 A developer annotation is shipped as a user-facing label

**Problem.** `primaryNav.ts:47` renders the literal menu label **"Combo (→ Builder)"**. The arrow is a
note to the team that the route redirects.

**Why it matters.** It exposes internal refactoring history in the product's most prominent UI. No
visitor knows what "→ Builder" means; it reads as either a bug or an unfinished build. On a $100M
launch this is the kind of detail a journalist screenshots.

**Severity: High** — trivial to resolve, disproportionate reputational cost.

**Suggested direction.** A redirect stub does not belong in primary navigation at all. Keep the route
for inbound-link compatibility; remove the menu entry.

---

### 1.4 A primary navigation item leads to a guaranteed-empty page

**Problem.** "Published Accas" (`/accas`) is in primary navigation. `lib/config/featureFlags.ts`
defaults `publicAccaPagesEnabled: true` and `operatorApprovalEnabled: false`, and the flag's own
documentation describes this exact state: *"backend off, public on — the current default: nothing can
be published, and the public index honestly says nothing is published."*

**Why it matters.** The empty state is honest, which is to the team's credit — but at launch a
first-time visitor clicks a top-level menu item and lands on a page that says there is nothing here.
That is a dead end reached from the most trusted surface in the product, and it teaches the visitor
that the menu is unreliable.

**Severity: Critical** at launch specifically.

**Suggested direction.** Either seed real published content before launch, or hide the entry until the
index is non-empty. Navigation entries should be conditional on having something to show.

---

### 1.5 The same destination carries different names in different places

**Problem.** Three collisions, all evidenced:

| Destination | Primary nav | Footer |
|---|---|---|
| `/operators` | "Operators" | "Bookmakers" |
| `/archive` | "Archive" | "Prediction archive" |
| `/{locale}` | "Today" | "Today's research" |

The wider terminology set is also unstable: *Acca* / *Combo* / *Accumulator*, and *Operators* /
*Bookmakers* / *Brands* (`lib/brands.ts`, `BrandListSection`) all refer to the same objects.

**Why it matters.** Inconsistent naming forces users to re-learn the product on every surface and
makes it impossible to build recall. It also fragments search: a user who learns "Bookmakers" will not
find "Operators". For a product whose entire positioning is precision and rigour, loose vocabulary is
an unusually damaging inconsistency.

**Severity: High.**

**Suggested direction.** Adopt one canonical noun per concept, apply it everywhere including URLs,
menu labels, headings, and structured data, and treat the vocabulary as a versioned product asset
rather than per-page copywriting.

---

### 1.6 `/how-we-rank` is orphaned, and duplicates `/methodology`

**Problem.** `/how-we-rank` appears in neither `primaryNav.ts` nor `Footer.tsx`. It is reachable only
by direct URL or incidental in-page link. It also overlaps substantially in purpose with
`/methodology`, which *is* linked from both.

**Why it matters.** Two problems compound. First, an unreachable page is wasted work and a hole in the
trust story — "how we rank" is exactly the page a sceptical user or a regulator looks for. Second,
having two "how this works" pages splits authority, confuses users about which is authoritative, and
creates the content duplication flagged in §4.2.

**Severity: High.**

**Suggested direction.** Decide which page is canonical for ranking methodology and which for
prediction methodology — or merge them — then give the survivor a permanent, prominent home in both
navigation surfaces.

---

### 1.7 Navigation mixes destinations with homepage anchors

**Problem.** Three menu entries are fragments, not pages: `/{locale}#fixtures` ("Qualified Fixtures"),
`/{locale}#saved` ("Saved"), and in the footer `/{locale}#verified-performance` ("Verified
performance"). All three resolve inside `components/bible/RankWagersHome.tsx` (648 lines).

**Why it matters.** From any deep page — an operator profile, a fixture, an archive day — clicking
"Saved" performs a full navigation to the homepage and jumps mid-document. The user loses their place
with no warning and no back-affordance to where they were. Anchors also cannot carry their own title,
metadata, or shareable identity, so three significant product areas have no addressable page.
Additionally, `id="fixtures"` is reused on market and operator detail views, so the same anchor name
means three different things across the product.

**Severity: High.**

**Suggested direction.** Anything important enough for primary navigation deserves its own route.
Reserve anchors for within-page jumps only.

---

### 1.8 `/today` is a dead route

**Problem.** `app/[locale]/today/page.tsx` contains only a `redirect()` to the locale home. It is
linked from nowhere, while the menu item labelled "Today" points at `/{locale}` directly.

**Why it matters.** Minor in itself, but `/today` is the single most guessable and most bookmarkable
URL for a daily-fixtures product. It currently exists, does nothing of its own, and has no identity —
the exact URL a returning user would type is a redirect with no page behind it. This connects directly
to the retention gap in §3.1.

**Severity: Medium.**

**Suggested direction.** Either make `/today` the canonical destination with its own identity, or
remove the route. Having it exist as an unlinked redirect is the worst of both.

---

### 1.9 Commercial detail pages have no global entry point

**Problem.** `/compare/[slug]` and `/reviews/[brand]` appear in neither navigation surface. They are
reachable only from operator or listing pages.

**Why it matters.** These are the highest-commercial-intent pages in the product. A user who wants to
compare two bookmakers has no discoverable path to do so from anywhere in the global chrome.

**Severity: Medium.**

**Suggested direction.** Give comparison a discoverable entry point from the Bookmakers group, even if
the individual comparison pages remain generated.

---

### 1.10 The "compact" desktop row holds ten items

**Problem.** Ten entries carry `desktopPrimary: true`, in three groups, plus a search entry and a
locale control.

**Why it matters.** Ten top-level choices exceeds what a first-time visitor can evaluate; the
practical result is that everything competes and nothing is prominent. The code comment at
`primaryNav.ts:37-40` already acknowledges the row is full and uses that as the reason to demote
Published Accas — a sign the constraint is being worked around rather than resolved.

**Severity: Medium.** **Suggested direction.** Reduce to the four or five journeys that matter and let
the rest live in grouped menus or hub pages.

---

## 2. Missing states

### 2.1 Route-level loading and error states are almost entirely absent

**Problem.** Across 34 public pages there are **two** segment `loading.tsx` files (`/seasons`,
`/teams`), one `error.tsx` at the locale root, one `not-found.tsx`, and one `global-error.tsx`.

**Why it matters.** Two consequences. First, data-heavy routes — fixtures, operator detail, search,
archive days — render nothing until their data resolves, so a slow provider produces a blank screen
rather than a skeleton. Second, with no segment error boundaries, a failure inside `/operators/[slug]`
propagates to the locale-level boundary: the user is thrown out of the operator context entirely and
loses their place, rather than seeing a scoped, recoverable error on the page they were on.

**Severity: High.** These are exactly the states that dominate perception on slow mobile connections
and during any upstream provider incident — and this product depends on multiple third-party feeds.

**Suggested direction.** Every route that awaits remote data needs both a loading representation and a
locally-scoped, recoverable error state. Prioritise fixtures, operator detail, search and archive days.

---

### 2.2 Flag-gated pages return a bare 404

**Problem.** Fifteen public routes call `notFound()`. For data-driven cases (an unknown team slug)
that is correct. For flag-gated cases — `/accas`, `/accas/[slug]`, `/combo` — a feature being switched
off renders the generic not-found page.

**Why it matters.** "This page does not exist" and "this feature is currently unavailable" are
different messages with different user responses. Serving the first for the second makes the product
look broken rather than configured, and offers the user no next step.

**Severity: Medium.**

**Suggested direction.** Distinguish *absent* from *disabled*, and give the disabled case an
explanatory state with onward navigation.

---

### 2.3 Empty states exist but coverage is unverified

**Problem.** 29 components carry empty-state language — good, and better than typical. But coverage
across all list, filter and search surfaces was not verifiable statically, and the zero-results path
for the search page and faceted filters is the highest-traffic empty state in the product.

**Why it matters.** A filter combination returning nothing, with no guidance and no way back, is the
most common dead end in any faceted product.

**Severity: Medium — requires the interactive pass.**

**Suggested direction.** Verify every filterable surface for: an explanatory message, a one-click path
to clear filters, and a suggested alternative.

---

## 3. Broken journeys and dead ends

### 3.1 Saved fixtures do not survive the user

**Problem.** `lib/research/savedFixtures.ts` persists to `localStorage` under
`rankwagers:saved-fixtures:v1`. There are no public user accounts anywhere in the product — only an
admin login. There is no sync, no export, and no reminder.

**Why it matters.** A user builds a research shortlist on their phone at lunch and it does not exist
on their laptop that evening. Clearing site data destroys it silently. The code correctly fails
quietly on quota or private mode — meaning in private browsing the save button appears to work and the
data is gone on close. "Saved" is a promise the product cannot keep, and it occupies a primary
navigation slot.

**Severity: High.** For a daily-return product this is simultaneously the biggest UX gap and, per the
growth review, the biggest growth gap.

**Suggested direction.** Either give saved state real durability and cross-device identity, or reframe
the feature honestly as a session workspace and remove it from primary navigation. The current
framing over-promises.

---

### 3.2 The saved journey terminates in a homepage fragment

**Problem.** "Saved" navigates to `/{locale}#saved`, a section of the 648-line homepage.

**Why it matters.** Combined with §3.1, the complete journey is: save an item, navigate away, click
"Saved", get a full page load of the homepage, scroll-jump to a section, and possibly find nothing
because the storage is device-scoped. Every step degrades the promise made by the save action.

**Severity: High.** **Suggested direction.** A saved workspace deserves its own route with its own
identity and empty state.

---

### 3.3 The homepage carries too many destinations

**Problem.** `RankWagersHome.tsx` is 648 lines and hosts at least three separately-navigable areas:
`#verified-performance`, `#fixtures`, `#saved`.

**Why it matters.** The homepage becomes a catch-all that must serve first-time visitors, returning
daily users, and three menu destinations simultaneously. None of those audiences gets a page designed
for them, and the page's weight is paid on every entry regardless of intent.

**Severity: Medium.** **Suggested direction.** Promote the anchored sections to routes and let the
homepage do one job.

---

## 4. Content duplication

### 4.1 Five overlapping commercial surfaces

**Problem.** `/operators`, `/best-betting-sites`, `/best-crypto-betting-sites`, `/bonuses`,
`/compare/[slug]` and `/reviews/[brand]` all present bookmaker information to a commercially-minded
visitor, with overlapping brand sets and overlapping purposes.

**Why it matters.** Users cannot tell which page answers their question, so they bounce between them.
Search engines see six competing pages for one intent and split authority across all of them. And the
review, comparison and "best" framings are the three most scrutinised page types in gambling
affiliate marketing — having all three without a clear editorial distinction invites exactly the
scrutiny the product's positioning is designed to avoid.

**Severity: High.**

**Suggested direction.** Define one canonical role per page type — directory, evaluation, offer,
comparison — and make the distinction visible to the user in the first sentence of each.

---

### 4.2 Two methodology pages

**Problem.** `/methodology` and `/how-we-rank` both explain how the product reaches its conclusions.
One is linked from both navigation surfaces; the other is orphaned (§1.6).

**Why it matters.** The trust story is the product's core asset. Splitting it across two pages, one of
them unreachable, weakens the single thing that most needs to be unambiguous.

**Severity: High.** **Suggested direction.** Consolidate, or draw a sharp and stated boundary between
ranking methodology and prediction methodology.

---

### 4.3 The two "best sites" pages share one component shell

**Problem.** `/best-betting-sites` and `/best-crypto-betting-sites` both render
`AffiliateHomeContent`, differing by a `variant` prop, a filtered brand set (`BRANDS.filter(b => b.crypto)`),
and a distinct FAQ block.

**Why it matters.** The differentiation is real and deliberate — this is better than a pure template
clone, and the crypto page's bespoke FAQ shows care. The residual risk is that the shared shell makes
the two pages structurally near-identical, which is the pattern search engines treat as a doorway set
when it is repeated at scale.

**Severity: Medium.** **Suggested direction.** Keep the shared shell; ensure each variant carries
substantial unique above-the-fold content, not only a filtered list and a different FAQ.

---

### 4.4 Anchor identifiers are reused across page types

**Problem.** `id="fixtures"` exists on the homepage, `MarketDetailView` and `OperatorDetailView`.

**Why it matters.** The same anchor name means three different things, which makes deep links
ambiguous and complicates any future in-page navigation.

**Severity: Low.** **Suggested direction.** Scope anchor names to their page type.

---

## 5. Accessibility

**Credit first.** This is stronger than the category norm: `dict.a11y.skipToContent` provides a skip
link, 42 components use `role="alert"` or `role="status"`, 11 use `aria-live`, both footer navs carry
distinct `aria-label`s, the homepage has a single `<h1>`, `TeamLogo` correctly uses `alt=""` for a
decorative image with an `onError` fallback, and raw `<img>` usage is deliberate and lint-annotated
rather than accidental.

### 5.1 Focus visibility is thin

**Problem.** Focus styling appears in `app/globals.css` (two occurrences) and `MobileNav.tsx` (one).
Across 109 client components — filters, the Acca builder, comparison controls, faceted search — there
is little evidence of explicit focus treatment.

**Why it matters.** Keyboard and switch users navigate by seeing focus. If a default outline is
suppressed by a reset or a Tailwind preflight and not replaced, complex interactive surfaces become
unusable without a mouse. The Acca builder is the most interaction-dense surface in the product and
the most likely to be affected.

**Severity: High — pending interactive verification.**

**Suggested direction.** Establish one global, high-contrast focus-visible treatment and verify a full
keyboard traversal of the builder, filters and search.

---

### 5.2 Interactive widgets need a keyboard and screen-reader pass

**Problem.** The builder, filter panels, live match views and comparison controls were not verifiable
statically for roving focus, escape handling, focus trapping in overlays, or announcement of
asynchronous updates.

**Why it matters.** Live-updating content that changes without announcement is disorienting for screen
reader users; the live-match surfaces are the highest risk here. In several jurisdictions this is also
a compliance question, not only a quality one.

**Severity: High — requires the interactive pass.**

**Suggested direction.** Screen-reader and keyboard-only walkthrough of the five most interactive
surfaces before launch.

---

### 5.3 Contrast and touch targets are unverified

**Problem.** Hardcoded values such as `text-[#53615C]` on `bg-[#FBF9F4]` (footer links) cannot be
confirmed against WCAG AA without rendering, and touch-target sizing is untested.

**Severity: Medium — requires the visual pass.**

**Suggested direction.** Automated contrast audit across rendered pages plus a mobile tap-target check.

---

## 6. Visual consistency

### 6.1 Four parallel colour systems, sometimes in one file

**Problem.** `components/Footer.tsx` alone uses arbitrary hex (`bg-[#FBF9F4]`, `text-[#53615C]`), CSS
custom properties (`var(--border-subtle)`), semantic Tailwind tokens (`text-muted-foreground`,
`text-foreground`) and brand tokens (`text-brand`, `bg-ink`). Across the component tree there are 18
distinct hardcoded hex values against 105 defined custom properties.

**Why it matters.** Every hardcoded value is a place the design system silently does not apply. Themes,
dark mode, contrast fixes and brand adjustments will each miss those 18 values, producing drift that
appears gradually and is expensive to trace. It also means no single source of truth exists for what
the brand's colours are.

**Severity: High.** Not visible on day one; compounds on every subsequent change.

**Suggested direction.** Treat any raw hex in a component as a defect. Every colour resolves through
the token layer.

---

### 6.2 Every shared link renders the same image

**Problem.** `lib/seo.ts` points every page's Open Graph and Twitter image at a single static
`/opengraph-image`. There are no per-route image handlers.

**Why it matters.** A shared fixture, an archive day, an operator review and the homepage all preview
identically. The product's most distinctive assets — a settled outcome, a calibration curve, an
odds-movement chart — have no visual representation when shared, which suppresses click-through and
removes the visual identity that makes a source recognisable in a feed.

**Severity: Medium** for launch, **High** for growth (see the organic growth review).

**Suggested direction.** Per-page-type share imagery carrying the page's actual subject.

---

### 6.3 Only one page family offers sharing

**Problem.** `AccaShareControls.tsx` is the only share affordance in the product.

**Why it matters.** Sharing is the primary legitimate route into channels this vertical cannot post to
directly. Restricting it to one page family forfeits that on every other surface.

**Severity: Medium.** **Suggested direction.** A consistent share affordance wherever a page has a
stable, quotable subject.

---

## 7. Performance risks

*Flagged as risks, not measurements — no runtime profiling was performed.*

### 7.1 More than half of all components are client components

**Problem.** 109 of 201 components carry `"use client"`.

**Why it matters.** For a content and reference product where most pages are read rather than
manipulated, this is a large hydration surface. It costs main-thread time on exactly the low-end
mobile devices most of the ~30 locales will use, and it is the most common cause of poor Interaction
to Next Paint. Interactivity is genuinely needed for the builder and live surfaces; it is unlikely to
be needed across half the tree.

**Severity: High — pending measurement.**

**Suggested direction.** Audit which client components exist for genuine interactivity versus
convenience, and measure INP on a mid-range Android device before launch.

---

### 7.2 Logos bypass image optimisation on the densest pages

**Problem.** `BrandLogo`, `TeamLogo` and `OperatorEvidenceCard` use raw `<img>` (deliberately, with
lint annotations). They set `loading="lazy"` and `decoding="async"` but no intrinsic `width`/`height`,
relying on container classes for sizing.

**Why it matters.** These render once per row on the highest-density pages — operator lists, fixture
lists, comparison tables. Without responsive sourcing or modern formats, payload scales with row
count; without intrinsic dimensions, layout stability depends entirely on the container, which is a
CLS risk that needs verification rather than assumption. Alt text and lazy loading are handled
correctly, so the accessibility side is fine — this is purely a weight and stability concern.

**Severity: High — pending measurement.**

**Suggested direction.** Measure CLS and transfer size on the densest list pages, and confirm the
decision to bypass optimisation is still justified at production image volumes.

---

### 7.3 The homepage is the heaviest page and the most-entered

**Problem.** A 648-line homepage component hosting three navigable areas, entered by direct visits,
"Today", "Qualified Fixtures", "Saved" and "Verified performance".

**Why it matters.** Every entry point pays for all three sections regardless of intent, and it is the
page most likely to define first-impression performance.

**Severity: Medium.** **Suggested direction.** Split by destination (§3.3); measure before and after.

---

## 8. Professional polish

| # | Problem | Why it matters | Severity | Direction |
|---|---|---|---|---|
| 8.1 | "Combo (→ Builder)" in the menu | Internal refactoring history exposed in the highest-visibility UI (§1.3) | **High** | Remove from navigation |
| 8.2 | Three names for one object (Acca / Combo / Accumulator; Operators / Bookmakers / Brands) | Undermines the precision the product's positioning claims (§1.5) | **High** | One canonical vocabulary, enforced |
| 8.3 | English chrome over translated content | Reads as a machine-translated affiliate site (§1.1) | **Critical** | Full nav and footer localisation |
| 8.4 | A menu item leading to a guaranteed-empty page | Teaches users the menu is unreliable (§1.4) | **Critical** | Seed content or hide the entry |
| 8.5 | `/today` exists but does nothing | The most guessable URL in a daily product has no identity (§1.8) | **Medium** | Make it real or remove it |
| 8.6 | Identical share preview on every page | No visual identity in any feed or message (§6.2) | **Medium** | Per-page-type imagery |
| 8.7 | Telegram CTA on every commercial page | Consistent, but every instance sends the user off-site into a channel positioned opposite to the site's own claim discipline — worth a deliberate decision, not drift | **Medium** | Resolve the positioning question first |

---

## 9. Launch judgement

**Not ready to launch as-is — but the blockers are narrow, and none is architectural.**

**Must fix before launch (Critical)**

1. Localise the navigation and footer (§1.1).
2. Resolve the four-entry Acca navigation and the `/acca` vs `/accas` collision (§1.2).
3. Remove or populate the "Published Accas" entry (§1.4).
4. Remove "Combo (→ Builder)" from navigation (§1.3, §8.1).

**Should fix before launch (High)**

5. One canonical vocabulary across nav, footer, headings and URLs (§1.5).
6. Resolve `/methodology` vs `/how-we-rank`, and link the survivor (§1.6, §4.2).
7. Loading and scoped error states for data-dependent routes (§2.1).
8. Reframe or make durable the "Saved" promise (§3.1, §3.2).
9. Give the three anchored navigation destinations real routes (§1.7).
10. Global focus-visible treatment plus a keyboard pass on the builder (§5.1, §5.2).
11. Clarify the roles of the six commercial surfaces (§4.1).
12. Measure INP and CLS on a mid-range Android device before committing to launch (§7.1, §7.2).

**Accept with a plan (Medium)** — token consolidation, per-page share imagery, `/today`, homepage
decomposition, disabled-vs-missing states, comparison discoverability.

**What is already good, and worth protecting.** Claim integrity enforced in code rather than in a
style guide. A refusal to emit fabricated structured-data signals. Honest empty states, documented as
deliberate. A skip link, live regions, correct decorative-image handling, and lint-annotated
deviations that show the team knows where it departed from the default. Sitewide SEO governance
infrastructure that most products this size do not have. These are the marks of a team that has been
careful about the hard, invisible things — which is precisely why the visible inconsistencies stand
out, and why they are worth fixing before anyone else sees them.
