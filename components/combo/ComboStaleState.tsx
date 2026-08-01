export function ComboStaleState({ onRefresh }: { onRefresh: () => void }) {
 return (
 <div
 className="rounded-md border border-[var(--amber-border)] bg-[var(--amber-surface)] px-4 py-4 text-[var(--amber-primary)]"
 role="status"
 >
 <p className="text-sm font-semibold">Odds refresh recommended</p>
 <p className="mt-1 text-sm">
 Stored combo odds may be outdated. Refresh before placing selections with an
 operator. Odds may change.
 </p>
 <button
 type="button"
 onClick={onRefresh}
 className="mt-3 min-h-12 rounded-md border border-[var(--amber-border)] bg-white px-4 py-2 text-sm font-semibold"
 >
 Refresh Combo
 </button>
 </div>
 );
}
