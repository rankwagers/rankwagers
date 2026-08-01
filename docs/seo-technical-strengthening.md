# SEO — Technical Strengthening (evidence-first, additive)

**Role:** Technical SEO Lead. **Mission:** long-term organic growth by *strengthening the existing
SEO architecture* — never inventing new systems, never doorway/mass-generated/thin pages, never
spam/shortcuts/black-hat. Every change must increase Google's trust. The product stays evidence-first.

**Scope of this record:** one implemented, verified fix + a grounded audit of the remaining focus
areas, each classified so nothing is changed unilaterally that belongs to the SEO owner's philosophy.

---

## 1. Implemented (this pass — safe, verified, in-architecture)

### FIX-1 — Sitemap `lastmod` trust: stop false hourly "just changed" churn (crawl efficiency)

**Problem (verified in code).** `contentDate()` (`lib/seo.ts`) fell back to a **per-call `new Date()`**
when `SITE_CONTENT_DATE` is unset — and that env var is **optional** in production
(`docs/production-checklist.md:10`). The sitemap runs with `export const revalidate = 3600`
(`app/sitemap.ts`), so every regeneration produced a *new* `lastmod` for **every** static/entity URL
(operators, markets, competitions, teams, seasons, countries, compare, static pages), and the home
entry used a bare `new Date()` (fresh on every request). Result: unchanged URLs advertised
`<lastmod>` = "changed this hour," every hour.

**Why it eroded trust.** Google uses `<lastmod>` to prioritise crawl. A `lastmod` that is always
"now" but whose content never changed is a **false freshness signal**; Google learns the field is
unreliable, **discounts it**, and wastes crawl budget re-fetching stable pages — while the pages that
*genuinely* change lose the signal's value. This is the exact anti-pattern `contentDate()`'s own
comment warned against, but the `new Date()` fallback (and the home-page bare `new Date()`)
reintroduced it.

**Fix (minimal, strengthens the existing mechanism — no new system).**
- `lib/seo.ts`: the fallback is now a **module-load constant** (`FALLBACK_CONTENT_DATE`), captured
  once at deploy/build, and `contentDate()` returns a *copy* of it. Stable within a running
  deployment; changes only when a new build actually ships (an honest "content may have changed at
  deploy" signal). The `SITE_CONTENT_DATE` path is unchanged — production can still pin an explicit
  content date.
- `app/sitemap.ts`: the home entry now uses the stable `staticLastModified` instead of a per-request
  `new Date()`. `changeFrequency: "daily"` already conveys the home's real cadence; the `lastmod`
  no longer over-signals.

**Preserved:** the acca-detail shard keeps its **real per-entity** `acca.publishedAt` `lastmod`
(honest, entity-accurate — not churn). Only indexable URLs are sitemapped (unchanged). No URL added
or removed; no structure changed.

**Verification:** SEO suite `sitemapIndex` + `crawlQuality` + `sprint22SeoIntelligence` = **37/37
pass**; `typecheck` exit 0; grep confirms no `lastmod` uses a per-request `new Date()`.

**Recommended companion (ops, not code):** set `SITE_CONTENT_DATE` in production to make the pinned
date explicit and auditable — now optional and safe either way.

---

## 2. Audit of the focus areas — what is already strong (leave as-is)

The architecture is mature and principled; the following are **already correct** and were confirmed
this pass — changing them would risk the philosophy, not strengthen it.

- **Crawlability / robots** (`app/robots.ts`): production allows `/`, disallows `/admin`, `/developer`,
  `/go/` (affiliate outbound), `/not-available`, `/api/`; staging blocks all. Critically, `/search`
  is **left crawlable but `noindex`** (meta), so Google can *see* the noindex — disallowing it would
  hide the directive. Correct. **No change.**
- **Sitemap eligibility** (`app/sitemap.ts`, `lib/seo-intelligence/sitemap.ts`,
  `docs/seo-indexability-rules.md`): only `decision === INDEX` **and** `sitemapEligible`; no
  filtered/paginated/`?page=1` variants; Accas one-URL-per-locale, published-only, fail-soft. Strong.
- **Canonical consistency** (`lib/seo.ts pageMetadata`, `lib/seo-intelligence/canonical.ts`): single
  locale-prefixed self-canonical per entity; audit flags `MISSING_CANONICAL` / `CANONICAL_MISMATCH` /
  `SITEMAP_INCLUDES_NON_INDEXABLE` / `QUERY_IN_PATH_RISK`. Strong.
- **Structured data** (`lib/seo-intelligence/structured-data.ts`, `lib/crawl-quality/schema.ts`):
  validated against page-type contracts; **evidence-first** — never invents ratings/odds/outcomes
  ("research is not commerce; nothing here is rated"). Strong.
- **hreflang** (`lib/seo.ts hreflangLanguages`, `lib/crawl-quality/hreflang.ts`): self-referential,
  `x-default → /en`, per-locale distinct absolute URLs, dedupe + coverage validators. Strong
  (one nuance in §3).
- **Duplicate detection** (`findDuplicateTitles`) and **thin/page-quality** (`lib/crawl-quality/thin.ts`,
  `lib/seo-intelligence/scoring.ts` + `content-quality.ts`): explainable component scores; thin
  penalties on structural/factual signals; "do not reward automatically generated filler." Strong.
- **Indexability is earned** (`lib/seo-intelligence/indexability.ts`): conditional gates (fixture
  indexable-only, archive ≥3 settled, country doorway gate, thin → `REVIEW_REQUIRED`). This is the
  spine of the "quality over page count" philosophy — **do not weaken**.

---

## 3. Recommendations (owner decision — NOT changed unilaterally)

These would plausibly increase trust but touch the SEO *philosophy* or need product/content input,
so they are recorded for the SEO owner rather than implemented here. Each is evidence-first,
additive, and violates none of the guardrails.

- **REC-1 — hreflang on `noindex` `pageMetadata` pages.** `pageMetadata` emits the full hreflang
  cluster even when `index=false`. Google treats an hreflang cluster as a set of *indexable*, mutually
  referencing pages; a `noindex` member is inconsistent and the cluster may be ignored. The Acca
  detail rule already suppresses hreflang for its one-locale case (`docs/seo-indexability-rules.md`).
  **Consider** suppressing `alternates.languages` when a `pageMetadata` page is `noindex` *and* has no
  indexable per-locale sibling — but **only** after confirming per-page whether the locale siblings
  are indexable (removing it blindly would break reciprocity for conditionally-indexed clusters).
  Owner decision; needs the per-page sibling-indexability signal.
- **REC-2 — Per-entity real `lastmod` for entity shards.** Operators/markets/competitions/teams/etc.
  currently share the deploy-stable `staticLastModified`. Where a real per-entity "content updated"
  timestamp exists (as Accas already do via `publishedAt`), wiring it in would make `lastmod` even
  more honest and further improve crawl prioritisation. Additive; needs each registry to expose a
  reliable updated-at. (The FIX-1 stability is the safe floor until then.)
- **REC-3 — Internal linking depth** (`lib/crawl-quality/{links,orphans,internal-links}.ts`): the
  orphan/internal-link validators exist; strengthening is a *content/IA* decision (which strong
  entities deserve more contextual in-links), not a technical toggle. Keep it earned — never
  auto-generate link farms or doorway hubs.
- **REC-4 — Set `SITE_CONTENT_DATE` in prod** (ops): pins the sitemap date explicitly (companion to
  FIX-1).

---

## 4. Guardrails reaffirmed

No doorway pages · no mass-generated pages · no thin/duplicate landings · evidence-first structured
data (no invented ratings/odds/outcomes) · indexability earned, not assumed · prefer `noindex` over
low-value index · no spam, no shortcuts, no black-hat. FIX-1 adds/removes no URL and changes no
indexability decision — it only makes an existing honesty signal (`lastmod`) actually honest, which
is a pure trust gain.
