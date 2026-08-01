import type { AnalyticsEvent } from "./types";

const ANALYTICS_FETCH_TIMEOUT_MS = Number(
  process.env.ANALYTICS_FETCH_TIMEOUT_MS ?? 3_000
);

async function fetchWithTimeout(
  input: string,
  init: RequestInit
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ANALYTICS_FETCH_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface AnalyticsProvider {
  readonly name: string;
  track(event: AnalyticsEvent): Promise<void>;
}

export class CompositeAnalytics implements AnalyticsProvider {
  readonly name = "composite";

  constructor(private readonly providers: readonly AnalyticsProvider[]) {}

  async track(event: AnalyticsEvent): Promise<void> {
    await Promise.allSettled(this.providers.map((provider) => provider.track(event)));
  }
}

export class ConsoleAnalytics implements AnalyticsProvider {
  readonly name = "console";

  async track(event: AnalyticsEvent): Promise<void> {
    console.info("[analytics]", JSON.stringify(event));
  }
}

export class PostHogAnalytics implements AnalyticsProvider {
  readonly name = "posthog";

  constructor(
    private readonly apiKey: string,
    private readonly host = "https://app.posthog.com"
  ) {}

  async track(event: AnalyticsEvent): Promise<void> {
    await fetchWithTimeout(`${this.host}/capture/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: this.apiKey,
        event: event.event_name,
        distinct_id: event.user_id ?? event.session_id,
        properties: event,
        timestamp: event.timestamp,
      }),
      keepalive: true,
    });
  }
}

export class Ga4Analytics implements AnalyticsProvider {
  readonly name = "ga4";

  async track(event: AnalyticsEvent): Promise<void> {
    if (typeof window === "undefined") return;
    const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
    gtag?.("event", event.event_name, event);
  }
}

export class SelfHostedAnalytics implements AnalyticsProvider {
  readonly name = "self-hosted";

  constructor(private readonly endpoint: string) {}

  async track(event: AnalyticsEvent): Promise<void> {
    await fetchWithTimeout(this.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
      keepalive: true,
    });
  }
}
