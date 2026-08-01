# Foundational Preservation Initiative (FPI)

> **Status: PLANNING ONLY — NOT STARTED, NOT AUTHORIZED FOR IMPLEMENTATION.**
> **Authored:** 2026-07-31 · **Nature:** Zero-feature, completely additive data-preservation strategy.
> No implementation. No milestone reorder. No production-activation delay. No change to any contract,
> evidence identity, settlement logic, prediction logic, public behaviour, runtime behaviour, existing
> API, or existing storage format. **Capture-only.**
> **Governed by:** `[[rankwagers-manifesto]]` (Reproducibility, Integrity of the Record).

---

## 0. The Firewall & the framing

The current roadmap is frozen. FPI is **additive-only** and its purpose is singular: *stop permanently losing football data that RankWagers is legally entitled to retain, starting as early as safely possible.* It optimizes for **preservation of irreplaceable historical information** — not features, not AI, not SEO. Features can be built later; a match day that passes uncaptured is gone forever.

This plan is grounded in a read-only audit of the actual provider-fetch and archive layers (cited with file paths). The guiding question throughout is **"what will we regret not having in five years?"** — not "what do we want to build?"

---

## 1. Executive Summary & the Primary Question answered

**Primary question:** *What is the smallest additive initiative that starts preserving valuable football data immediately without affecting the current product?*

**The honest answer has two halves, because they have different risk profiles:**

1. **Truly zero-runtime, start today:** *protect what we already preserve.* The system already writes irreplaceable data to immutable archives — and those archives have **no backup, no disaster recovery, no restore test, and no multi-process write safety** (`provider-archive/file.ts:16-26`). We are already losing this data to the *risk of having no copy of it*. Backing it up, replicating it off-host, and verifying restores requires **zero runtime code** and stops a category of irreplaceable loss immediately. This is the smallest possible first step, and nothing about it can touch the roadmap.

2. **Additive-but-not-zero-code, build dormant → activate deliberately:** *capture the data we currently discard.* New capture (raw responses, on-demand fetches, wire context) **cannot be zero-code** — it requires a hook in the fetch path. That hook can be made *behaviour-neutral* (flag-off, no-op when disabled), but it sits on a hot path shared with the frozen evidence pipeline, so it is **built dormant now and activated in a calm window after production stabilizes** — never inside the production-activation change set.

> The smallest initiative that *starts immediately* is **backup + inventory + licensing review of what already exists** (zero code). The smallest initiative that *stops discarding new data* is a **single behaviour-neutral capture tee**, built dormant and activated deliberately. Confusing "additive" with "zero-code" is the trap; capturing new data inherently adds running code, so its *activation* — not its design — is what must wait for safety.

---

## 2. The Core Challenge — raw vs. normalized vs. evidence-only vs. everything

You asked me not to assume raw provider responses are the correct first step. They are the correct *preservation target* — but **not** the correct *first activation*, and **not** unconditionally. Reasoned from first principles:

**Is preserving only evidence sufficient? — No.** Evidence snapshots are heavily *derived* (scores, qualification, signals, `modelVersion`). They encode *today's interpretation* and discard every provider fact the current evidence model doesn't use. Five years from now, a new model, market, or research question will need facts today's model ignores. Evidence-only preserves the answer, not the question. Insufficient for "data we'll regret not having."

**Is normalized-first better than raw? — For *safety* yes; for *completeness* no.**
- *For normalized:* it's already JSON-safe, already half-archived, far smaller, carries **no secret-leak risk** (no URLs/keys), and is **more defensibly RankWagers' own derived work** rather than a verbatim copy of a provider's product (lower legal risk).
- *For raw:* normalization is **lossy and irreversible** (`provider-archive/record.ts:58-72` rejects anything not JSON-safe; rounding, flattening, and unmapped fields are gone). **You can always re-derive normalized from raw; never the reverse.** Only raw preserves optionality.

**Is preserving *everything* a mistake? — "Everything, raw, forever, redistributable" is a mistake. "Everything the system already receives, raw, into a quarantined internal vault, pending legal classification, never redistributed by default" is correct.** The mistake is assuming raw retention is automatically lawful and automatically becomes a product dataset.

**Resolution (the FPI position):**
- **Raw** is the preservation *target* because only it preserves optionality and true reproducibility — but it carries the **most legal risk** (verbatim provider copy), the **most secret risk** (FootyStats key is in the URL), the most storage, and the most concurrency risk. So raw is captured into a **restricted internal vault** for reproducibility/DR, with **retention duration and any reuse gated on per-provider legal classification** (§9).
- **Normalized / canonical / evidence** is the **owned, durable, low-risk layer** — and the guaranteed fallback if a provider's terms forbid raw retention. **Its backup is the zero-code first step (§1.1).**
- **Evidence-only** is never the whole answer, but it is already safe and already preserved.

**Therefore:** protect normalized/derived immediately (zero code); capture raw into a quarantined vault as the dormant-built, deliberately-activated step; let the licensing classification decide how long raw may live and whether it may ever be reused.

---

## PHASE 0 — Repository Audit (what we have and what we're losing)

Answered directly from the audit. *(This phase is doc/read-only — it may start immediately.)*

**What football data is already preserved (permanent, append-only, SHA-256):**
- Normalized provider payloads — `lib/evidence-capture/provider-archive/records.ndjson`
- Normalized odds observations — `.../odds-archive/records.ndjson`
- Derived evidence snapshots — `lib/archive/evidence/snapshots.ndjson`
- All under `{EVIDENCE_ARCHIVE_DIR}` (prod `/opt/rankwagers/shared/evidence-archive`).

**What football data is permanently lost (today):**
- **Raw HTTP response bodies** — never stored anywhere (confirmed).
- **On-demand / enrichment fetches** (page loads, league/team browsing) — never archived at all; only the batch evidence pipeline's subset is kept.
- **Wire context** — HTTP status, headers, timing, retry history, quota state, and **failure bodies** — never preserved.
- **Everything normalization discarded** — unmapped fields, precise numeric values, original structure.

**What exists only in memory:**
- Routing decisions / fetch plans (`routing/*` is stateless), circuit-breaker and quota state, HTTP cache contents, and any **in-memory fallback stores** used when DB env vars are unset (`provider_snapshots`, `odds_history`, attribution all fall back to memory).

**What depends entirely on providers:**
- Essentially all *source* facts — fixtures, teams, competitions, seasons, statistics, odds — originate from **FootyStats** and **API-Football**. We hold normalized derivations for the captured subset and **raw for none**.

**What is already immutable:**
- provider-archive, odds-archive, and evidence snapshots (content-hashed, append-only, no TTL). `provider_snapshots` is **mutable and pruned (3–7d)**; `odds_history` is mutable.

**What can never be reconstructed:**
- Any raw response not captured; any on-demand fetch; the exact provider view of a league/date/time we didn't fetch; the wire form of anything already normalized. **Once a day passes without capture, that provider's view of that day is gone forever.**

---

## PHASE 1 — Immediate Preservation (the minimum additive implementation)

**Goal:** preserve everything the system *already receives*, with no new provider requests, no feature change, no runtime-behaviour change.

**Two clean facts from the audit make this small:**
- **One chokepoint:** every FootyStats + API-Football call converges on `executeProviderCall<T>()` (`lib/providers/reliability/execute.ts:55-246`); the raw `Response` is available (~L137) *before* `ctx.parse` (~L167). No bypasses.
- **The proven pattern already exists:** append-only + SHA-256 + fail-closed reads (three shipped archives to inherit from).

**Minimum additive implementation (design, not code):**
1. **A response tee at the single seam.** `res.clone()` *before* the parser touches it (never consume/reconstruct the original), hand the clone to a **detached, fire-and-forget** task. The provider call returns byte-for-byte as it does today; capture latency and capture failure are invisible to the hot path.
2. **Redact before persist.** Strip the FootyStats URL `key` param and any auth headers *before* writing; record that redaction was applied. The vault must never contain a secret.
3. **Write to a preservation sink, not the product's archives.** Distinct store, distinct identity keys; the product keeps reading exactly what it reads today.
4. **Fail-open, record misses.** If capture can't proceed, the product proceeds; the miss is logged to the coverage ledger (§ Phase 5), never retried in-band.

**Why this is the minimum:** it adds one guarded, behaviour-neutral tee at one function, reuses existing preservation discipline, and reads nothing from the vault back into the product. There is no smaller way to stop discarding new data — and, per §1, even this is not *zero-code*, which is why its **activation** is staged, not immediate.

---

## PHASE 2 — Immutable Raw Archive

**Design:** append-only, never overwritten, never mutated. Each record recoverable with full lineage:
`provider · endpoint · request (params, secrets redacted) · raw response body · HTTP status/headers · request+response timestamps · content-hash (SHA-256) · revision · schema/version marker · capture context (operation, attempt, quota state)`.

**Inherited discipline:** SHA-256 over the payload, immutable-violation rejection of same-id/different-hash, fail-closed reads (malformed → throw, never silently skip) — the proven evidence-archive pattern.

**Two tiers, because the seam serves two very different traffic shapes:**
- **Tier A — batch-path capture** (evidence/prepare jobs). Already **lock-serialized** and single-writer-safe → can reuse the NDJSON append pattern directly. **Lowest risk; ships first.**
- **Tier B — request-path capture** (on-demand page loads / enrichment). This is the true coverage gap, but these fetches are **concurrent across processes/instances**; the existing in-process mutex **cannot** serialize them (torn writes). Tier B therefore needs a **concurrency-safe sink** — object storage with per-object keys, or a DB with proper concurrent inserts — **not** a shared mutex'd file.

**Cost control without deletion:** content-hash **dedup** (identical bodies stored once), **compression**, **cold-tier** storage. Preservation and cost reconcile through tiering, **never pruning**.

**Keep failure bodies too** — non-2xx responses carry rate-limit signals and schema-change canaries; they are part of the historical truth.

---

## PHASE 3 — Canonical Football Model

**Reality check (challenge):** this is *not* greenfield. The product already maps providers into RankWagers entities and rejects provider-specific junk at the normalization boundary; the reliability wrapper is already provider-agnostic (`ctx.provider`). 

**Re-scoped purpose:** *complete and enforce* a canonical model such that **no product code can tell which provider a fact came from** — provider identity lives only in the raw vault and the lineage ledger, never in the shapes the product consumes. Every provider is an adapter that maps *into* the canonical model; RankWagers owns the model, providers own nothing downstream of the adapter. Add a canonical schema version.

**Firewall:** additive mapping only; must not alter any existing evidence identity or contract. **Sequencing:** long-term (touches derivation-adjacent code; no preservation urgency once raw is captured — raw lets you re-map later).

---

## PHASE 4 — Provider Independence

**Assume:** FootyStats disappears tomorrow; API-Football disappears later; a new provider appears. **Independence has two halves — both required:**
- **Survive *disappearance* (backward):** the raw + canonical archive means we keep the history even if the provider vanishes. Delivered by Phases 2–3.
- **Survive *failure going forward* (forward):** a formal **adapter contract** (the injectable `SourceFetcher` seam already exists in `routing/`), a **parity/comparison harness** (cross-check a fact from two providers), and a **cutover strategy** (route a data category to a new provider without touching the product, because the product only sees the canonical model).

**Migration strategy:** new provider → write an adapter into the canonical model → run it in **shadow** alongside the incumbent → compare via the parity harness → cut over per data category when parity holds → the incumbent becomes optional. No product change at any step, because nothing downstream knows the provider.

**Sequencing:** long-term; design the contract early (cheap), keep adapters dormant until a real second source is warranted.

---

## PHASE 5 — Data Integrity

A measurement and assurance layer (read-only over archives; can begin measuring immediately, deepens as capture lands):
- **Coverage dashboard** — what is archived, missing, never-fetched, and (per §9) **cannot legally be stored**.
- **Completeness** — league / season / country coverage, provider overlap, missing periods.
- **Capture-miss ledger** — every fail-open skip recorded as a known gap (no silent holes).
- **Hash verification** — periodic re-hash of every record against its stored SHA-256.
- **Backup & restore verification** — scheduled restore rehearsals, not just backups.
- **Integrity score** — a single trend: are we whole, verified, and recoverable?

---

## PHASE 6 — Long-Term Football Data Lake (vision, not implementation)

The eventual union of the raw vault (Phase 2), canonical model (Phase 3), and lineage — a permanent, RankWagers-owned football archive that could become one of the world's best historical football datasets *for internal reproducibility and provider independence*.

**Hard boundary (challenge):** owning a *preservation* archive is one thing; treating it as a *licensable / redistributable product* is another and is **gated entirely on §9's per-provider legal classification**. The data lake may exist for reproducibility long before — or without ever — becoming a redistributable product. Its *productization* is a legal/product decision, **not** a preservation milestone. What we unambiguously own and can build value on is the **derived layer**: canonical model, lineage, measurements, and interpretation.

---

## 9. Licensing & Data Retention (mandatory — do not assume raw may be kept forever)

Raw provider responses may **not** be assumed lawful to retain indefinitely or to reuse. Three explicit categories govern everything above:

**A. Safely retained under the provider agreement.**
Whatever each provider's Terms of Service explicitly permit to store and for how long (often limited caching/derived use). **Must be read per provider** (FootyStats, API-Football) before Phase 2 retention windows are set. Until confirmed, treat as *provisional*.

**B. Derived / internal evidence owned by RankWagers.**
The normalized, canonical, evidence, lineage, and measurement layers — our *interpretation and transformation*. Lowest legal risk, safest to retain long-term, and the **durable owned asset** on which any future value (including commercial) most safely rests. Backing this up is the zero-code immediate step (§1.1).

**C. Requires contractual review before long-term retention or commercial reuse.**
Verbatim raw provider responses — especially (i) retention beyond any ToS caching window, (ii) any redistribution, resale, or public exposure, (iii) any commercial dataset/productization. Raw is captured into a **quarantined internal vault by default** (defensible for reproducibility/DR); its **retention duration and any reuse are blocked pending category-C review**.

**Operating rules:** never store secrets/keys; internal-vault, no-redistribution default; the coverage dashboard surfaces the "must-not-store" set so we can *prove* compliance; the goal is **maximum provider independence achieved without any action that could conflict with contractual obligations** — which is exactly why independence is built primarily on the **owned derived layer (B)**, with raw (C) as a legally-gated reproducibility reserve.

---

## 10. The Three-Way Split (every decision explained)

### 1 — MUST start immediately (zero runtime risk; loses irreplaceable data every day)
| Item | Why now |
|---|---|
| **Phase 0 audit** | Doc/read-only; establishes exactly what is lost so nothing waits on discovery. |
| **Backup / off-host replication / integrity-verify / restore-test of existing immutable archives** | **Zero code.** Irreplaceable data is already accumulating with *no safety net*; losing the file loses everything FPI is about. Highest priority, lowest risk. |
| **Licensing classification (§9)** | Legal/doc. It *gates* Phase 2 retention; must precede, not follow, capture. |
| **Coverage/completeness measurement (Phase 5, read-only)** | Read-only over existing archives; quantifies the gap and prioritizes. |
| **Design + dormant build of the Phase 1 capture tee** | Design is doc; a flag-off, no-op-when-disabled build changes no behaviour and makes activation a one-line, pre-validated switch. |

*Rationale:* every item here touches **no runtime behaviour** and either protects already-irreplaceable data or prepares capture. Delay here is pure, avoidable loss.

### 2 — SHOULD wait until after production activation (additive, but hot-path-adjacent)
| Item | Why wait |
|---|---|
| **Activating Tier A raw capture** (batch, lock-safe) | The tee lives on the reliability hot path shared with the **frozen evidence pipeline**. Any regression there could destabilize or *delay production activation* — which is forbidden. Activate only in a stable window, after activation completes. |
| **Activating Tier B raw capture** (request-path, concurrency-safe sink) | Higher volume + multi-process concurrency; activate after Tier A proves behaviour-neutral in production. |

*Rationale:* "as early as **safely** possible" resolves to *after production*, because during the activation window the safety bar (zero risk to a frozen, activating pipeline) cannot be met. Dormant-build-now minimizes the eventual delay to a single switch.

### 3 — SHOULD wait until the long-term roadmap (larger, dependent, or legally gated)
| Item | Why later |
|---|---|
| **Phase 3 canonical model completion** | Touches derivation-adjacent code; no preservation urgency once raw is captured (raw lets you re-map anytime). |
| **Phase 4 provider independence (adapters, parity, cutover)** | Depends on canonical model + raw archive; design early, activate on need. |
| **Phase 5 full integrity dashboard + integrity score** | Grows with captured volume; full value only after Phase 2. |
| **Phase 6 data lake aggregation** | Union of prior phases; incremental. |
| **Any reuse / redistribution / commercialization of raw (category C)** | Legal/product decision, gated on §9 — never preservation-urgent. |

---

## 11. Dependency Graph (relative to the roadmap)

```
════════════ FROZEN — CURRENT ROADMAP (untouched, first priority) ════════════
 Current M10 ─► Production Activation ─► Evidence Capture ─► Settlement
             ─► Accuracy ─► ROI ─► Prediction Archive ─► SEO roadmap
══════════════════════════════════════════════════════════════════════════════
        │  (FPI never delays, reorders, or modifies any of the above)
        │
        ├───────────── RUNS IN PARALLEL, OFF THE CRITICAL PATH ──────────────┐
        │   [MUST start immediately — zero runtime risk]                      │
        │   Phase 0 audit ·  Backup/DR of existing archives  ·               │
        │   Licensing classification (§9)  ·  Coverage measurement  ·        │
        │   Phase 1 tee: DESIGN + DORMANT build (flag-off, no-op)            │
        └───────────────────────────────┬────────────────────────────────────┘
                                        │ (activation gated on a calm window)
        after Production Activation ────▼───────────────────────────────────
           [SHOULD wait until after production]
           Activate Tier A (batch) raw capture ─► Activate Tier B (request)
                                        │
        within the LONG-TERM VISION timeframe ──▼───────────────────────────
           [SHOULD wait until long-term roadmap]
           Phase 3 Canonical model ─► Phase 4 Independence (adapters/cutover)
           Phase 5 Integrity score ─► Phase 6 Data Lake (productization = legal-gated)
                                        │
           unifies with ───────────────▼
           Long-Term Vision  K0-3 Provenance/Lineage  ([[long-term-product-vision-architecture-review]])
                                        │
           AI Intelligence ────────────▼  (latest; consumes preserved data, never gates it)
```

**Placement rationale:**
- **M10 / Production Activation / Evidence / Settlement / Accuracy / ROI / Prediction Archive / SEO:** untouched. FPI's only intersection is that raw-capture *activation* waits until after production activation, precisely so it cannot affect it.
- **Long-Term Vision:** FPI Phase 4 lineage **is** the vision's K0-3 provenance ledger — build once, serve both. Canonical model + data lake live in the same long-term window.
- **AI Intelligence:** strictly downstream; it benefits from preserved data but must never gate or be gated by preservation.

---

## 12. What Changed vs. the proposal (challenges applied)

- **Reframed the "smallest additive initiative":** the only truly *zero-code, start-today* step is **backup of existing archives**; new raw capture is additive but not zero-code, so its *activation* is staged. Confusing additive with zero-code is the core trap.
- **Challenged "raw first":** raw is the correct preservation *target* (optionality, reproducibility) but the highest legal/secret/cost/concurrency risk → captured into a **quarantined, legally-gated internal vault**, not activated first and not assumed lawful to keep forever. **Normalized/derived is protected first** (zero-code) and is the owned, durable, low-risk layer.
- **Rejected "evidence-only" (discards source) and "everything-forever-redistributable" (legal/cost mistake).**
- **Elevated backup/DR to the immediate top priority** — existing immutable archives have none.
- **Rewrote the capture mechanism** — clone-not-consume, fire-and-forget, mandatory secret redaction (FootyStats key in URL), and **two tiers** (batch lock-safe first; request-path concurrency-safe second).
- **Re-scoped Phases 3–4** — canonical mapping and provider abstraction partially exist; complete/enforce, don't rebuild.
- **Made §9 licensing a gate, not a footnote** — three explicit categories; independence built on the owned derived layer; raw reuse blocked pending review.
- **Answered the sequencing explicitly** (§10) and placed FPI off the roadmap's critical path (§11).

Nothing here implies implementation, milestone change, contract change, or runtime-behaviour change. It is the permanent strategy for making RankWagers progressively independent of external football-data providers while fully respecting contractual and legal obligations.

_Related: `[[rankwagers-manifesto]]`, `[[long-term-product-vision-architecture-review]]` (K0-3 provenance), `[[m2-provider-archive-migration-review]]`, `[[m3-odds-archive-migration-review]]`, `[[m4-source-routing-migration-review]]`, `[[m7-historical-input-identity-failure-review-v2]]`._
