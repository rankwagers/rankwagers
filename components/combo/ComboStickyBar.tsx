"use client";

export function ComboStickyBar({
  selectionCount,
  combinedOdds,
  onOpenOperators,
}: {
  selectionCount: number;
  combinedOdds: number;
  onOpenOperators: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-[var(--canvas)]/95 px-4 py-3 backdrop-blur md:hidden pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">
          {selectionCount} selections ·{" "}
          <span className="font-mono text-brand">{combinedOdds.toFixed(2)}</span>
        </p>
        <button
          type="button"
          onClick={onOpenOperators}
          className="btn-primary min-h-12"
        >
          View Operators
        </button>
      </div>
    </div>
  );
}
