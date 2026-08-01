import assert from "node:assert/strict";
import test from "node:test";
import { AnalyticsService, createAnalyticsSessionId, detectDevice } from "../lib/analytics/service";
import type { AnalyticsEvent } from "../lib/analytics/types";
import type { AnalyticsProvider } from "../lib/analytics/providers";

class CapturingProvider implements AnalyticsProvider {
  readonly name = "test";
  events: AnalyticsEvent[] = [];

  async track(event: AnalyticsEvent): Promise<void> {
    this.events.push(event);
  }
}

test("enriches typed events with shared analytics context", async () => {
  const provider = new CapturingProvider();
  const analytics = new AnalyticsService(provider, {
    country: "NG",
    country_source: "geo",
    locale: "en",
    device: "mobile",
    referrer: "https://example.test/search",
    session_id: "session-1",
  });
  await analytics.track({
    event_name: "operator_click",
    fixture_id: 42,
    market: "over15",
    operator_slug: "1xbet",
    user_id: null,
  });
  assert.equal(provider.events.length, 1);
  assert.deepEqual(provider.events[0], {
    event_name: "operator_click",
    fixture_id: 42,
    market: "over15",
    operator_slug: "1xbet",
    user_id: null,
    properties: {
      resolved_country: "NG",
      country_source: "geo",
    },
    country: "NG",
    country_source: "geo",
    locale: "en",
    device: "mobile",
    referrer: "https://example.test/search",
    session_id: "session-1",
    timestamp: provider.events[0].timestamp,
  });
  assert.ok(!Number.isNaN(Date.parse(provider.events[0].timestamp)));
});

test("classifies device categories without collecting user agent data", () => {
  assert.equal(detectDevice("Mozilla/5.0 (iPhone)"), "mobile");
  assert.equal(detectDevice("Mozilla/5.0 (iPad)"), "tablet");
  assert.equal(detectDevice("Mozilla/5.0 (X11; Linux x86_64)"), "desktop");
  assert.equal(detectDevice(""), "unknown");
});

test("creates opaque analytics session identifiers", () => {
  assert.match(createAnalyticsSessionId(), /^[a-zA-Z0-9-]{8,128}$/);
});
