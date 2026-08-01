# Experiment definition contract

Immutable fields once `RUNNING`. Changes require a new version or experiment.

Required: id, name, hypothesis, owner, status, environments, exposure unit, variants (exactly one CONTROL), allocation weights, primary metric, guardrails, sample/runtime bounds, assignment/metric/methodology versions, timestamps.

Status model: DRAFT → READY_FOR_REVIEW → APPROVED → SCHEDULED → RUNNING → PAUSED/STOPPED/COMPLETED/INVALIDATED → ARCHIVED.

Production `RUNNING` activation is blocked in Sprint 25.
