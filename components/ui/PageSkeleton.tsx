import type { CSSProperties } from "react";

/* Bible V3 loading state: quiet, static, line-toned. Placeholder bars on the
   surface tone with line borders — no spinner, no pulse; the motion law gives
   loading states no movement. */
const bar = (extra: CSSProperties): CSSProperties => ({
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: 6,
  ...extra,
});

export function PageSkeleton({
  label = "Loading page",
}: {
  label?: string;
}) {
  return (
    <div
      style={{ padding: "20px 20px 64px" }}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div className="w-40" style={bar({ height: 12 })} />
      <div className="mt-6 w-2/3 max-w-xl" style={bar({ height: 16 })} />
      <div className="mt-4 w-full max-w-2xl" style={bar({ height: 12 })} />
      <div className="mt-2 w-5/6 max-w-xl" style={bar({ height: 12 })} />
      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} style={bar({ height: 96 })} />
        ))}
      </div>
      <span className="sr-only">{label}…</span>
    </div>
  );
}
