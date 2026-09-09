/* The verified-hit-rate lock tick: ring static, tick drawn once over 240ms
   via stroke-dashoffset (CSS class rw3-tick-path). Server-renderable — the
   animation is load-triggered CSS, and reduced-motion shows the final frame. */

export function LockTick({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--win)"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: "none" }}
    >
      <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />
      <path d="M8 12l3 3 5-6" className="rw3-tick-path" />
    </svg>
  );
}
