import "server-only";
import { promises as fs } from "fs";
import path from "path";
import type { LedgerEventBase } from "../contracts";

const LEDGER_DIR = path.join(process.cwd(), "data", "decision-ledger");
const EVENTS_FILE = path.join(LEDGER_DIR, "events.ndjson");
const INDEX_FILE = path.join(LEDGER_DIR, "idempotency.index.json");

type IdempotencyIndex = Record<string, string>; // key -> eventId

async function ensureDir(): Promise<void> {
  await fs.mkdir(LEDGER_DIR, { recursive: true });
}

async function readIndex(): Promise<IdempotencyIndex> {
  try {
    const raw = await fs.readFile(INDEX_FILE, "utf8");
    return JSON.parse(raw) as IdempotencyIndex;
  } catch {
    return {};
  }
}

async function writeIndex(index: IdempotencyIndex): Promise<void> {
  await ensureDir();
  const tmp = INDEX_FILE + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(index), "utf8");
  await fs.rename(tmp, INDEX_FILE);
}

export async function readAllEvents(limit = 50_000): Promise<LedgerEventBase[]> {
  try {
    const raw = await fs.readFile(EVENTS_FILE, "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .slice(-limit)
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as LedgerEventBase];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}

export async function findByIdempotencyKey(
  key: string,
): Promise<LedgerEventBase | null> {
  const index = await readIndex();
  const eventId = index[key];
  if (!eventId) return null;
  const events = await readAllEvents();
  return events.find((e) => e.eventId === eventId) ?? null;
}

export async function lastEventForAggregate(
  aggregateId: string,
): Promise<LedgerEventBase | null> {
  const events = await readAllEvents();
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].aggregateId === aggregateId) return events[i];
  }
  return null;
}

/**
 * Append-only write. Idempotent on idempotencyKey.
 * File-level: appendFile is not multi-writer transactional — document last-writer risks.
 */
export async function appendEventFile(
  event: LedgerEventBase,
): Promise<{ appended: boolean; event: LedgerEventBase; duplicate: boolean }> {
  await ensureDir();
  const existing = await findByIdempotencyKey(event.idempotencyKey);
  if (existing) {
    return { appended: false, event: existing, duplicate: true };
  }

  const index = await readIndex();
  index[event.idempotencyKey] = event.eventId;
  await fs.appendFile(EVENTS_FILE, `${JSON.stringify(event)}\n`, "utf8");
  await writeIndex(index);
  return { appended: true, event, duplicate: false };
}

export function ledgerDataPaths() {
  return { dir: LEDGER_DIR, events: EVENTS_FILE, index: INDEX_FILE };
}
