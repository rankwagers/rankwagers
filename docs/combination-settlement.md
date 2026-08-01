# Combination settlement rules (v24.0.0)

Deterministic classifier in `lib/calibration-intelligence/combination-evaluation.ts`:

| Result | Rule |
|--------|------|
| `INVALID` | No legs |
| `UNRESOLVED` | Any leg unresolved |
| `PENDING` | Any leg pending (else) |
| `LOST` | Any leg lost |
| `VOID` | All legs void |
| `PARTIAL_VOID` | Some void, all non-void legs won |
| `WON` | All legs won (no voids) |

## Financial metrics

`financialMetricsAvailable` requires every leg to have valid historical odds.

If odds are missing: show settlement outcome when linkable, mark ROI **Unavailable**. Never fabricate odds.
