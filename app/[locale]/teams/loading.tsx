/* Route-level loading state for the teams family — Bible V3 idiom: quiet,
   static, line-toned. No spinners, no motion (Bible V3 motion law gives
   loading states no movement); the same ground the page lands on. */
export default function TeamsLoading() {
  return (
    <div style={{ padding: "14px 20px 64px" }} aria-busy="true">
      <p className="rw3-label" style={{ margin: 0 }}>
        Loading
      </p>
      <div style={{ marginTop: 16, borderTop: "1px solid var(--line)" }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{ borderBottom: "1px solid var(--line)", padding: "16px 0" }}
          >
            <div
              style={{
                height: 12,
                width: `${72 - i * 9}%`,
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 6,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
