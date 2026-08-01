# Acca Builder methodology

Risk labels are **configuration profiles**, not outcome guarantees.

Source of truth: `lib/acca-builder/config.ts` → `RISK_MODE_RULES`.

## Risk mode thresholds

| Mode | Min confidence | Max legs | Min evidence completeness | Markets |
|------|----------------|----------|---------------------------|---------|
| Conservative | 78 | 3 | 70 | over15, over25, fh |
| Balanced | 70 | 5 | 55 | over15, over25, fh, sh |
| Aggressive | 62 | 8 | 40 | over15, over25, fh, sh |

Hard gates still apply in every mode (published prediction, kickoff validity, unsupported market exclusion, conflict rules, odds required when target-odds mode is set).

## Scoring (deterministic)

Weighted parts in `lib/acca-builder/scoring.ts`:

| Component | Role |
|-----------|------|
| confidence × 0.55 | Published list probability |
| evidence × 0.25 | Completeness of factual fields |
| oddsPresence | +12 when observed decimal exists |
| oddsFresh | +8 current / −6 stale (>30 min) |
| kickoffSoon | Time-to-kickoff bonus/penalty |
| marketPreference | Mild preference for earlier markets in config |

Same snapshot + config + `now` → same ranked output. No randomization.

## Conflicts & correlation

| Rule | Behavior |
|------|----------|
| Duplicate selection id | Exclude |
| Same market on same fixture | Exclude |
| One selection per fixture (default) | Exclude additional legs |
| Same-fixture multi-market (if allowed) | Warning + score penalty |
| Over 2.5 + Over 1.5 same match | Dependency warning |
| FH + FT goal markets | Dependency warning |

No claim of mathematically exact correlation-adjusted probability.

## Odds

- Decimal only; never invent  
- Stale if fetchedAt age > 30 minutes  
- Target-odds mode requires real odds on every candidate  
- Combined odds via Acca Studio `combinedDecimalOdds`  

## History / archive

Archive attachment is **skipped** in Sprint 19.5 generation until defensible sample gates are wired into the snapshot. When used later, metrics must show won/lost/void/n/window/updated. No ROI without complete historical odds methodology.

Sprint 24 Calibration Intelligence evaluates mode configuration ordering and generation analytics only. It does **not** auto-adjust `RISK_MODE_RULES` or scoring weights from retrospective settlement.

## Markets in scope

Only list-published markets with Acca Studio + settlement support:

- Over 1.5 (`over15`)
- Over 2.5 (`over25`)
- First-half over 0.5 (`fh`)
- Second-half over 0.5 (`sh`)

BTTS / match winner remain Acca Studio manual markets when published on match pages; they are **not** auto-built until a verified published list/provider path exists.
