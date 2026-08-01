"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import type { FullDictionary } from "@/lib/dictionaries";

export const AGE_VERIFIED_COOKIE = "rankwagers-age-verified";
const EXIT_URL = "https://www.begambleaware.org/";

function readClientCookieVerified(): boolean {
 if (typeof document === "undefined") return false;
 return document.cookie
 .split(";")
 .some((c) => c.trim() === `${AGE_VERIFIED_COOKIE}=1`);
}

function AgeGateScreen({
 nextPath,
 dict,
}: {
 nextPath: string;
 dict: FullDictionary;
}) {
 const g = dict.ageGate;
 const verifyHref = `/api/age-verify?next=${encodeURIComponent(nextPath)}`;

 return (
 <div
 className="fixed inset-0 z-[9999] flex min-h-[100dvh] items-center justify-center bg-background p-4"
 role="dialog"
 aria-modal="true"
 aria-labelledby="age-gate-title"
 >
 <div className="card w-full max-w-md border-brand/30 p-6 text-center sm:p-8">
 <span className="inline-flex rounded-full border border-brand-light/40 bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-label text-brand">
 {g.badge}
 </span>
 <h2 id="age-gate-title" className="mt-4 text-xl font-semibold text-foreground sm:text-2xl">
 {g.title}
 </h2>
 <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{g.body}</p>
 <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
 <a href={verifyHref} className="btn-primary w-full sm:w-auto">
 {g.yes}
 </a>
 <a href={EXIT_URL} className="btn-ghost w-full sm:w-auto">
 {g.no}
 </a>
 </div>
 </div>
 </div>
 );
}

export function AgeVerificationGate({
 children,
 serverVerified = false,
 dict,
}: {
 children: React.ReactNode;
 serverVerified?: boolean;
 dict: FullDictionary;
}) {
 const pathname = usePathname();
 const nextPath = pathname && pathname.startsWith("/") ? pathname : "/en";
 const [verified, setVerified] = useState(serverVerified);

 useLayoutEffect(() => {
 if (serverVerified || readClientCookieVerified()) {
 setVerified(true);
 }
 }, [serverVerified]);

 useLayoutEffect(() => {
 if (verified) {
 document.body.style.removeProperty("overflow");
 return;
 }
 document.body.style.overflow = "hidden";
 return () => {
 document.body.style.removeProperty("overflow");
 };
 }, [verified]);

 if (!verified) {
 return <AgeGateScreen nextPath={nextPath} dict={dict} />;
 }

 return <>{children}</>;
}
