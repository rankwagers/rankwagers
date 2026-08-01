import type { Dictionary } from "@/lib/dictionaries";

export function ClaimSteps({ dict }: { dict: Dictionary }) {
 const steps = [
 { n: 1, title: dict.cta.step1Title, body: dict.cta.step1Body },
 { n: 2, title: dict.cta.step2Title, body: dict.cta.step2Body },
 { n: 3, title: dict.cta.step3Title, body: dict.cta.step3Body },
 ];
 return (
 <section className="mt-8">
 <h2 className="mb-4 text-lg font-semibold text-foreground">{dict.cta.howToClaim}</h2>
 <div className="grid gap-4 sm:grid-cols-3">
 {steps.map((s) => (
 <div key={s.n} className="card relative p-5">
 <div className="flex h-9 w-9 items-center justify-center rounded-full from-brand-light to-brand-dark font-semibold text-background">
 {s.n}
 </div>
 <div className="mt-3 font-semibold text-foreground">{s.title}</div>
 <p className="mt-1 text-sm text-[var(--ink-secondary)]">{s.body}</p>
 </div>
 ))}
 </div>
 </section>
 );
}
