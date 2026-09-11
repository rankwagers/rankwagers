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
    path: "/terms",
    title: `${dict.footer.terms} — ${dict.meta.siteName}`,
    description: "Terms of use for this website.",
  });
}

export default function Page({ params }: { params: { locale: Locale } }) {
  const dict = getDictionary(params.locale);
  return (
    <article className="max-w-3xl" style={{ padding: "14px 20px 40px" }}>
      <h1 className="rw3-title">{dict.footer.terms}</h1>
      <p className="mt-4 text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>
        This website provides information and comparisons about third-party
        betting operators. We do not operate any gambling service. {" "}
        {dict.footer.disclaimer}
      </p>
      <p className="mt-4 text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>
        All offers are subject to the terms and conditions of the respective
        operator. Bonus availability and amounts may vary by country and over
        time. Always verify details on the operator&apos;s website.
      </p>
      <p className="mt-4 text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>
        {dict.footer.ageWarning}
      </p>
    </article>
  );
}
