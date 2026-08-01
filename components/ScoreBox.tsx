import type { Brand } from "@/lib/brands";
import type { Dictionary } from "@/lib/dictionaries";

function Bar({ label, value }: { label: string; value: number }) {
 const pct = Math.max(0, Math.min(100, (value / 10) * 100));
 return (
 <div>
 <div className="mb-1 flex items-center justify-between text-sm">
 <span className="text-[var(--ink-secondary)]">{label}</span>
 <span className="font-semibold text-foreground">{value.toFixed(1)}</span>
 </div>
 <div className="h-2 overflow-hidden rounded-full bg-card">
 <div
 className="h-full rounded-full from-brand to-brand-light"
 style={{ width: `${pct}%` }}
 />
 </div>
 </div>
 );
}

export function ScoreBox({
 brand,
 dict,
}: {
 brand: Brand;
 dict: Dictionary;
}) {
 if (!brand.scores) return null;
 const s = brand.scores;
 return (
 <div className="card p-6">
 <div className="mb-4 flex items-center justify-between">
 <h2 className="text-lg font-semibold text-foreground">{dict.cta.ourVerdict}</h2>
 <div className="flex items-center gap-2">
 <span className="text-3xl font-semibold text-brand-light">
 {brand.rating.toFixed(1)}
 </span>
 <span className="text-sm text-muted-foreground">/ 5</span>
 </div>
 </div>
 <div className="grid gap-4 sm:grid-cols-2">
 <Bar label={dict.cta.scoreBonus} value={s.bonus} />
 <Bar label={dict.cta.scoreOdds} value={s.odds} />
 <Bar label={dict.cta.scorePayments} value={s.payments} />
 <Bar label={dict.cta.scoreApp} value={s.app} />
 <Bar label={dict.cta.scoreSupport} value={s.support} />
 </div>
 </div>
 );
}
