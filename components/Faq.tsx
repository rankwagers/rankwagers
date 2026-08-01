import type { Brand } from "@/lib/brands";
import type { Dictionary } from "@/lib/dictionaries";
import { JsonLd } from "./JsonLd";

export function Faq({ brand, dict }: { brand: Brand; dict: Dictionary }) {
  if (!brand.faq || brand.faq.length === 0) return null;

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: brand.faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <section className="mt-8">
      <JsonLd data={faqLd} />
      <h2 className="mb-4 text-lg font-semibold text-foreground">{dict.cta.faqTitle}</h2>
      <div className="space-y-3">
        {brand.faq.map((f) => (
          <details
            key={f.q}
            className="card group p-4 [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="flex cursor-pointer items-center justify-between font-semibold text-foreground">
              {f.q}
              <span className="text-brand-light transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-[var(--ink-secondary)]">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
