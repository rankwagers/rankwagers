# Confidence semantics

## Current archive scale

Daily archive predictions store `confidence` as a **0–100** value described as “Model probability at list qualification.”

## Classification (Sprint 24)

| Label | Meaning |
|-------|---------|
| `CALIBRATABLE_PROBABILITY` | Treated as probability-like for Brier / log-loss / ECE **with caveats** |
| `PROVIDER_PERCENTAGE` | Provider % (not currently primary) |
| `SCORE` | Non-probabilistic score |
| `RANKING_SIGNAL` | Ordering signal only |
| `UNKNOWN_SEMANTICS` | Missing/invalid — probability metrics forbidden |

Sprint 24 adapter: `normalizeConfidence()` in `lib/calibration-intelligence/confidence.ts`.

Preserved fields:

- `rawValue`
- `rawSource`
- `normalized0to1`
- `normalized0to100`
- `semantics`
- `normalizationVersion`

## Caveats

- Classification does **not** prove the value is a well-calibrated true probability.
- Archives are overwrite-mutable; reconstructed later confidence must not enter primary cohorts unmarked.
- Non-probabilistic scores must not receive Brier/log-loss/ECE.
