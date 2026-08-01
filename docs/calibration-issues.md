# Calibration issues

Severities: `CRITICAL` | `HIGH` | `MEDIUM` | `LOW` | `INFO`

Each issue includes: code, severity, cohort, factual explanation, sample size, detected timestamp, remediation, status.

## Example codes

| Code | Typical severity |
|------|------------------|
| `PUBLICATION_SNAPSHOT_MUTABLE` | HIGH |
| `CONFIDENCE_SEMANTICS_UNKNOWN` | CRITICAL |
| `BUILDER_COMBINATION_SNAPSHOTS_MISSING` | HIGH |
| `ODDS_DEPENDENT_METRIC_UNAVAILABLE` | MEDIUM |
| `SEVERE_OVERCONFIDENCE` / `SEVERE_UNDERCONFIDENCE` | HIGH |
| `CALIBRATION_INVERSION` | HIGH |
| `BUILDER_MODE_CONFIGURATION_DRIFT` | CRITICAL |
| `MATERIAL_DRIFT` | MEDIUM |
| `EXCESSIVE_UNRESOLVED` | MEDIUM |
| `INSUFFICIENT_DATA_FOR_CLAIMED_METRIC` | INFO |

## Remediation policy

Issues are **review-required**. The system does not apply destructive or automatic configuration fixes.
