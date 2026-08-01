import "server-only";
import type { AffiliateFilters, AffiliateSection } from "./contracts";
import { buildAffiliateSectionPayload } from "./aggregations";
import { loadAffiliateAuditSnapshot } from "./queries";
import { affiliateToCsv, affiliateToJson } from "./exports";
import { filterOperators, filterPlacements } from "./aggregations";
import { filterIssues } from "./issues";

let cache: {
  at: number;
  country: string | null;
  snap: Awaited<ReturnType<typeof loadAffiliateAuditSnapshot>>;
} | null = null;

const CACHE_TTL_MS = 60_000;

async function getSnapshot(country: string | null) {
  const now = Date.now();
  if (
    cache &&
    now - cache.at < CACHE_TTL_MS &&
    cache.country === country
  ) {
    return cache.snap;
  }
  const snap = await loadAffiliateAuditSnapshot({
    eventLimit: 50_000,
    country,
  });
  cache = { at: now, country, snap };
  return snap;
}

export async function getAffiliateSection(
  section: AffiliateSection,
  filters: AffiliateFilters
): Promise<Record<string, unknown>> {
  const snap = await getSnapshot(filters.country);
  return buildAffiliateSectionPayload(section, snap, filters);
}

export async function getAffiliateOperatorDetail(
  operatorId: string,
  filters: AffiliateFilters
): Promise<Record<string, unknown> | null> {
  const snap = await getSnapshot(filters.country);
  const op = snap.operators.find((o) => o.operatorId === operatorId);
  if (!op) return null;
  const quality = snap.operatorQuality.find((q) => q.operatorId === operatorId);
  const issues = snap.issues.filter((i) => i.operatorId === operatorId);
  const campaign = snap.campaigns.find((c) => c.operatorId === operatorId);
  return {
    generatedAt: snap.generatedAt,
    operator: op,
    quality,
    campaign,
    issues,
    placementsUsing: snap.placements
      .filter((p) => p.signingMethod.includes("buildGoPath") || p.placementId.includes("operator"))
      .map((p) => p.placementId),
    notes: [
      "Secrets and raw signed payloads are never included.",
      "Quality score is internal operational only.",
    ],
  };
}

export async function exportAffiliateSection(
  section: AffiliateSection,
  format: "csv" | "json",
  filters: AffiliateFilters
): Promise<{ body: string; contentType: string; filename: string }> {
  const snap = await getSnapshot(filters.country);
  let rows: Array<Record<string, unknown>> = [];
  let payload: unknown = {};

  if (section === "operators" || section === "availability" || section === "overview") {
    const page = filterOperators(snap.operators, {
      ...filters,
      offset: 0,
      limit: 2000,
    });
    rows = page.items.map((o) => ({
      operatorId: o.operatorId,
      displayName: o.displayName,
      availability: o.availabilityDecision,
      reasons: o.reasonCodes.join("|"),
      destinationConfigured: o.destinationConfigured,
      affiliateEnabled: o.affiliateEnabled,
      verification: o.verificationStatus,
    }));
    payload = section === "overview" ? buildAffiliateSectionPayload("overview", snap, filters) : { items: rows };
  } else if (section === "placements") {
    const page = filterPlacements(snap.placements, {
      ...filters,
      offset: 0,
      limit: 2000,
    });
    rows = page.items.map((p) => ({
      placementId: p.placementId,
      pageType: p.pageType,
      componentPath: p.componentPath,
      signingMethod: p.signingMethod,
      duplicateCtaRisk: p.duplicateCtaRisk,
      qualityStatus: p.qualityStatus,
    }));
    payload = { items: rows };
  } else if (section === "campaigns") {
    rows = snap.campaigns.map((c) => ({
      campaignId: c.campaignId,
      operatorId: c.operatorId,
      status: c.status,
      destinationMapped: c.destinationMapped,
      issueStatus: c.issueStatus,
    }));
    payload = { items: rows };
  } else if (section === "issues") {
    const page = filterIssues(snap.issues, {
      severity: filters.severity,
      operator: filters.operator,
      q: filters.q,
      offset: 0,
      limit: 2000,
    });
    rows = page.items.map((i) => ({
      code: i.code,
      severity: i.severity,
      operatorId: i.operatorId,
      placementId: i.placementId,
      explanation: i.explanation,
      remediation: i.remediation,
    }));
    payload = { items: rows };
  } else if (section === "redirects") {
    rows = [{ ...snap.redirects, expiredLinks: "Unavailable", malformedLinks: "Unavailable" }];
    payload = { health: snap.redirects, diagnostics: snap.diagnostics };
  } else if (section === "funnels") {
    rows = snap.funnels.flatMap((f) =>
      f.steps.map((s) => ({
        funnel: f.id,
        step: s.step,
        count: s.count,
        events: s.eventNames.join("|"),
      }))
    );
    payload = { funnels: snap.funnels };
  } else if (section === "quality") {
    rows = snap.operatorQuality.map((q) => ({
      operatorId: q.operatorId,
      total: q.quality.total,
      purpose: q.quality.purpose,
    }));
    payload = {
      operators: snap.operatorQuality,
      placements: snap.placementQuality,
    };
  } else {
    payload = buildAffiliateSectionPayload(section, snap, filters);
    rows = [{ section }];
  }

  if (format === "csv") {
    return {
      body: affiliateToCsv(section, rows),
      contentType: "text/csv; charset=utf-8",
      filename: `affiliate-${section}.csv`,
    };
  }
  return {
    body: affiliateToJson(section, payload),
    contentType: "application/json; charset=utf-8",
    filename: `affiliate-${section}.json`,
  };
}

export function clearAffiliateAuditCache(): void {
  cache = null;
}
