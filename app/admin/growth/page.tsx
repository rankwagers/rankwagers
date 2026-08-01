import { getGrowthReadiness } from "@/lib/growth/readiness";

export const dynamic = "force-dynamic";

const GOOD_THRESHOLD: Record<string, number> = {
  // Google "good" p75 thresholds (ms; CLS ×1000).
  LCP: 2500,
  INP: 200,
  CLS: 100,
  FCP: 1800,
  TTFB: 800,
};

export default async function AdminGrowthPage() {
  const r = await getGrowthReadiness();

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Growth Measurement Readiness</h1>
      <p style={{ color: "#666", marginTop: 0 }}>
        If a visitor arrives now, is every important event measurable? Config &amp; live field data.
      </p>

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Instrumentation</h2>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <tbody>
          {r.checks.map((c) => (
            <tr key={c.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "8px 6px", width: 24 }}>{c.ok ? "OK" : "!"}</td>
              <td style={{ padding: "8px 6px", fontWeight: 600 }}>{c.label}</td>
              <td style={{ padding: "8px 6px", color: "#555" }}>{c.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ fontSize: 16, marginTop: 24 }}>
        Core Web Vitals — field p75{" "}
        <span style={{ fontWeight: 400, color: "#888" }}>
          ({r.vitalsSampleCount} recent samples)
        </span>
      </h2>
      {r.vitalsSampleCount === 0 ? (
        <p style={{ color: "#888" }}>
          No samples yet — data appears here once real traffic loads pages.
        </p>
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#888", fontSize: 13 }}>
              <th scope="col" style={{ padding: "6px" }}>Metric</th>
              <th scope="col" style={{ padding: "6px" }}>p75</th>
              <th scope="col" style={{ padding: "6px" }}>Good target</th>
              <th scope="col" style={{ padding: "6px" }}>Samples</th>
              <th scope="col" style={{ padding: "6px" }}>% good</th>
            </tr>
          </thead>
          <tbody>
            {r.vitals.map((v) => {
              const target = GOOD_THRESHOLD[v.metric];
              const withinTarget = v.p75 !== null && v.p75 <= target;
              const unit = v.metric === "CLS" ? "" : "ms";
              const pctGood = v.count ? Math.round((v.good / v.count) * 100) : 0;
              return (
                <tr key={v.metric} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "6px", fontWeight: 600 }}>{v.metric}</td>
                  <td style={{ padding: "6px" }}>
                    {v.p75 === null
                      ? "—"
                      : `${v.metric === "CLS" ? (v.p75 / 1000).toFixed(3) : v.p75}${unit} ${
                          v.count ? (withinTarget ? "OK" : "!") : ""
                        }`}
                  </td>
                  <td style={{ padding: "6px", color: "#888" }}>
                    {v.metric === "CLS" ? (target / 1000).toFixed(2) : `${target}${unit}`}
                  </td>
                  <td style={{ padding: "6px" }}>{v.count}</td>
                  <td style={{ padding: "6px" }}>{v.count ? `${pctGood}%` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <h2 style={{ fontSize: 16, marginTop: 24 }}>
        Traffic attribution — first-party{" "}
        <span style={{ fontWeight: 400, color: "#888" }}>
          ({r.attributedShare}% of recent events carry a source)
        </span>
      </h2>
      {r.topSources.length === 0 ? (
        <p style={{ color: "#888" }}>No events yet — source / medium appears here with traffic.</p>
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#888", fontSize: 13 }}>
              <th scope="col" style={{ padding: "6px" }}>Source / Medium</th>
              <th scope="col" style={{ padding: "6px" }}>Views</th>
              <th scope="col" style={{ padding: "6px" }}>Affiliate clicks</th>
            </tr>
          </thead>
          <tbody>
            {r.topSources.map((s) => (
              <tr key={s.key} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "6px", fontWeight: 600 }}>{s.key}</td>
                <td style={{ padding: "6px" }}>{s.views}</td>
                <td style={{ padding: "6px" }}>{s.clicks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p style={{ color: "#999", fontSize: 12, marginTop: 24 }}>
        Full acquisition, engagement and attribution reporting lives in GA4 (via GTM). This panel
        confirms on-site instrumentation is live, surfaces internal CWV p75, and proves first-party
        source attribution is captured in our own event log (consent/adblock-resilient). See
        docs/growth-measurement.md.
      </p>
    </main>
  );
}
