import type { FixtureOdds } from "@/lib/api-football/odds";
import { MemoryOddsHistoryStore } from "./memory";
import { PostgresOddsHistoryStore } from "./postgres";
import type {
  OddsHistoryQuery,
  OddsHistoryReader,
  OddsHistoryRecord,
  OddsHistoryStore,
} from "./types";

const canonicalLines: Record<FixtureOdds["markets"][number]["key"], string> = {
  fh: "0.5",
  over15: "1.5",
  over25: "2.5",
  sh: "0.5",
};

let postgresStore: PostgresOddsHistoryStore | undefined;
let memoryStore: MemoryOddsHistoryStore | undefined;

function getMemoryStore(): MemoryOddsHistoryStore {
  memoryStore ??= new MemoryOddsHistoryStore();
  return memoryStore;
}

function getPostgresStore(): PostgresOddsHistoryStore | undefined {
  const connectionString = process.env.ODDS_HISTORY_DATABASE_URL;
  if (!connectionString) return undefined;
  postgresStore ??= new PostgresOddsHistoryStore(connectionString);
  return postgresStore;
}

function getOddsHistoryStore(): OddsHistoryStore {
  return getPostgresStore() ?? getMemoryStore();
}

export function getOddsHistoryReader(): OddsHistoryReader {
  const postgres = getPostgresStore();
  if (postgres) return postgres;
  return getMemoryStore();
}

export function recordsFromFixtureOdds(odds: FixtureOdds): OddsHistoryRecord[] {
  return odds.markets.flatMap((market) =>
    market.bookmakers.map((bookmaker) => ({
      fixtureId: odds.fixtureId,
      operatorId: bookmaker.id,
      operatorName: bookmaker.name,
      market: market.key,
      line: canonicalLines[market.key],
      odd: bookmaker.decimal,
      timestamp: odds.fetchedAt,
    }))
  );
}

export async function appendFixtureOddsHistory(odds: FixtureOdds): Promise<void> {
  const historyStore = getOddsHistoryStore();
  await historyStore.append(recordsFromFixtureOdds(odds));
}

export async function queryOddsHistory(input: OddsHistoryQuery): Promise<OddsHistoryRecord[]> {
  return getOddsHistoryReader().query(input);
}

/** Test helper — reset in-memory fallback. */
export function resetMemoryOddsHistoryForTests(): void {
  memoryStore = new MemoryOddsHistoryStore();
  postgresStore = undefined;
}
