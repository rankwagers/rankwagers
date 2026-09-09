import { notFound } from "next/navigation";
import { Tracker } from "@/components/Tracker";
import { AccaWorkspace } from "@/components/acca/AccaChrome";
import { HeaderV3 } from "@/components/v3/chrome/HeaderV3";
import { FooterV3 } from "@/components/v3/chrome/FooterV3";
import { MobileTabsV3 } from "@/components/v3/chrome/MobileTabsV3";
import { IconSprite } from "@/components/v3/Icon";
import { getDictionary } from "@/lib/dictionaries";
import { isLocale, locales, type Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/* V3 SHELL (Bible V3). The locale shell is the rw3 scope: dark tokens, the
   v3 header (four destinations, search, locale, 18+, sign-in), the quiet
   compliance footer and, below lg, the bottom tab bar. Interior pages that
   have not converted yet still render their own v2 surfaces inside this
   chrome — the branch does not deploy until the homepage, fixture and list
   families are all v3. */
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
  const p = dict.predictions as unknown as Record<string, string>;

  return (
    <AccaWorkspace locale={locale} p={dict.predictions}>
      <div className="rw3 flex min-h-screen flex-col overflow-x-hidden">
        <IconSprite />
        <Tracker />
        <HeaderV3
          locale={locale}
          strings={{
            predictions: p.v3NavPredictions,
            bettingTips: p.v3NavBettingTips,
            bettingSites: p.v3NavBettingSites,
            freeBets: p.v3NavFreeBets,
            search: p.v3SearchPlaceholder,
            signIn: p.v3SignIn,
            skipToContent: dict.a11y.skipToContent,
          }}
        />
        <main id="main-content" className="rw3-main flex-1">
          {children}
        </main>
        <FooterV3 dict={dict} locale={locale} />
        <MobileTabsV3
          locale={locale}
          strings={{
            predictions: p.v3NavPredictions,
            sites: p.v3NavSites,
            freeBets: p.v3NavFreeBets,
            record: p.v3NavRecord,
          }}
        />
      </div>
    </AccaWorkspace>
  );
}
