import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  AFFILIATE_PLACEMENTS,
  affiliateToCsv,
  affiliateToJson,
  buildAffiliateFunnels,
  buildCampaignInventory,
  buildOperatorRegistry,
  clientMayOverride,
  diagnoseRedirectContracts,
  placementById,
  resolveOperatorAvailabilityDecision,
  scoreOperatorQuality,
  validateAttribution,
} from "../lib/affiliate-intelligence";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("sprint 23 affiliate intelligence files exist", () => {
  for (const rel of [
    "lib/affiliate-intelligence/contracts.ts",
    "lib/affiliate-intelligence/availability.ts",
    "lib/affiliate-intelligence/placements.ts",
    "lib/affiliate-intelligence/service.ts",
    "app/api/admin/affiliate/route.ts",
    "app/api/admin/affiliate/export/route.ts",
    "app/admin/affiliate/overview/page.tsx",
    "app/admin/affiliate/operators/page.tsx",
    "app/admin/affiliate/placements/page.tsx",
    "docs/affiliate-intelligence.md",
    "docs/affiliate-operator-registry.md",
    "docs/affiliate-placement-contracts.md",
    "docs/affiliate-attribution.md",
    "docs/affiliate-funnels.md",
    "docs/affiliate-quality-rules.md",
    "docs/sprint-23-completion-report.md",
  ]) {
    assert.ok(existsSync(path.join(root, rel)), rel);
  }
});

test("availability never treats UNKNOWN as AVAILABLE", () => {
  const unknown = resolveOperatorAvailabilityDecision({
    affiliateEnabled: true,
    destinationConfigured: true,
    supportedCountries: ["GB"],
    visitorCountry: null,
    featureOperatorsVisible: true,
    signingSecretPresent: true,
    verificationStatus: "verified",
  });
  assert.equal(unknown.decision, "UNKNOWN");
  assert.ok(unknown.reasonCodes.includes("UNKNOWN_GEO"));

  const blocked = resolveOperatorAvailabilityDecision({
    affiliateEnabled: true,
    destinationConfigured: true,
    supportedCountries: ["GB"],
    visitorCountry: "TR",
    featureOperatorsVisible: true,
    signingSecretPresent: true,
    verificationStatus: "verified",
  });
  assert.equal(blocked.decision, "UNAVAILABLE");
  assert.ok(blocked.reasonCodes.includes("COUNTRY_BLOCKED"));
});

test("placement inventory covers match, studio, builder, go", () => {
  assert.ok(placementById("fixture_operator"));
  assert.ok(placementById("acca_studio"));
  assert.ok(placementById("acca_builder_handoff"));
  assert.ok(placementById("go_redirect_fallback"));
  assert.ok(AFFILIATE_PLACEMENTS.length >= 10);
  const builder = placementById("acca_builder_handoff");
  assert.equal(builder?.signingMethod.includes("none"), true);
});

test("attribution validation rejects secrets and allows protected fields", () => {
  const bad = validateAttribution({
    placement: "fixture_operator",
    operator: "1xbet",
    token: "abc.def.ghi",
  });
  assert.equal(bad.ok, true);
  assert.ok(bad.warnings.some((w) => w.includes("dropped_unknown_field")));

  const secret = validateAttribution({
    placement: "fixture_operator",
    operator: "1xbet",
    campaign: "Bearer supersecret",
  });
  assert.equal(secret.ok, false);
  assert.equal(clientMayOverride("operator"), false);
  assert.equal(clientMayOverride("locale"), true);
});

test("operator registry and campaigns are honest about gaps", () => {
  const ops = buildOperatorRegistry(null);
  assert.ok(ops.length >= 1);
  assert.ok(ops.every((o) => o.availabilityDecision !== undefined));
  const campaigns = buildCampaignInventory();
  assert.equal(campaigns.length, ops.length);
  assert.ok(
    campaigns.every((c) =>
      c.notes.some((n) => /No fabricated bonus/i.test(n))
    )
  );
});

test("funnels use real events and do not claim FTD", () => {
  const funnels = buildAffiliateFunnels([
    {
      event_name: "operator_click",
      fixture_id: null,
      market: null,
      operator_slug: "1xbet",
      country: null,
      country_source: null,
      locale: "en",
      device: "desktop",
      referrer: null,
      timestamp: "2026-07-26T00:00:00.000Z",
      session_id: "s",
      user_id: null,
    },
    {
      event_name: "go_redirect",
      fixture_id: null,
      market: null,
      operator_slug: "1xbet",
      country: null,
      country_source: null,
      locale: "en",
      device: "desktop",
      referrer: null,
      timestamp: "2026-07-26T00:00:01.000Z",
      session_id: "s",
      user_id: null,
    },
  ]);
  assert.ok(funnels.some((f) => f.id === "match_research"));
  assert.ok(funnels.some((f) => f.id === "acca_builder"));
  for (const f of funnels) {
    assert.ok(
      f.notes.some((n) => /FTD|postback|Studio/i.test(n)) ||
        f.id === "discovery"
    );
  }
});

test("quality score is internal-only purpose", () => {
  const ops = buildOperatorRegistry("GB");
  const q = scoreOperatorQuality(ops[0]!);
  assert.equal(q.purpose, "internal_operational_only");
  assert.ok(q.components.length >= 4);
});

test("redirect diagnostics enforce server-only signing", () => {
  const d = diagnoseRedirectContracts();
  assert.equal(d.goPathServerOnly, true);
  assert.equal(d.redirectTokenServerOnly, true);
  assert.equal(d.signOffersServerOnly, true);
});

test("exports redact secrets and signed hrefs", () => {
  const csv = affiliateToCsv("operators", [
    { operatorId: "x", signedHref: "/go/secret", secret: "nope" },
  ]);
  assert.doesNotMatch(csv, /nope|secret/);
  const json = affiliateToJson("redirects", {
    token: "aaaa.bbbb.cccc",
    ok: true,
  });
  assert.doesNotMatch(json, /aaaa\.bbbb/);
});

test("admin affiliate API requires auth and robots", () => {
  const api = readFileSync(
    path.join(root, "app/api/admin/affiliate/route.ts"),
    "utf8"
  );
  assert.match(api, /requireAdminAccess/);
  assert.match(api, /noarchive/);
  assert.match(api, /rateLimit/);
});

test("go route still rejects client destination overrides", () => {
  const go = readFileSync(
    path.join(root, "app/go/[brand]/route.ts"),
    "utf8"
  );
  assert.match(go, /destination/);
  assert.match(go, /server-only|verifyRedirectToken|signRedirect|ctx/i);
});
