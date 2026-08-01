import {
  CompositeAnalytics,
  ConsoleAnalytics,
  SelfHostedAnalytics,
  type AnalyticsProvider,
} from "./providers";
import type { AnalyticsCountrySource, AnalyticsEvent, AnalyticsEventInput } from "./types";

export function createAnalyticsSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function detectDevice(userAgent: string): AnalyticsEvent["device"] {
  const source = userAgent.toLowerCase();
  if (/ipad|tablet/.test(source)) return "tablet";
  if (/android|iphone|ipod|mobile/.test(source)) return "mobile";
  if (source) return "desktop";
  return "unknown";
}

export function createSessionId(storage?: Storage): string {
  const key = "rankwagers.analytics.session_id";
  const existing = storage?.getItem(key);
  if (existing) return existing;
  const created = createAnalyticsSessionId();
  storage?.setItem(key, created);
  return created;
}

function readBrowserCountry(): {
  country: string | null;
  country_source: AnalyticsCountrySource | null;
} {
  if (typeof document === "undefined") {
    return { country: null, country_source: null };
  }
  const cookie = document.cookie || "";
  const countryMatch = cookie.match(/(?:^|; )rw_country=([A-Za-z]{2})(?:;|$)/);
  const sourceMatch = cookie.match(/(?:^|; )rw_country_source=([a-z]+)(?:;|$)/);
  const country = countryMatch?.[1]?.toUpperCase() ?? null;
  const sourceRaw = sourceMatch?.[1] ?? null;
  const country_source =
    sourceRaw === "override" ||
    sourceRaw === "cookie" ||
    sourceRaw === "geo" ||
    sourceRaw === "unknown"
      ? sourceRaw
      : country
        ? "cookie"
        : null;
  return { country, country_source };
}

export class AnalyticsService {
  constructor(
    private readonly provider: AnalyticsProvider,
    private readonly context: Pick<
      AnalyticsEvent,
      "country" | "country_source" | "locale" | "device" | "referrer" | "session_id"
    >
  ) {}

  async track(input: AnalyticsEventInput): Promise<void> {
    const country = input.country ?? this.context.country;
    const country_source = input.country_source ?? this.context.country_source;
    const event: AnalyticsEvent = {
      event_name: input.event_name,
      fixture_id: input.fixture_id,
      market: input.market,
      operator_slug: input.operator_slug,
      user_id: input.user_id,
      country,
      country_source,
      locale: input.locale ?? this.context.locale,
      device: input.device ?? this.context.device,
      referrer: input.referrer ?? this.context.referrer,
      session_id: input.session_id ?? this.context.session_id,
      timestamp: input.timestamp ?? new Date().toISOString(),
      properties: {
        ...input.properties,
        resolved_country: country,
        country_source,
      },
    };
    await this.provider.track(event);
  }
}

export function createBrowserAnalytics(): AnalyticsService {
  const browserWindow = typeof window === "undefined" ? undefined : window;
  const { country, country_source } = readBrowserCountry();
  return new AnalyticsService(new CompositeAnalytics([
    new ConsoleAnalytics(),
    new SelfHostedAnalytics("/api/analytics"),
  ]), {
    country,
    country_source,
    locale: browserWindow?.document.documentElement.lang ?? null,
    device: detectDevice(browserWindow?.navigator.userAgent ?? ""),
    referrer: browserWindow?.document.referrer || null,
    session_id: createSessionId(browserWindow?.sessionStorage),
  });
}
