# Calibration methodology (v24.0.0)

## Immutable evaluation principle

Primary cohorts should use publication-time prediction state + final settlement.

**Current reality:** RankWagers stores daily list archives that can be overwritten on re-save. Calibration therefore uses **best-effort archive rows** as publication proxies and surfaces issue `PUBLICATION_SNAPSHOT_MUTABLE`.

## Hit rate

`won / (won + lost)` — voids excluded from the denominator.

## Calibration gap

`averageConfidence(0–1) − observedSuccessRate`

- Positive → overconfident
- Negative → underconfident

## Probability metrics (when semantics allow)

- **Brier score** — mean squared error of probability vs binary outcome
- **Log loss** — clipped at `1e-15` / `1−1e-15`
- **ECE / MCE** — equal-width bins on [0,1]

## Confidence bands

Default bands on 0–100 scale: 50–54 … 90+, plus `<50`.

Inversions: higher average-confidence band with materially worse observed rate (sample-gated).

## What is never done

- Fabricated odds / ROI
- Silent historical rewrite
- Auto-tuning thresholds or Builder weights
- Treating correlated Acca legs as independent for financial claims
