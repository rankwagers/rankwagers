import { FileAnalytics } from "./fileProvider";
import {
  AnalyticsService,
  createAnalyticsSessionId,
  detectDevice,
} from "./service";
import type { AnalyticsCountrySource } from "./types";

export function createServerAnalytics(context: {
  country: string | null;
  country_source?: AnalyticsCountrySource | null;
  locale: string | null;
  userAgent: string;
  referrer: string | null;
  sessionId?: string;
}): AnalyticsService {
  return new AnalyticsService(new FileAnalytics(), {
    country: context.country,
    country_source: context.country_source ?? (context.country ? "geo" : "unknown"),
    locale: context.locale,
    device: detectDevice(context.userAgent),
    referrer: context.referrer,
    session_id: context.sessionId ?? createAnalyticsSessionId(),
  });
}
