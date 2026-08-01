import assert from "node:assert/strict";
import test from "node:test";
import { ClosingLineValueService } from "../lib/odds-history/closingLineValue";

const service = new ClosingLineValueService();

test("calculates positive CLV when current odds beat the close", () => {
  const result = service.calculate({ opening: 2.1, current: 2, closing: 1.8 });
  assert.equal(result.clvPercent, 11.111111111111116);
  assert.equal(result.direction, "positive");
  assert.equal(result.openingToCurrentPercent, 5.000000000000004);
  assert.equal(result.openingToClosingPercent, 16.666666666666675);
});

test("calculates negative and neutral CLV correctly", () => {
  assert.equal(service.calculate({ opening: 1.9, current: 1.75, closing: 1.8 }).direction, "negative");
  assert.equal(service.calculate({ opening: 1.9, current: 1.8, closing: 1.8 }).direction, "neutral");
});

test("rejects invalid decimal odds", () => {
  assert.throws(() => service.calculate({ opening: 1, current: 2, closing: 1.9 }), RangeError);
});
