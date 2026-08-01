"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";
import { dirForLocale, isLocale, type Locale } from "@/lib/i18n";

/** Client locale değişiminde html lang/dir güncelle (soft navigation). */
export function LocaleDocumentSync() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    const seg = pathname?.split("/")[1];
    if (!seg || !isLocale(seg)) return;
    const locale = seg as Locale;
    const dir = dirForLocale(locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
    document.body.style.removeProperty("overflow");
  }, [pathname]);

  return null;
}
