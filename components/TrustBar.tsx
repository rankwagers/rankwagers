import { Gift, Lock, ShieldCheck, Zap } from "lucide-react";
import type { FullDictionary } from "@/lib/dictionaries";

/**
 * Spec §12: one icon source. The dingbats this replaced (`◆ ⚡ ◇ ★`) carried no consistent stroke
 * weight and rendered differently per platform; two of them were geometric shapes standing in for
 * concepts they do not depict. Icons inherit `currentColor` and never carry their own colour.
 */
const ICONS = {
  shield: ShieldCheck,
  bolt: Zap,
  lock: Lock,
  gift: Gift,
} as const;

export function TrustBar({ dict }: { dict: FullDictionary }) {
  const items = [
    { label: dict.trust.review, icon: "shield" },
    { label: dict.trust.payouts, icon: "bolt" },
    { label: dict.trust.licensed, icon: "lock" },
    { label: dict.trust.bonuses, icon: "gift" },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
      {items.map((it) => {
        const Icon = ICONS[it.icon];
        return (
          <div
            key={it.label}
            className="card flex items-center gap-2 px-2.5 py-2.5 text-xs text-foreground sm:px-3 sm:py-3 sm:text-sm"
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--green-surface)] text-brand"
              aria-hidden
            >
              <Icon className="h-4 w-4" strokeWidth={1.5} />
            </span>
            <span className="font-semibold leading-tight">{it.label}</span>
          </div>
        );
      })}
    </div>
  );
}
