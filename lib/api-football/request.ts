import { executeProviderCallSoft } from "@/lib/providers/reliability";
import { getApiFootballKey } from "./enrich";

const BASE = "https://v3.football.api-sports.io";

export async function apiFootballGet<T>(
  endpoint: string,
  params: Record<string, string> = {},
  options?: { operation?: "odds_fetch" | "fixture_list" | "fixture_detail" | "generic" }
): Promise<T | null> {
  const key = getApiFootballKey();
  if (!key) return null;

  const url = new URL(`${BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  return executeProviderCallSoft<T>({
    provider: "api-football",
    operation: options?.operation ?? "generic",
    endpoint,
    interactive: options?.operation === "odds_fetch",
    fetch: (signal) =>
      fetch(url.toString(), {
        headers: { "x-apisports-key": key },
        signal,
        next: { revalidate: 0 },
      }),
    parse: (res) => res.json() as Promise<T>,
  });
}
