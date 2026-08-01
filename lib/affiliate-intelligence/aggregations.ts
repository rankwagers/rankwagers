import type {
  AffiliateFilters,
  AffiliateOverview,
  AffiliateSection,
  OperatorRegistryRow,
  PlacementRecord,
} from "./contracts";
import type { AffiliateAuditSnapshot } from "./queries";
import { filterIssues } from "./issues";

function countEvent(
  snap: AffiliateAuditSnapshot,
  names: string[]
): number {
  const set = new Set(names);
  return snap.events.filter((e) => set.has(e.event_name)).length;
}

export function buildOverview(snap: AffiliateAuditSnapshot): AffiliateOverview {
  const active = snap.operators.filter(
    (o) => o.affiliateEnabled && o.destinationConfigured
  ).length;
  const disabled = snap.operators.filter((o) => !o.affiliateEnabled).length;
  const unknown = snap.operators.filter(
    (o) => o.availabilityDecision === "UNKNOWN"
  ).length;

  const impressions = countEvent(snap, ["operator_impression"]);
  const clicks = countEvent(snap, ["operator_click"]);
  const created = countEvent(snap, ["affiliate_redirect_created"]);
  const resolved = countEvent(snap, [
    "affiliate_redirect_completed",
    "go_redirect",
  ]);
  const failures = countEvent(snap, ["affiliate_redirect_failed"]);

  const byOp = new Map<string, number>();
  for (const e of snap.events) {
    if (
      e.event_name === "go_redirect" ||
      e.event_name === "affiliate_redirect_completed"
    ) {
      const slug = e.operator_slug || "unknown";
      byOp.set(slug, (byOp.get(slug) ?? 0) + 1);
    }
  }
  const topOperators = [...byOp.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([operatorId, redirects]) => ({ operatorId, redirects }));

  const placementClicks = new Map<string, number>();
  for (const e of snap.events) {
    if (e.event_name !== "operator_click" && e.event_name !== "go_redirect") {
      continue;
    }
    const placement = String(e.properties?.placement ?? "unknown");
    placementClicks.set(placement, (placementClicks.get(placement) ?? 0) + 1);
  }
  const topPlacements = [...placementClicks.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([placementId, clicks]) => ({ placementId, clicks }));

  const broken = snap.operators
    .filter((o) => !o.destinationConfigured && o.affiliateEnabled)
    .map((o) => o.operatorId);

  const critical = snap.issues.filter((i) => i.severity === "CRITICAL").length;
  const high = snap.issues.filter((i) => i.severity === "HIGH").length;

  const rate =
    clicks > 0 ? Math.round((resolved / clicks) * 1000) / 10 : null;

  return {
    generatedAt: snap.generatedAt,
    ruleVersion: snap.ruleVersion,
    activeOperators: active,
    disabledOperators: disabled,
    unknownAvailability: unknown,
    totalPlacements: snap.placements.length,
    ctaViews: impressions,
    ctaClicks: clicks,
    signedRedirectsCreated: created > 0 ? created : null,
    redirectsResolved: resolved,
    redirectFailures: failures,
    clickToRedirectSuccessRate: rate,
    topPlacements,
    topOperators,
    brokenOperators: broken,
    staleAvailabilityCount: snap.operators.filter((o) =>
      o.reasonCodes.includes("STALE_AVAILABILITY_DATA")
    ).length,
    attributionIssueCount: snap.issues.filter((i) =>
      i.code.includes("ATTRIBUTION")
    ).length,
    criticalIssues: critical,
    highIssues: high,
    lastAuditAt: snap.generatedAt,
    notes: [
      "No revenue, deposit, or FTD figures — postbacks disabled by default.",
      "UNKNOWN availability is never treated as AVAILABLE.",
      "Quality scores are internal operational only — not public rankings.",
      ...snap.redirects.notes.slice(0, 2),
    ],
  };
}

export function filterOperators(
  rows: readonly OperatorRegistryRow[],
  filters: AffiliateFilters
): { total: number; items: OperatorRegistryRow[] } {
  let list = [...rows];
  if (filters.operator) {
    list = list.filter((o) => o.operatorId === filters.operator);
  }
  if (filters.availability !== "all") {
    list = list.filter((o) => o.availabilityDecision === filters.availability);
  }
  if (filters.q) {
    const q = filters.q.toLowerCase();
    list = list.filter(
      (o) =>
        o.operatorId.includes(q) ||
        o.displayName.toLowerCase().includes(q)
    );
  }
  return {
    total: list.length,
    items: list.slice(filters.offset, filters.offset + filters.limit),
  };
}

export function filterPlacements(
  rows: readonly PlacementRecord[],
  filters: AffiliateFilters
): { total: number; items: PlacementRecord[] } {
  let list = [...rows];
  if (filters.placement) {
    list = list.filter((p) => p.placementId === filters.placement);
  }
  if (filters.q) {
    const q = filters.q.toLowerCase();
    list = list.filter(
      (p) =>
        p.placementId.includes(q) ||
        p.pageType.includes(q) ||
        p.componentPath.toLowerCase().includes(q)
    );
  }
  return {
    total: list.length,
    items: list.slice(filters.offset, filters.offset + filters.limit),
  };
}

export function buildAffiliateSectionPayload(
  section: AffiliateSection,
  snap: AffiliateAuditSnapshot,
  filters: AffiliateFilters
): Record<string, unknown> {
  if (section === "overview") {
    return buildOverview(snap) as unknown as Record<string, unknown>;
  }
  if (section === "operators") {
    const page = filterOperators(snap.operators, filters);
    return {
      generatedAt: snap.generatedAt,
      total: page.total,
      items: page.items,
    };
  }
  if (section === "placements") {
    const page = filterPlacements(snap.placements, filters);
    return {
      generatedAt: snap.generatedAt,
      total: page.total,
      items: page.items,
    };
  }
  if (section === "funnels") {
    return {
      generatedAt: snap.generatedAt,
      funnels: snap.funnels,
      disclaimer:
        "Funnels stop at redirect resolution. No FTD/deposit claims without verified postbacks.",
    };
  }
  if (section === "campaigns") {
    let items = [...snap.campaigns];
    if (filters.operator) {
      items = items.filter((c) => c.operatorId === filters.operator);
    }
    return {
      generatedAt: snap.generatedAt,
      total: items.length,
      items: items.slice(filters.offset, filters.offset + filters.limit),
      notes: [
        "campaignId is not stamped by /go today — inventory uses default:{slug} placeholders.",
      ],
    };
  }
  if (section === "redirects") {
    return {
      generatedAt: snap.generatedAt,
      health: snap.redirects,
      diagnostics: snap.diagnostics,
    };
  }
  if (section === "availability") {
    const page = filterOperators(snap.operators, filters);
    return {
      generatedAt: snap.generatedAt,
      total: page.total,
      items: page.items.map((o) => ({
        operatorId: o.operatorId,
        decision: o.availabilityDecision,
        reasonCodes: o.reasonCodes,
        supportedCountries: o.supportedCountries,
        destinationConfigured: o.destinationConfigured,
      })),
      legend: [
        "AVAILABLE — configured available for context",
        "UNKNOWN — must not be treated as AVAILABLE",
        "UNAVAILABLE — blocked or ineligible",
        "DISABLED — feature/operator off",
        "MISCONFIGURED — destination/signing broken",
        "REVIEW_REQUIRED — unverified / needs human review",
      ],
    };
  }
  if (section === "issues") {
    const page = filterIssues(snap.issues, {
      severity: filters.severity,
      operator: filters.operator,
      q: filters.q,
      offset: filters.offset,
      limit: filters.limit,
    });
    return {
      generatedAt: snap.generatedAt,
      total: page.total,
      items: page.items,
    };
  }
  if (section === "quality") {
    return {
      generatedAt: snap.generatedAt,
      purpose: "internal_operational_only",
      operators: snap.operatorQuality,
      placements: snap.placementQuality,
      notes: [
        "Scores are not public operator rankings and must not power user-facing “best” claims.",
      ],
    };
  }
  return { error: "unknown_section" };
}
