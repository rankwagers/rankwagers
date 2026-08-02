import Image from "next/image";
import { SITE_NAME } from "@/lib/brand";

export const SITE_LOGO_PATH = "/brand/rank-wagers-logo.png";

const badgeSizes = {
 sm: "h-7 w-7 text-metadata rounded-md",
 md: "h-8 w-8 text-metadata rounded-lg",
} as const;

const logoHeights = {
 header: "h-10 w-auto sm:h-11",
 headerCompact: "h-9 w-auto",
 footer: "h-14 w-auto sm:h-16",
 drawer: "h-8 w-auto",
} as const;

/** PNG mark — header / footer */
export function SiteBrandLogo({
 variant = "header",
 className = "",
 priority = false,
}: {
 variant?: keyof typeof logoHeights;
 className?: string;
 priority?: boolean;
}) {
 return (
 <Image
 src={SITE_LOGO_PATH}
 alt="Rank Wagers — Ranked Predictions. Smarter Wagers."
 width={320}
 height={320}
 priority={priority}
 className={`rounded-md object-contain object-left ${logoHeights[variant]} ${className}`}
 />
 );
}

/** Sarı rozet: RW (fallback) */
export function SiteBrandBadge({
 size = "md",
 className = "",
}: {
 size?: keyof typeof badgeSizes;
 className?: string;
}) {
 return (
 <span
 className={`flex shrink-0 items-center justify-center bg-brand font-semibold tracking-display text-background shadow-card ${badgeSizes[size]} ${className}`}
 aria-hidden
 >
 RW
 </span>
 );
}

/** Rank + vurgulu Wagers (fallback) */
export function SiteBrandWordmark({
 className = "",
}: {
 className?: string;
}) {
 const name = SITE_NAME;
 if (name === "RankWagers") {
 return (
 <span className={`text-lg font-semibold tracking-display text-foreground ${className}`}>
 Rank<span className="text-brand-light">Wagers</span>
 </span>
 );
 }
 return (
 <span className={`text-lg font-semibold tracking-display text-foreground ${className}`}>
 {name}
 </span>
 );
}

export function SiteBrandLockup({
 className = "",
}: {
 badgeSize?: keyof typeof badgeSizes;
 className?: string;
}) {
 return <SiteBrandLogo variant="header" className={className} priority />;
}
