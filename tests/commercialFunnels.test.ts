import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * THE COMMERCIAL CONVERSION — Phase D probes: funnel/placement wiring, the
 * settlement systemd mirror, and the legacy-component deletion.
 */

/* eslint-disable @typescript-eslint/no-var-requires */
const { AFFILIATE_PLACEMENTS } =
  require("../lib/affiliate-intelligence/placements") as typeof import("../lib/affiliate-intelligence/placements");

const root = process.cwd();
const SRC = (rel: string) => readFileSync(path.join(root, rel), "utf8");

test("every conversion point is a registered placement; the retired one is gone", () => {
  const ids = AFFILIATE_PLACEMENTS.map((record) => record.placementId);
  for (const required of ["price_panel", "operator_card_fixture", "post_l2_bridge", "acca_studio", "operator_page"]) {
    assert.ok(ids.includes(required), `missing placement: ${required}`);
  }
  assert.equal(ids.includes("brand_list"), false, "the retired brand_list row is a false signal");
  assert.equal(new Set(ids).size, ids.length, "placement ids are unique");
});

test("the L5 cards emit their surface as the placement", () => {
  assert.match(
    SRC("components/operators/OperatorEvidenceCard.tsx"),
    /operatorAffiliateHref\(operator, locale, country, `operator_card_\$\{surface\}`\)/
  );
});

test("the settlement systemd units are mirrored with the production-stated values", () => {
  const service = SRC("deploy/systemd/rankwagers-prediction-settlement.service");
  const timer = SRC("deploy/systemd/rankwagers-prediction-settlement.timer");
  assert.match(service, /prediction-settlement/);
  assert.match(service, /Type=oneshot/);
  assert.match(service, /x-cron-secret/);
  assert.match(service, /RECONSTRUCTED/, "the assumptions are stated, not hidden");
  assert.match(timer, /OnCalendar=\*:15,45/, "the production-stated schedule");
  assert.match(timer, /Persistent=true/, "the production-stated catch-up behaviour");
  assert.match(timer, /Unit=rankwagers-prediction-settlement\.service/);
});

test("the legacy commercial components are deleted, not merely unreferenced", () => {
  for (const gone of [
    "components/StarRating.tsx",
    "components/ScoreBox.tsx",
    "components/StickyCta.tsx",
    "components/BrandList.tsx",
    "components/BrandListSection.tsx",
    "components/AffiliateHomeContent.tsx",
  ]) {
    assert.equal(existsSync(path.join(root, gone)), false, `${gone} still exists`);
  }
});
