import { promises as fs } from "fs";
import path from "path";
import type { AnalyticsProvider } from "./providers";
import type { AnalyticsEvent } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const ANALYTICS_EVENTS_FILE = path.join(DATA_DIR, "analytics-events.log");

export class FileAnalytics implements AnalyticsProvider {
  readonly name = "file";

  async track(event: AnalyticsEvent): Promise<void> {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.appendFile(ANALYTICS_EVENTS_FILE, `${JSON.stringify(event)}\n`, "utf8");
  }
}

export async function readTrackedAnalyticsEvents(limit = 100_000): Promise<AnalyticsEvent[]> {
  try {
    const raw = await fs.readFile(ANALYTICS_EVENTS_FILE, "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .slice(-limit)
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as AnalyticsEvent];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}
