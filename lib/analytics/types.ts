export const analyticsEventNames = [
  "fixture_view",
  "fixture_expand",
  "match_detail_viewed",
  "match_prediction_expanded",
  "match_evidence_viewed",
  "match_detail_retry",
  "match_related_click",
  "market_selected",
  "operator_impression",
  "operator_click",
  "partner_list_expand",
  "review_click",
  "go_redirect",
  "search",
  "filter_change",
  "homepage_navigation",
  "homepage_viewed",
  "pagination",
  "search_started",
  "search_submitted",
  "search_result_clicked",
  "search_no_results",
  "search_open",
  "search_query",
  "search_result_click",
  "search_empty",
  "search_filter",
  "search_keyboard_navigation",
  "search_group_expand",
  "live_signals_nav_clicked",
  "live_signal_card_clicked",
  "fixture_impression",
  "live_signal_impression",
  "pagination_clicked",
  "pagination_page_viewed",
  "homepage_section_impression",
  "homepage_section_click",
  "scroll_depth",
  "fixture_time_spent",
  "page_exit",
  "funnel_step",
  "odds_history_viewed",
  "odds_chart_viewed",
  "odds_timeline_expanded",
  "odds_operator_compared",
  "odds_clv_viewed",
  "odds_movement_interaction",
  "operator_page_view",
  "operator_affiliate_cta_click",
  "operator_odds_panel_interaction",
  "operator_related_click",
  "market_page_view",
  "market_related_fixture_click",
  "market_related_operator_click",
  "market_odds_interaction",
  "market_evidence_expansion",
  "market_cta_interaction",
  "competition_page_view",
  "competition_fixture_click",
  "competition_market_click",
  "competition_operator_click",
  "competition_odds_interaction",
  "team_page_view",
  "team_fixture_click",
  "team_competition_click",
  "team_market_click",
  "team_operator_click",
  "team_evidence_expand",
  "team_related_click",
  "season_page_view",
  "season_fixture_click",
  "season_team_click",
  "season_market_click",
  "season_operator_click",
  "season_graph_navigation",
  "entity_view",
  "entity_navigation",
  "related_click",
  "graph_navigation",
  "recommendation_click",
  "recommendation_impression",
  "continue_exploring_click",
  "recent_click",
  "popular_click",
  "evidence_expand",
  "evidence_compare",
  "baseline_view",
  "qualification_view",
  "split_toggle",
  "source_view",
  "combo_studio_view",
  "combo_builder_start",
  "combo_target_select",
  "combo_custom_target_set",
  "combo_risk_profile_select",
  "combo_market_select",
  "combo_selection_limit_set",
  "combo_advanced_filter_set",
  "combo_generate_start",
  "combo_generate_success",
  "combo_generate_failure",
  "combo_result_view",
  "combo_selection_expand",
  "combo_selection_replace_start",
  "combo_selection_replace_success",
  "combo_selection_replace_failure",
  "combo_selection_remove",
  "combo_regenerate",
  "combo_alternative_view",
  "combo_alternative_select",
  "combo_copy",
  "combo_share",
  "combo_operator_section_view",
  "combo_operator_card_view",
  "combo_operator_compare_open",
  "combo_operator_review_open",
  "combo_operator_click",
  "combo_deeplink_click",
  "acca_opened",
  "acca_selection_added",
  "acca_selection_removed",
  "acca_cleared",
  "acca_undo",
  "acca_stake_entered",
  "acca_operator_selected",
  "acca_affiliate_handoff",
  "acca_share_clicked",
  "acca_copy_clicked",
  "acca_telegram_export",
  "acca_named_saved",
  "acca_named_loaded",
  "acca_builder_viewed",
  "acca_builder_generation_started",
  "acca_builder_generation_succeeded",
  "acca_builder_generation_failed",
  "acca_builder_no_valid_combination",
  "acca_builder_configuration_changed",
  "acca_builder_risk_mode_selected",
  "acca_builder_target_odds_selected",
  "acca_builder_combination_viewed",
  "acca_builder_leg_evidence_expanded",
  "acca_builder_added_to_studio",
  "acca_builder_merge_selected",
  "acca_builder_replace_selected",
  "acca_builder_operator_handoff",
  "acca_builder_abandoned",
  "archive_viewed",
  "archive_filter_used",
  "archive_prediction_opened",
  "archive_day_viewed",
  "methodology_viewed",
  "transparency_viewed",
  "transparency_interaction",
  "affiliate_redirect_created",
  "affiliate_redirect_completed",
  "affiliate_redirect_failed",
  // Sprint 21 — evidence-aware operator CTA layer. Rendered on fixture, competition and market
  // pages; `properties.surface` distinguishes them so CTR is comparable across templates.
  /*
   * Pre-existing, unrelated to Sprint 21. `lib/evidence/analytics.ts` and `lib/live/analytics.ts`
   * emit these names but were never registered here, so they failed the closed union. Registered
   * rather than excluded from typechecking — the union is the contract, and a module that emits an
   * unregistered event is invisible to every downstream aggregation.
   */
  "evidence_history_viewed",
  "evidence_snapshot_expanded",
  "evidence_timeline_interaction",
  "evidence_validation_viewed",
  "live_momentum_viewed",
  "live_section_viewed",
  "live_statistics_expanded",
  "live_timeline_expanded",  "operator_card_impression",
  "operator_card_primary_click",
  "operator_card_secondary_click",
  "operator_card_evidence_expand",
  "operator_availability_resolved",
  "operator_odds_resolved",
  "postback_received",
  "postback_verified",
  "postback_rejected",
  "affiliate_registration",
  "affiliate_ftd",
  "affiliate_revenue",
  "affiliate_chargeback",
  /*
   * Sprint 24 — public Acca pages.
   *
   * Distinct from the `acca_*` and `acca_builder_*` names above, which measure the client-side
   * Studio slip and the generation Builder. These measure the PUBLISHED, crawlable reader surface
   * at `/{locale}/accas`. `properties.surface` is `acca_index` or `acca_detail`, so the two pages
   * stay comparable without a second event vocabulary.
   */
  "acca_index_view",
  "acca_card_impression",
  "acca_card_click",
  "acca_detail_view",
  "acca_leg_expand",
  "acca_evidence_expand",
  "acca_share_open",
  "acca_share_copy",
  "acca_share_native",
  "acca_builder_entry_click",
] as const;

export type AnalyticsEventName = (typeof analyticsEventNames)[number];

export type AnalyticsCountrySource = "override" | "cookie" | "geo" | "unknown";

export type AnalyticsEvent = {
  event_name: AnalyticsEventName;
  fixture_id: number | null;
  market: string | null;
  operator_slug: string | null;
  /** Resolved visitor country (ISO alpha-2). */
  country: string | null;
  country_source: AnalyticsCountrySource | null;
  locale: string | null;
  device: "desktop" | "mobile" | "tablet" | "unknown";
  referrer: string | null;
  timestamp: string;
  session_id: string;
  user_id: string | null;
  properties?: Record<string, string | number | boolean | null>;
};

export type AnalyticsEventInput = Pick<
  AnalyticsEvent,
  "event_name" | "fixture_id" | "market" | "operator_slug" | "user_id" | "properties"
> & Partial<
  Pick<
    AnalyticsEvent,
    "country" | "country_source" | "locale" | "device" | "referrer" | "timestamp" | "session_id"
  >
>;
