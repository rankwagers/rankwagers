import { SITE_NAME } from "@/lib/brand";
import { resolveAppEnv } from "@/lib/config/env";
import { siteUrl } from "@/lib/seo";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { defaultLocale, dirForLocale, isLocale, type Locale } from "@/lib/i18n";
import { instrumentSans, inter, jetbrainsMono, playfair } from "@/lib/fonts";
import { LocaleDocumentSync } from "@/components/LocaleDocumentSync";
import { StagingBanner } from "@/components/StagingBanner";
import {
  GoogleTagManagerBody,
  GoogleTagManagerHead,
} from "@/components/GoogleTagManager";
import { ConsentMode } from "@/components/ConsentMode";
import { WebVitals } from "@/components/WebVitals";
import { AttributionTracker } from "@/components/AttributionTracker";
import "./globals.css";

/** Search-engine site verification (GSC / Bing / Yandex). Env-driven so the
 * property is verifiable the moment a token is provisioned; omitted when unset. */
function searchVerification(): Metadata["verification"] {
  const google = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();
  const bing = process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION?.trim();
  const yandex = process.env.NEXT_PUBLIC_YANDEX_SITE_VERIFICATION?.trim();
  const other: Record<string, string> = {};
  if (bing) other["msvalidate.01"] = bing;
  const verification: NonNullable<Metadata["verification"]> = {};
  if (google) verification.google = google;
  if (yandex) verification.yandex = yandex;
  if (Object.keys(other).length) verification.other = other;
  return Object.keys(verification).length ? verification : undefined;
}

export function generateMetadata(): Metadata {
  const staging =
    resolveAppEnv() === "staging" || process.env.STAGING_NOINDEX === "true";
  return {
    metadataBase: new URL(siteUrl()),
    applicationName: SITE_NAME,
    robots: staging
      ? { index: false, follow: false }
      : { index: true, follow: true },
    icons: { icon: "/icon.svg", shortcut: "/icon.svg" },
    // Verification tags are ignored on staging (noindex) but harmless.
    verification: staging ? undefined : searchVerification(),
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hdr = headers();
  const raw = hdr.get("x-locale") || defaultLocale;
  const locale: Locale = isLocale(raw) ? raw : defaultLocale;
  const dir = dirForLocale(locale);

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${inter.variable} ${playfair.variable} ${instrumentSans.variable} ${jetbrainsMono.variable}`}
    >
      {/* Consent Mode v2 default MUST precede GTM so tags initialise consent-aware. */}
      <ConsentMode />
      <GoogleTagManagerHead />
      <body className="font-sans">
        <GoogleTagManagerBody />
        <StagingBanner />
        <LocaleDocumentSync />
        {children}
        <AttributionTracker />
        <WebVitals />
      </body>
    </html>
  );
}
