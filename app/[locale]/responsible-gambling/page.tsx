import type { Metadata } from "next";
import { getDictionary } from "@/lib/dictionaries";
import { type Locale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";

export function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Metadata {
  const dict = getDictionary(params.locale);
  return pageMetadata({
    locale: params.locale,
    path: "/responsible-gambling",
    title: `${dict.footer.responsible} — ${dict.meta.siteName}`,
    description:
      "Responsible gambling resources and tools. Gamble responsibly, 18+ only.",
  });
}

export default function Page({ params }: { params: { locale: Locale } }) {
  const dict = getDictionary(params.locale);
  return (
    <article className="prose prose-invert max-w-3xl">
      <h1 className="text-3xl font-semibold text-foreground">
        {dict.footer.responsible}
      </h1>
      <p className="mt-4 text-[var(--ink-secondary)]">
        Gambling should be entertainment, not a way to make money. Only bet what
        you can afford to lose. This site is intended for adults aged 18 or older
        (or the legal age in your jurisdiction).
      </p>
      <ul className="mt-4 list-disc space-y-2 pl-6 text-[var(--ink-secondary)]">
        <li>Set deposit and time limits before you play.</li>
        <li>Never chase losses.</li>
        <li>Take regular breaks and self-exclude if needed.</li>
        <li>
          If gambling is affecting your life, seek help from organizations such
          as GamCare, BeGambleAware or Gamblers Anonymous.
        </li>
      </ul>
      <p className="mt-6 font-semibold text-brand-light">
        {dict.footer.ageWarning}
      </p>
    </article>
  );
}
