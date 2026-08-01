import Script from "next/script";

const GTM_ID_PATTERN = /^GTM-[A-Z0-9]+$/;

export function gtmContainerId(): string | null {
  const raw = (process.env.NEXT_PUBLIC_GTM_ID || "GTM-5D4FPZ99").trim();
  if (!GTM_ID_PATTERN.test(raw)) return null;
  return raw;
}

/** GTM snippet. GA4 goes in GTM, not gtag.js here — see docs/ga4-gtm-setup.md. */
export function GoogleTagManagerHead() {
  const id = gtmContainerId();
  if (!id) return null;

  return (
    <Script
      id="google-tag-manager"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${id}');`,
      }}
    />
  );
}

/** GTM noscript fallback — place immediately after opening body. */
export function GoogleTagManagerBody() {
  const id = gtmContainerId();
  if (!id) return null;

  return (
    <noscript>
      <iframe
        title="Google Tag Manager"
        src={`https://www.googletagmanager.com/ns.html?id=${id}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
      />
    </noscript>
  );
}
