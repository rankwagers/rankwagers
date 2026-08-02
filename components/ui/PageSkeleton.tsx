export function PageSkeleton({
  label = "Loading page",
}: {
  label?: string;
}) {
  return (
    <div
      className="container-wide animate-pulse pb-16 pt-5"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div className="skeleton h-3 w-40" />
      <div className="skeleton mt-6 h-10 w-2/3 max-w-xl" />
      <div className="skeleton mt-4 h-4 w-full max-w-2xl" />
      <div className="skeleton mt-2 h-4 w-5/6 max-w-xl" />
      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-24 rounded-md border border-[var(--border-subtle)] bg-[var(--canvas-secondary)]"
          />
        ))}
      </div>
      <span className="sr-only">{label}…</span>
    </div>
  );
}
