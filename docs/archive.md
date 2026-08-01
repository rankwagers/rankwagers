# Archive & calibration linkage

Daily list archives live at `data/daily-archives/YYYY-MM-DD.json` and project through `lib/archive/*` into `ArchivePredictionRecord`.

See also: `docs/transparency.md`, `docs/prediction-settlement-methodology.md`.

## Sprint 24 notes

- Archive `confidence` is 0–100 (see `docs/confidence-semantics.md`).
- `publishedAt` is archive `savedAt` (publication proxy).
- Archives are **overwrite-mutable** on re-save — not append-only publication freeze.
- Calibration Intelligence treats archive rows as best-effort primary cohorts and issues `PUBLICATION_SNAPSHOT_MUTABLE`.
- `originalOdds` / ROI remain null — never fabricated.
- Settlement statuses: won / lost / void / pending.
