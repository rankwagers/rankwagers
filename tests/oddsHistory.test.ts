import assert from "node:assert/strict";
import test from "node:test";
import { recordsFromFixtureOdds } from "../lib/odds-history/service";

test("creates append-only records for every imported bookmaker market", () => {
  const records = recordsFromFixtureOdds({
    fixtureId: 52,
    fetchedAt: "2026-07-24T18:00:00.000Z",
    coverage: "partial",
    markets: [
      {
        key: "over15",
        label: "Over 1.5 Goals",
        bookmakers: [
          { id: 7, name: "Operator One", decimal: 1.61 },
          { id: 9, name: "Operator Two", decimal: 1.58 },
        ],
      },
      {
        key: "fh",
        label: "1st Half Over 0.5",
        bookmakers: [{ id: 7, name: "Operator One", decimal: 1.22 }],
      },
    ],
  });

  assert.deepEqual(records, [
    { fixtureId: 52, operatorId: 7, operatorName: "Operator One", market: "over15", line: "1.5", odd: 1.61, timestamp: "2026-07-24T18:00:00.000Z" },
    { fixtureId: 52, operatorId: 9, operatorName: "Operator Two", market: "over15", line: "1.5", odd: 1.58, timestamp: "2026-07-24T18:00:00.000Z" },
    { fixtureId: 52, operatorId: 7, operatorName: "Operator One", market: "fh", line: "0.5", odd: 1.22, timestamp: "2026-07-24T18:00:00.000Z" },
  ]);
});
