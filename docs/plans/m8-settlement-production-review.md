# Sprint 23B — Milestone M8 (Settlement & Validation Revisions) — Production Safety Review

**Status:** RECORDED — production-safety review only. No runtime code changed; no frozen contract altered. Reviewer: Claude 3 (production safety). Date 2026-07-29. Findings independently re-verified against source (code, not reports) with a full re-run of tests/typecheck/lint/coupling-sweep — §14.
**Scope:** M8 only — `lib/evidence-capture/settlement.ts`, `lib/evidence-capture/outcomes.ts`, `tests/evidenceSettlement.test.ts`, and their interaction with the frozen validation/archive contracts. Determines merge-while-dormant safety and enumerates pre-activation gates. **Does not activate settlement, add cron/routes/workers, or deploy.**

---

## 1. Production-safety summary

M8 is a **dormant, injectable, pure-orchestration** pair of modules. `outcomes.ts` is a pure/total outcome mapper; `settlement.ts` turns a terminal fixture + an immutable snapshot into append-only, revision-aware `ValidationRecord`s via **only** the frozen validation builders and the frozen `EvidenceArchiveStore` contract. It mints no identity, adds no field to any frozen record, reads no clock/env/network, and is wired to no runtime. It is **safe to merge while inactive**; activation is gated (see §11).

## 2. Runtime coupling findings

Repository sweep for `settleSnapshot`, `settleLatestSnapshotForFixture`, `resolveValidationOutcome`, `EVIDENCE_SETTLEMENT_ENABLED`, and the module paths across `app/`, `lib/`, `components/`, `middleware.ts`, `instrumentation.ts`, `scripts/`, `deploy/`, `.github/`:

- **No runtime importer.** The only importer is `tests/evidenceSettlement.test.ts`.
- No coupling from routes, API routes, page rendering, startup/bootstrap, cron, scheduler, worker, queue consumer, CLI, health endpoint, build hooks, `instrumentation.ts`, or any test-only hook leaking into runtime. **Activation graph is empty.**

## 3. Side-effect findings

Importing either module performs **no** env read, archive read/write, network call, timer, event subscription, scheduler registration, background task, sensitive logging, or identity generation. No top-level executable state (only `const` type unions, frozen arrays, function declarations). Import-side-effect probe: "no throw, no side effects." Neither module reads a clock (`resolveMatchLifecycle` is always called with an explicit, integer-validated `nowSec`; its `Date.now()` default is unreachable, settlement.ts:214/222) or `Math.random`.

## 4. Feature-flag findings

- `EVIDENCE_SETTLEMENT_ENABLED = false` is a **hardcoded module constant** (settlement.ts:49) — **not** read from `process.env` and **not** wired into `lib/config/featureFlags.ts`. It **cannot** be flipped by an undefined/malformed environment value.
- `isEvidenceSettlementEnabled(flag)` is a pure predicate; **no caller reads it**, so the flag activates nothing by itself.
- The shared `FeatureFlags` framework is **unaltered** (no settlement symbols in `featureFlags.ts`).
- Absence of activation wiring is **intentional and documented** (settlement.ts:44-49 names the M9 wiring gate), not accidental ambiguity.

## 5. Failure-safety findings (probe-verified)

`resolveValidationOutcome` is pure/total (nothing throws). Verified outcomes:

| Input | Result | Guarantee |
|---|---|---|
| finished + FT scores present | `settled` won/lost | correct |
| finished, **missing FT score** (`NaN`) | `pending` | **never `lost`** (R3) |
| finished but `isFinished=false` | `pending` | never `lost` |
| `fh`/`sh` with missing HT/SH score | `pending` | never `lost` (R3) |
| cancelled / postponed / abandoned | `terminal_non_scored` (`fixture_*`) | **never `lost`** (R2) |
| live / suspended / half_time / scheduled | `pending` | never `lost` |
| unsupported market (`1x2`) / wrong selection (`under`) | `unsupported` | **never `lost`** |
| malformed instant | `invalid` (`invalid_timestamp`) | never `lost`, never substituted |
| malformed row / unknown lifecycle | `invalid` | fail-closed |
| `market_void` | only when explicit `authoritativeMarketVoid=true` | **no synthetic void** (R6) |

Orchestrator (`settleSnapshot`): `pending` → no append (R4); unchanged current outcome → `no_change` (retry-idempotent, verified); changed outcome → **exactly one** correction, and only when an explicit typed `correctionCause` is supplied (R5) — missing cause → `invalid_input`. Correction reason is a pure map (`settlement_correction`/`data_correction`), never inferred from clock/retry/worker. Correction note is deterministic (`from->to:reason`), not user-controlled. **Immutable violations are surfaced loudly** (`status:"immutable_violation"`, counted, `ok:false`) — never downgraded. No partial malformed correction (frozen `reviseValidationRecord` fails closed on illegal transitions; a failed build appends nothing). No duplicate spam (unchanged → `no_change`; byte-identical rebuild absorbed by store `(revisionId, contentHash)` idempotency).

## 6. Archive-safety findings

- **Exact-snapshot settlement** supported (`settleSnapshot`); latest-snapshot selection is deterministic via the store's frozen `sequence` ordering (`latestSnapshot`), never archive read order (R6). One call never settles multiple historical snapshots.
- Append-only validation history is authoritative; current revision is derived through the frozen `currentValidationRevisions` (highest revision), never a stored `isCurrent`.
- **Append failures are never success** — `res.ok` is checked; `immutable_violation` and other codes map to `immutable_violation`/`append_failed` and set `ok:false`.
- **Read failures are not treated as empty history** — a throwing `listValidations`/`latestSnapshot` propagates (fail-loud), never a silent empty stream (probe: read failure throws "EIO disk fail"). See §7/§12 for the boundary caveat.
- No automatic store migration; the store is injected. Malformed stored records are handled by the frozen adapter's read semantics (not silently coerced by M8).

## 7. Race-condition findings (future activation)

| Scenario | Assessment |
|---|---|
| retry after timeout / duplicate provider callback | **Safe** — unchanged → `no_change`; identical revision `(revisionId, contentHash)` → duplicate. |
| future Postgres UNIQUE conflict | **Safe** — surfaces as `immutable_violation` by design. |
| two cron invocations / overlapping runs / two nodes settling one snapshot | **Conditionally safe** — the frozen validation store is read-decide-append with **no in-process mutex** (R7); concurrent writers can interleave or produce a competing revision. Safe **only under a single serialized writer**; an external single-writer/advisory lock is an activation gate (same class as M2/M3/M6). |
| correction arriving during settlement | **Conditionally safe** — two writers targeting the same head → one wins, the other hits `immutable_violation`; safe under single-writer. |
| process restart during append | **Conditionally safe** — a torn NDJSON line is governed by the frozen adapter's read semantics; Postgres readiness (register R1) is the durable fix. |
| archive read-after-write delay | **Conditionally safe** — an eventually-consistent read could miss a just-appended revision → a duplicate/competing append; strongly-consistent stores (memory/NDJSON, correctly-read Postgres) are safe. |
| partial filesystem failure | **Fail-loud** — store I/O throws propagate uncaught across the settlement boundary (settlement.ts:230/326/371); never a false success, but the M9 orchestrator must catch and treat as retryable. |

## 8. Security findings

- No provider secrets persisted; no raw provider payload echoed into results/errors (messages are fixed strings or frozen-builder validation errors; the `row` is never serialized into output).
- `correctionCause` is a **closed typed union**, not an arbitrary user string; the persisted `note` is deterministic. No user-controlled arbitrary correction reason.
- No path construction / traversal (no `fs` in M8; store injected). No unbounded external string enters a hash outside the frozen canonicalization (identities via frozen `validationId`/validation builders).
- No production endpoint exposes settlement internals (no route added).

## 9. Observability requirements (deferred — evaluate only)

M8 returns a structured `SettlementSummary`/`MarketSettlement[]` but emits **no** metrics/logs. Before activation, wire: settlement-attempt metric; appended / no_change / pending counters; **immutable-violation alerting**; correction-rate metric; unsupported-market counter; missing-score counter; lifecycle-state counter; **archive-failure alerting**; settlement latency; duplicate/race metric. (Do not add now.)

## 10. Safe-to-merge assessment

**Safe to merge while dormant.** No runtime coupling, no activation path, no import side effects, env-independent `false` flag, pure fail-closed logic, no false-loss, immutable violations surfaced, idempotent under retry. No merge blocker.

## 11. Pre-activation gates (must complete before turning settlement on)

1. **Single-writer enforcement** — an external advisory/single-writer lock (M9 orchestration) so concurrent cron/nodes cannot interleave validation appends (R7).
2. **Store-error handling at the caller** — the M9 orchestrator must catch thrown `listValidations`/`appendValidation`/`latestSnapshot` errors and treat them as retryable failures, never as "settled"/empty.
3. **Flag wiring** — connect `EVIDENCE_SETTLEMENT_ENABLED` to the shared `FeatureFlags` framework, default off, and gate the scheduler on it.
4. **Observability** (§9) — at minimum immutable-violation and archive-failure alerting before durable writes.
5. **Postgres readiness** (register R1) for sustained production; NDJSON is an initial adapter only.
6. **Deterministic completion source** — the caller must supply source-derived `completionInstant`/`nowSec` (never a clock); confirmed required by M8, must be honored by the wired caller.

## 12. Required changes

**None for dormant merge.**

## 13. Optional improvements (pre-activation hardening)

- Wrap the three store I/O calls (settlement.ts:230/326/371) into a typed `archive_error` status (mirroring M6), so archive infrastructure failures return a result instead of throwing across the public boundary (currently fail-loud, which is safe but asymmetric with the input-validation fail-closed contract).
- Add `import "server-only"` to `settlement.ts` (node-only via the frozen `node:crypto` builders) to make the server boundary explicit; harmless while dormant (a client import fails the build fail-closed).

## 14. Exact verification results

Re-run in full on 2026-07-29 (independent confirmation pass):

- **M8 tests** (`tests/evidenceSettlement.test.ts`): **34 / 34 pass, 0 fail**.
- **Archive/validation tests** (`evidenceArchive` + `evidenceArchiveFileAdapter`): **76 / 76 pass, 0 fail**.
- **Full suite** (`tests/*.test.ts`): **1654 / 1654 pass, 0 fail** (exit 0).
- **Typecheck** (`tsc --noEmit -p tsconfig.typecheck.json`): **clean, exit 0** (no memory-gating this run).
- **Lint** (`next lint` on the three M8 files): **no ESLint warnings or errors**.
- **Coupling sweep**: only importer of M8 symbols is `tests/evidenceSettlement.test.ts` (+ `m8bench.mjs`, a dev-only benchmark, not runtime). `lib/fixtures/loadMatchPage.server.ts` imports the pre-existing, unrelated `lib/fixtures/settlement.ts` (`settlePrediction`), **not** the M8 module. `lib/evidence-capture/config.ts` (which reads `EVIDENCE_SETTLEMENT_ENABLED` from env) is imported by **no runtime module**.
- **Import-side-effect probe** (proxied `process.env`): importing `settlement.ts` reads **zero** settlement/flag env keys (16 reads observed are all loader baseline: `NODE_ENV`, TS-runtime config, etc.). Flag constant `= false`; `isEvidenceSettlementEnabled("true") === false` (strict `=== true`, only a literal boolean activates); `determineCorrectionReason(bogus) === null`.
- **Failure-safety probe** (direct behavioral): missing FT score → `pending` (never `lost`); `cancelled` → `cancelled` (never `lost`); unsupported `1x2` → `unsupported`. Store referential-integrity rejection surfaces as `append_failed` / `ok:false` (never a false success).

## 15. Final verdict

**M8 PRODUCTION CONDITIONALLY APPROVED** — safe to merge while dormant; production activation is gated on §11.
