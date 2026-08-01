import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import path from "node:path";
import { analyticsEventNames } from "../lib/analytics/types";
import { resolveOperatorAvailability } from "../lib/operators/availability";
import {
  operatorAffiliateHref,
  operatorPath,
  operatorsIndexPath,
} from "../lib/operators/links";
import {
  buildOperatorOddsPerformance,
  recordsForOperator,
} from "../lib/operators/performance";
import {
  getOperator,
  listOperators,
  listRelatedOperators,
  operatorSlugs,
} from "../lib/operators/registry";
import {
  operatorBreadcrumbLd,
  operatorWebPageLd,
  operatorsIndexLd,
} from "../lib/operators/schema";
import { pageMetadata } from "../lib/seo";
import type { OddsHistoryRecord } from "../lib/odds-history/types";

test("operator registry exposes every brand as an operator entity", () => {
  const operators = listOperators();
  assert.ok(operators.length >= 1);
  const first = getOperator(operators[0].slug);
  assert.ok(first);
  assert.equal(first?.slug, operators[0].slug);
  assert.ok(first?.supportedMarkets.includes("over15"));
  assert.ok(["verified", "unverified"].includes(first!.verificationStatus));
  assert.ok(operatorSlugs().includes("1xbet"));
});

test("operator routing helpers and related operators avoid orphans", () => {
  assert.equal(operatorsIndexPath("en"), "/en/operators");
  assert.equal(operatorPath("en", "1xbet"), "/en/operators/1xbet");
  const related = listRelatedOperators("1xbet", 3);
  assert.ok(related.every((operator) => operator.slug !== "1xbet"));
  assert.ok(
    operatorAffiliateHref(getOperator("1xbet")!, "en", "NG").startsWith("/go/1xbet")
  );
});

test("country availability uses visitor country against supported countries", () => {
  const open = getOperator("1xbet")!;
  const unrestricted = resolveOperatorAvailability(open, "NG");
  assert.equal(unrestricted.label, "Availability not restricted");

  const restricted = {
    ...open,
    supportedCountries: ["BR", "NG"] as const,
  };
  assert.equal(resolveOperatorAvailability(restricted, "NG").available, true);
  assert.equal(resolveOperatorAvailability(restricted, "JP").available, false);
  assert.equal(
    resolveOperatorAvailability(restricted, "JP").label,
    "Not currently available"
  );
});

test("odds performance uses only matching observed history", () => {
  const operator = getOperator("1xbet")!;
  const records: OddsHistoryRecord[] = [
    {
      fixtureId: 9,
      operatorId: 11,
      operatorName: "1xBet",
      market: "over15",
      line: "1.5",
      odd: 1.9,
      timestamp: "2026-07-25T10:00:00.000Z",
    },
    {
      fixtureId: 9,
      operatorId: 11,
      operatorName: "1xBet",
      market: "over15",
      line: "1.5",
      odd: 1.7,
      timestamp: "2026-07-25T12:00:00.000Z",
    },
    {
      fixtureId: 10,
      operatorId: 99,
      operatorName: "Other Book",
      market: "fh",
      line: "0.5",
      odd: 2.2,
      timestamp: "2026-07-25T11:00:00.000Z",
    },
  ];
  assert.equal(recordsForOperator(operator, records).length, 2);
  const performance = buildOperatorOddsPerformance(operator, records);
  assert.equal(performance.sampleSize, 2);
  assert.equal(performance.highestOdds, 1.9);
  assert.equal(performance.lowestOdds, 1.7);
  assert.ok(performance.averageOdds !== null);
  assert.deepEqual(performance.recentFixtureIds, [9]);
});

test("operator metadata and structured data include Organization WebPage and breadcrumbs", () => {
  const operator = getOperator("1xbet")!;
  const metadata = pageMetadata({
    locale: "en",
    path: `/operators/${operator.slug}`,
    title: `${operator.name} — operator intelligence`,
    description: "desc",
  });
  assert.ok(String(metadata.alternates?.canonical).includes("/en/operators/1xbet"));
  assert.equal(metadata.openGraph?.title, `${operator.name} — operator intelligence`);
  assert.ok(metadata.twitter);

  const webPage = operatorWebPageLd({
    operator,
    locale: "en",
    description: "desc",
  });
  assert.equal(webPage["@type"], "WebPage");
  assert.equal((webPage.about as { "@type": string })["@type"], "Organization");

  const crumbs = operatorBreadcrumbLd({ operator, locale: "en" });
  assert.equal(crumbs["@type"], "BreadcrumbList");
  assert.equal((crumbs.itemListElement as unknown[]).length, 3);

  const indexLd = operatorsIndexLd({ locale: "en", operators: [operator] });
  assert.equal(indexLd["@type"], "ItemList");
});

test("operator page routes and analytics event names exist", () => {
  const root = process.cwd();
  assert.equal(existsSync(path.join(root, "app", "[locale]", "operators", "page.tsx")), true);
  assert.equal(
    existsSync(path.join(root, "app", "[locale]", "operators", "[slug]", "page.tsx")),
    true
  );
  for (const eventName of [
    "operator_page_view",
    "operator_affiliate_cta_click",
    "operator_odds_panel_interaction",
    "operator_related_click",
  ] as const) {
    assert.ok(analyticsEventNames.includes(eventName), eventName);
  }
});
