import type { FullDictionary } from "@/lib/dictionaries";

export function Methodology({ dict }: { dict: FullDictionary }) {
  const steps = [dict.methodology.step1, dict.methodology.step2, dict.methodology.step3];
  return (
    <section className="card mt-6 p-5 md:p-6">
      <h2 className="text-lg font-semibold text-foreground">{dict.methodology.title}</h2>
      <ol className="mt-4 space-y-3">
        {steps.map((text, i) => (
          <li key={i} className="flex gap-3 text-sm text-[var(--ink-secondary)]">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/20 text-xs font-semibold text-brand">
              {i + 1}
            </span>
            <span className="pt-0.5 leading-relaxed">{text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
