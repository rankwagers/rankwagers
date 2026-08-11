import { notFound } from "next/navigation";
import { SiteTopChrome } from "@/components/SiteTopChrome";
import { Footer } from "@/components/Footer";
import { Tracker } from "@/components/Tracker";
import { AccaWorkspace } from "@/components/acca/AccaChrome";
import { getDictionary } from "@/lib/dictionaries";
import { isLocale, locales, type Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;
  const dict = getDictionary(locale);

  return (
    <AccaWorkspace locale={locale} p={getDictionary(locale).predictions}>
      <div className="flex min-h-screen flex-col overflow-x-hidden bg-background text-foreground">
        <Tracker />
        <SiteTopChrome dict={dict} locale={locale} />
        <main id="main-content" className="flex-1 py-6 lg:py-8">
          {children}
        </main>
        <Footer dict={dict} locale={locale} />
      </div>
    </AccaWorkspace>
  );
}
