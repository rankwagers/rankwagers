"use client";

import { trackAnalyticsEvent } from "./client";
import type { GraphEntityType } from "@/lib/knowledge-graph/entity";

export function trackEntityView(input: {
  entityType: GraphEntityType;
  entitySlug: string;
  locale: string;
}): void {
  trackAnalyticsEvent({
    event_name: "entity_view",
    fixture_id: null,
    market: input.entityType === "market" ? input.entitySlug : null,
    operator_slug: input.entityType === "operator" ? input.entitySlug : null,
    locale: input.locale,
    user_id: null,
    properties: {
      entity_type: input.entityType,
      entity_slug: input.entitySlug,
    },
  });
}

export function trackEntityNavigation(input: {
  fromType: GraphEntityType;
  fromSlug: string;
  toType: GraphEntityType;
  toSlug: string;
  locale: string;
}): void {
  trackAnalyticsEvent({
    event_name: "entity_navigation",
    fixture_id: null,
    market: null,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
    properties: {
      from_type: input.fromType,
      from_slug: input.fromSlug,
      to_type: input.toType,
      to_slug: input.toSlug,
    },
  });
}

export function trackRelatedClick(input: {
  fromType: GraphEntityType;
  fromSlug: string;
  toType: GraphEntityType;
  toSlug: string;
  locale: string;
}): void {
  trackAnalyticsEvent({
    event_name: "related_click",
    fixture_id: null,
    market: null,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
    properties: {
      from_type: input.fromType,
      from_slug: input.fromSlug,
      to_type: input.toType,
      to_slug: input.toSlug,
    },
  });
}

export function trackGraphNavigation(input: {
  fromType: GraphEntityType;
  fromSlug: string;
  toType: GraphEntityType;
  toSlug: string;
  section: string;
  locale: string;
}): void {
  trackAnalyticsEvent({
    event_name: "graph_navigation",
    fixture_id: null,
    market: null,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
    properties: {
      from_type: input.fromType,
      from_slug: input.fromSlug,
      to_type: input.toType,
      to_slug: input.toSlug,
      section: input.section,
    },
  });
}

export function trackRecommendationClick(input: {
  fromType: GraphEntityType;
  fromSlug: string;
  toType: GraphEntityType;
  toSlug: string;
  locale: string;
}): void {
  trackAnalyticsEvent({
    event_name: "recommendation_click",
    fixture_id: null,
    market: null,
    operator_slug: null,
    locale: input.locale,
    user_id: null,
    properties: {
      from_type: input.fromType,
      from_slug: input.fromSlug,
      to_type: input.toType,
      to_slug: input.toSlug,
    },
  });
}
