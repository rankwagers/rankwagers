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
    path: "/privacy",
    title: `${dict.footer.privacy} — ${dict.meta.siteName}`,
    description: "Privacy policy for this website.",
  });
}

export default function Page({ params }: { params: { locale: Locale } }) {
  const dict = getDictionary(params.locale);
  return (
    <article className="max-w-3xl">
      <h1 className="text-3xl font-semibold text-foreground">
        {dict.footer.privacy}
      </h1>
      <p className="mt-4 text-[var(--ink-secondary)]">
        We use privacy-friendly analytics to understand aggregate traffic and to
        measure the performance of outbound links. When you click an outbound
        offer link, a tracking identifier (subid) may be passed to the operator
        for attribution.
      </p>
      <p className="mt-4 text-[var(--ink-secondary)]">
        We do not sell personal data. Cookies, if used, are limited to essential
        and analytics purposes. You can control cookies in your browser
        settings.
      </p>
    </article>
  );
}
