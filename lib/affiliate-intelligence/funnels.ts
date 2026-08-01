import type { AnalyticsEvent } from "@/lib/analytics/types";
import type { FunnelDefinition, FunnelStepMetric } from "./contracts";

function countEvents(
  events: readonly AnalyticsEvent[],
  names: readonly string[]
): number {
  const set = new Set(names);
  return events.filter((e) => set.has(e.event_name)).length;
}

function step(
  label: string,
  eventNames: string[],
  events: readonly AnalyticsEvent[]
): FunnelStepMetric {
  const n = countEvents(events, eventNames);
  return {
    step: label,
    eventNames,
    count: n,
    available: true,
  };
}

/**
 * Funnels use only events that exist in the catalog / emitters.
 * No FTD/deposit steps unless postback adapters are configured.
 */
export function buildAffiliateFunnels(
  events: readonly AnalyticsEvent[]
): FunnelDefinition[] {
  const postbackCount = countEvents(events, [
    "affiliate_ftd",
    "affiliate_registration",
    "affiliate_revenue",
  ]);

  return [
    {
      id: "match_research",
      label: "Match Research Funnel",
      steps: [
        step("page_view / match open", ["match_detail_viewed", "fixture_view"], events),
        step("evidence_view", ["match_evidence_viewed", "evidence_expand"], events),
        step("operator_cta_view", ["operator_impression"], events),
        step("operator_cta_click", ["operator_click"], events),
        step("signed_redirect_created", ["affiliate_redirect_created"], events),
        step("redirect_resolved", ["affiliate_redirect_completed", "go_redirect"], events),
      ],
      notes: [
        "FTD/deposit not included — postback adapters disabled by default.",
        postbackCount
          ? `${postbackCount} postback-related events observed (not claimed as product FTD).`
          : "No postback conversion events in window.",
      ],
    },
    {
      id: "acca_studio",
      label: "Acca Studio Funnel",
      steps: [
        step("acca_opened", ["acca_opened"], events),
        step("selection_added", ["acca_selection_added"], events),
        step("operator_selected", ["acca_operator_selected"], events),
        step("handoff_started", ["acca_affiliate_handoff"], events),
        step("signed_redirect_created", ["affiliate_redirect_created"], events),
        step("redirect_resolved", ["affiliate_redirect_completed", "go_redirect"], events),
      ],
      notes: ["Studio signs /go via placement acca_studio."],
    },
    {
      id: "acca_builder",
      label: "Acca Builder Funnel",
      steps: [
        step("builder_generated", ["acca_builder_generation_succeeded"], events),
        step("combination_viewed", ["acca_builder_combination_viewed"], events),
        step("added_to_studio", ["acca_builder_added_to_studio"], events),
        step("operator_selected", ["acca_operator_selected"], events),
        {
          step: "builder_operator_handoff",
          eventNames: ["acca_builder_operator_handoff"],
          count: countEvents(events, ["acca_builder_operator_handoff"]),
          available: true,
          reason:
            "Event registered; Builder UI currently hands off via Studio (may be zero)",
        },
        step("signed_redirect_created", ["affiliate_redirect_created"], events),
        step("redirect_resolved", ["go_redirect", "affiliate_redirect_completed"], events),
      ],
      notes: [
        "Builder does not sign /go directly — Studio completes affiliate handoff.",
      ],
    },
    {
      id: "discovery",
      label: "Discovery Funnel",
      steps: [
        step(
          "homepage/search/competition",
          ["homepage_viewed", "search_open", "competition_page_view"],
          events
        ),
        step("fixture_opened", ["match_detail_viewed", "fixture_view"], events),
        step("prediction_opened", ["match_prediction_expanded"], events),
        step("operator_cta_click", ["operator_click", "competition_operator_click"], events),
        step("redirect_resolved", ["go_redirect", "affiliate_redirect_completed"], events),
      ],
      notes: [
        "competition_operator_click may open operator page without /go — counted honestly.",
      ],
    },
  ];
}
