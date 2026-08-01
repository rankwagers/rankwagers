# Affiliate funnels

Module: `lib/affiliate-intelligence/funnels.ts`

Only events that exist in the analytics catalog are used.

## 1. Match Research

match_detail_viewed / fixture_view → evidence → operator_impression → operator_click → affiliate_redirect_created → go_redirect / affiliate_redirect_completed

## 2. Acca Studio

acca_opened → selection_added → operator_selected → acca_affiliate_handoff → redirect created → resolved

## 3. Acca Builder

generation_succeeded → combination_viewed → added_to_studio → (Studio operator_selected) → redirect

Note: `acca_builder_operator_handoff` is registered but not emitted by Builder UI; handoff completes in Studio.

## 4. Discovery

homepage/search/competition → fixture → prediction expand → operator click → redirect

## Explicit non-claims

No deposit / FTD / revenue funnel steps unless verified postback adapters and events exist.
