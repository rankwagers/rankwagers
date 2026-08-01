# Analytics — Acca Builder events

Full tracking plan: `docs/analytics-tracking-plan.md`.

## Acca Builder (`acca_builder_*`)

Registered in `lib/analytics/types.ts` and emitted via `lib/acca-builder/analytics.ts`:

- `acca_builder_viewed`
- `acca_builder_generation_started`
- `acca_builder_generation_succeeded`
- `acca_builder_generation_failed`
- `acca_builder_no_valid_combination`
- `acca_builder_configuration_changed`
- `acca_builder_risk_mode_selected`
- `acca_builder_target_odds_selected`
- `acca_builder_combination_viewed`
- `acca_builder_leg_evidence_expanded`
- `acca_builder_added_to_studio`
- `acca_builder_merge_selected`
- `acca_builder_replace_selected`
- `acca_builder_operator_handoff`
- `acca_builder_abandoned`

Properties are aggregate/non-personal only (risk mode, leg counts, status codes). Raw provider payloads are never transmitted.

## Admin SEO analytics (Sprint 22)

Channel: `admin_seo_analytics` via `lib/seo-intelligence/analytics.ts` — **never** mixed into public `/api/analytics`.

Events: `admin_seo_viewed`, `admin_seo_filter_changed`, `admin_seo_url_opened`, `admin_seo_issue_opened`, `admin_seo_exported`, `admin_seo_audit_started`, `admin_seo_audit_completed`, `admin_seo_audit_failed`.

Audited URL lists are not sent to third-party analytics.

## Admin Affiliate analytics (Sprint 23)

Channel: `admin_affiliate_analytics` via `lib/affiliate-intelligence/analytics.ts` — separate from public streams.

Events: `admin_affiliate_viewed`, `admin_affiliate_filter_changed`, `admin_affiliate_operator_opened`, `admin_affiliate_placement_opened`, `admin_affiliate_issue_opened`, `admin_affiliate_exported`, `admin_affiliate_audit_started`, `admin_affiliate_audit_completed`, `admin_affiliate_audit_failed`.

Do not send secrets, raw signatures, or full destination URLs to third-party analytics.

## Admin Calibration analytics (Sprint 24)

Channel: `admin_calibration_analytics` via `lib/calibration-intelligence/analytics.ts` — separate from public streams.

Events: `admin_calibration_viewed`, `admin_calibration_filter_changed`, `admin_calibration_cohort_opened`, `admin_calibration_builder_opened`, `admin_calibration_combination_opened`, `admin_calibration_issue_opened`, `admin_calibration_exported`, `admin_calibration_evaluation_started`, `admin_calibration_evaluation_completed`, `admin_calibration_evaluation_failed`.

Do not send cohort datasets or prediction records to third-party analytics.

## Admin Experiment analytics (Sprint 25)

Channel: `admin_experiment_analytics` via `lib/experimentation/analytics.ts` — separate from public streams and from experiment exposure logs.

Events: `admin_experiment_viewed`, `admin_experiment_definition_opened`, `admin_experiment_previewed`, `admin_experiment_validation_run`, `admin_experiment_analysis_run`, `admin_experiment_issue_opened`, `admin_experiment_exported`.

Do not send complete experiment datasets to third-party analytics. Preview/test traffic must not be mixed into real-user evidence.
