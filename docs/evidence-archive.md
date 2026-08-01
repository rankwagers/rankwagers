# Evidence Archive & Prediction Validation Engine

Sprint 23. The permanent historical validation layer for RankWagers.

This is **not** a tip archive. It is an immutable evidence history: what the evidence
looked like at each moment we looked, and how each published selection actually settled.

---

## 1. Why it exists

Everything downstream of this sprint needs to answer a question of the form *"what did we
know, when did we know it, and were we right?"*:

| Future feature      | What it reads from here                                        |
| ------------------- | -------------------------------------------------------------- |
| Accuracy Dashboard  | Validation states joined to snapshots, `won`/`lost` only        |
| Evidence Archive UI | Snapshot streams per fixture                                    |
| Closing Line Value  | `bestOddsSnapshot` on the opening and closing snapshots          |
| Calibration         | `evidenceScore` / `qualification` / `modelProbability` buckets  |
| Trust Score         | Correction rate, integrity verification results                 |
| Time Machine        | `sequence` + `previousSnapshotId` replay ordering               |

None of these may require a schema change. Section 6 states the extension rules that keep
that promise.

---

## 2. Architecture

```
types/evidence/            Contracts. No runtime imports; safe everywhere.
  snapshot.ts              EvidenceSnapshot + its parts
  validation.ts            ValidationRecord
  history.ts               Raw history + projected view models

lib/evidence/              Domain core
  constants.ts             Versions, caps, thresholds
  hash.ts                  Canonical JSON + sha256          [node:crypto]
  identifiers.ts           Deterministic id minting         [node:crypto]
  score.ts                 Normalization + banding          (pure)
  qualification.ts         Qualification labels + derivation (pure)
  snapshot.ts              createEvidenceSnapshot           [node:crypto]
  integrity.ts             Row + chain verification         [node:crypto]
  presentation.ts          Tokens + formatters              (browser-safe)
  analytics.ts             The four Sprint 23 events        (browser-safe)

lib/validation/            Validation lifecycle
  states.ts                State machine + predicates       (pure)
  records.ts               create / revise / current        [node:crypto]
  integrity.ts             Revision-chain verification      [node:crypto]

lib/archive/evidence/      Persistence + query
  store.ts                 EvidenceArchiveStore contract    (types)
  rules.ts                 Append-admission decisions       (pure)
  memory.ts                In-memory store
  file.ts                  Durable NDJSON store             [server-only]
  service.ts               The entry point                  [server-only]
  project.ts               History → view model
  schema.ts                Dataset JSON-LD
  links.ts                 Paths and anchors
  api.ts                   Query parsing + response headers

components/evidence/       UI (see the registry in index.ts)
app/api/evidence/          history | latest | validation
```

### Why `lib/archive/evidence/` and not `lib/archive/`

`lib/archive/*` already exists and holds the **daily results archive** — a different,
unrelated dataset. Sprint 23 nests under it rather than replacing it. No existing
`lib/archive` file was modified.

### Module boundary rule

`hash.ts`, `identifiers.ts`, `snapshot.ts`, `integrity.ts`, `records.ts`, `project.ts`
and `service.ts` reach for `node:crypto` or `fs`. Client Components must therefore import
only:

- `@/types/evidence`
- `@/lib/evidence/presentation`
- `@/lib/evidence/analytics`
- `@/lib/validation/states`

The barrels (`@/lib/evidence`, `@/lib/archive/evidence`, `@/lib/validation`) are
server-side only. A test enforces this — see section 9.

---

## 3. Evidence lifecycle

```
capture → createEvidenceSnapshot() → appendEvidenceSnapshot() → archived forever
                    │                          │
              validate + hash            admission rules
              + deep-freeze              (rules.ts)
```

1. **Capture.** A job assembles signals, supported markets, operator availability and the
   best price it can see, and asks the archive for `nextEvidenceSequence(fixtureId)`.
2. **Mint.** `createEvidenceSnapshot` is the only sanctioned constructor. It validates
   everything (see below), normalizes the timestamp, recomputes `impliedProbability` from
   `decimalOdds` so a caller cannot supply an inconsistent pair, mints a deterministic id,
   hashes the body, and deep-freezes the result. Failures are **returned, not thrown**.
3. **Append.** `appendEvidenceSnapshot` consults the shared admission rules. Three
   outcomes: appended, idempotent duplicate, or rejected.
4. **Never again.** There is no update path and no delete path. A changed view of the same
   fixture is a *new* snapshot at `sequence + 1`, chained via `previousSnapshotId`.

### Snapshot statuses

`captured` → `superseded` → `archived`. Status is set at append time and is not rewritten
on existing rows; a superseding capture records its own status.

### Rejected at construction

- Non-positive or non-integer `fixtureId`
- Unparseable `capturedAt`
- `sequence < 1`; `sequence === 1` with a `previousSnapshotId`; `sequence > 1` without one
- Duplicate signal keys, negative weights, non-integer sample sizes
- Duplicate market+selection pairs, `modelProbability` outside `[0,1]`
- `availableOperators > totalOperators`
- `decimalOdds <= 1`
- Signals > 64, markets > 32, operator keys > 64 — **caps reject, they never truncate**

---

## 4. Validation lifecycle

Seven states:

| State       | Terminal | Scored | Meaning                                   |
| ----------- | -------- | ------ | ----------------------------------------- |
| `pending`   | no       | no     | Outcome not yet known                     |
| `won`       | yes      | yes    | Settled in favour of the evidence         |
| `lost`      | yes      | yes    | Settled against the evidence              |
| `void`      | yes      | no     | Market voided                             |
| `cancelled` | yes      | no     | Fixture cancelled                         |
| `postponed` | yes      | no     | Fixture postponed                         |
| `abandoned` | yes      | no     | Fixture abandoned                         |

**The four unscored terminal states are the point of this table.** Counting them as losses
inflates the miss rate; counting them as wins inflates accuracy. Every future accuracy,
calibration or trust calculation must gate on `isScoredValidationState`.

### Corrections are appends

```
revision 1 (won)  ──supersededBy──▶  [DERIVED AT READ TIME, NOT STORED]
      ▲
      └── revision 2 (void), supersedesRevisionId → revision 1's revisionId
```

`reviseValidationRecord(previous, input)` mints a new row. `id` is stable across
revisions; `revisionId` is unique per row. There is deliberately **no `supersededBy` and
no `isCurrent` field** — a forward pointer would mean writing to an already-written row.
"Current" is derived as the highest revision (`currentValidationRevisions`).

Corrections must supply:
- `reasonCode` of `data_correction` or `settlement_correction` (revision 1 may **not** use
  these)
- a non-empty `note`
- a legal transition — a terminal state never returns to `pending`
- a `recordedAt` at or after the revision being superseded

Settlement timing is enforced both ways: terminal states require `settledAt`; `pending`
requires it to be `null`.

---

## 5. Immutability, and how it is checked

A contract that cannot be verified is a hope. Three mechanisms:

1. **Constructor.** Rows are deep-frozen, so nothing can mutate a snapshot it was handed.
2. **Store.** `rules.ts` holds the admission decisions and is shared by every adapter, so
   the in-memory and durable stores cannot drift. Same id + same `contentHash` → idempotent
   no-op. Same id + different `contentHash` → `immutable_violation`. The
   `EvidenceArchiveStore` interface has no update and no delete method.
3. **Reader.** `verifyEvidenceChain` and `verifyValidationChain` recompute every hash, check
   that ids are still derivable from their coordinates, and re-walk the chain for gaps,
   duplicates, broken back-pointers and backwards timestamps.

When a row fails verification the UI **shows it anyway, flagged**. Hiding a suspect row
would be a second falsification on top of the first.

### Durable adapter limits (documented, not hidden)

`file.ts` appends NDJSON lines and never opens a file for truncation. Known limits:

- `appendFile` is not multi-writer transactional. Two concurrent appenders can both pass
  admission and write. The reader-side chain check surfaces the resulting conflict rather
  than trusting it. Correct for the current single-writer capture path; a Postgres store is
  the eventual fix.
- Reads are a linear scan of the whole file, bounded on output but not on input. Wants an
  index at scale.
- Malformed lines are skipped, never repaired. A corrupt line is data loss to investigate.

Set `EVIDENCE_ARCHIVE_ADAPTER=memory` to opt into volatile storage.

---

## 6. Forward compatibility rules

Extensions must be **additive**:

- New analytical inputs become new `signals[]` entries — never new top-level columns.
- New optional fields are permitted; redefining an existing field is not.
- `EVIDENCE_SCHEMA_VERSION` changes only when the persisted shape changes. History is
  never migrated, so readers must tolerate a mix of versions on disk.
- `EVIDENCE_MODEL_VERSION` changes when the scoring model changes, and is never reused —
  calibration segments accuracy by it.
- Enums grow; values are never removed or repurposed.

---

## 7. Fixture page, SEO and URLs

The Evidence History section renders on the **existing** fixture page as a sibling of
`MatchDetailView`, inside `app/[locale]/fixtures/[matchId]/page.tsx`. It is a Server
Component, so the archive is in the initial HTML for crawlers and for readers without
JavaScript; only the disclosure controls and analytics hydrate.

**No new URL is introduced.** The section is reachable at
`/{locale}/fixtures/{matchId}#evidence-history` — a fragment, which is the same URL to a
search engine. There is therefore no duplicate-URL surface and no new canonical.

Structured data is a `Dataset` node: a fixture's evidence archive genuinely is a versioned,
timestamped measurement series. It is not a rich-result type, so it makes an accurate claim
without competing with the page's existing `SportsEvent` markup. It is emitted **only when
history exists** — an empty dataset is never asserted.

The three JSON APIs are `noindex, nofollow`: a JSON mirror of page content is exactly the
duplicate-content surface the sprint rules out.

---

## 8. Internal APIs

All read-only, `runtime = "nodejs"`, `dynamic = "force-dynamic"`, no auth (they project
data already server-rendered publicly).

| Route                      | Returns                                                     |
| -------------------------- | ----------------------------------------------------------- |
| `GET /api/evidence/history`    | Full projected `EvidenceHistoryView`                    |
| `GET /api/evidence/latest`     | Raw highest-sequence snapshot + integrity verdict       |
| `GET /api/evidence/validation` | Validation subjects, totals, revision-chain integrity   |

Query: `fixtureId` (required, positive int), `limit` (≤ 200, default 50), `locale`.
Invalid input → `400` with field-level issues and `no-store`. Success → 60s shared cache.

A fixture with no archive returns **`200` with `available: false`**, not `404`. "We have no
evidence for this fixture" is a real answer and the caller should not have to distinguish it
from a broken route.

`latest` returns the raw stored row rather than a projection so a consumer can recompute the
content hash independently instead of taking our word for it.

---

## 9. Empty and failure states

The section distinguishes three absences, because they mean different things to someone
judging our record:

| `emptyReason`         | Copy                             |
| --------------------- | -------------------------------- |
| `no_snapshots`        | Nothing was captured yet         |
| `fixture_not_tracked` | Fixture is outside the capture set |
| `archive_unavailable` | **We** could not read the archive |

Reads fail soft — `getEvidenceHistoryView` never throws and always returns a well-formed
view. Writes fail loud — append results are returned so a capture job can retry or alert
rather than silently drop evidence.

---

## 10. Accessibility

- The timeline is a real `<table>` with a `<caption>`, `scope="col"` headers and
  `scope="row"` row headers.
- Disclosure is a native `<button>` with `aria-expanded` / `aria-controls`, so Enter and
  Space work with no handler of ours.
- Detail rows are `hidden`, not unmounted, so every `aria-controls` target exists.
- Arrow / Home / End move focus between row toggles — the one interaction a plain table
  does not give for free on a long history.
- Badges carry their meaning in an `sr-only` sentence with the visual label
  `aria-hidden` — meaning is never conveyed by colour alone.
- All controls carry a `focus-visible` ring.

## 11. Analytics

`evidence_history_viewed`, `evidence_snapshot_expanded`, `evidence_validation_viewed`,
`evidence_timeline_interaction` — registered in `lib/analytics/types.ts`.
`properties.snapshot_id` joins back to the immutable archive row;
`properties.interaction` separates keyboard from pointer.

## 12. Tests

`tests/evidenceArchive.test.ts` — 71 tests across pure domain, snapshot
construction, integrity, validation lifecycle, append-only storage, projection, API
contract, SEO/links, analytics registration, rendering, accessibility and sprint isolation.

Two isolation tests are load-bearing: one asserts Sprint 23 imports nothing from the
Operators / Affiliate / Live / Homepage domains; the other asserts no Client Component
imports a server-only barrel, `node:crypto`, `fs` or `server-only`.
