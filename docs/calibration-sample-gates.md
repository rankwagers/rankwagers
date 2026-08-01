# Calibration sample gates

Statuses: `INSUFFICIENT` → `EARLY_SIGNAL` → `REVIEWABLE` → `RELIABLE`

## Hit-rate style metrics

| Status | Settled W+L |
|--------|-------------|
| INSUFFICIENT | ≤ 19 |
| EARLY_SIGNAL | ≤ 49 |
| REVIEWABLE | ≤ 99 |
| RELIABLE | ≥ 100 |

## Calibration metrics (Brier / ECE)

| Status | Settled W+L with confidence |
|--------|-----------------------------|
| INSUFFICIENT | ≤ 49 |
| EARLY_SIGNAL | ≤ 99 |
| REVIEWABLE | ≤ 199 |
| RELIABLE | ≥ 200 |

## Combination settlement

| Status | Settled combinations |
|--------|----------------------|
| INSUFFICIENT | ≤ 29 |
| EARLY_SIGNAL | ≤ 74 |
| REVIEWABLE | ≤ 149 |
| RELIABLE | ≥ 150 |

Never label a small sample as reliable. Always show published, settled, W/L/void, window.
