import Image from "next/image";
import type { FullDictionary } from "@/lib/dictionaries";
import { buildGoPath } from "@/lib/operators/go-path";

const BANNERS = {
 1: {
 brand: "1xbet",
 src: "/promos/sidebar-1xbet.png",
 width: 400,
 height: 400,
 alt: "1xBet — 100% bonus on first deposit",
 },
 2: {
 brand: "bet-and-you",
 src: "/promos/sidebar-betandyou.webp",
 width: 400,
 height: 400,
 alt: "BetAndYou — 20% cashback bonus via Skrill or Neteller",
 },
} as const;

export function SidebarBannerSlot({
 dict,
 slot,
 subidBase,
}: {
 dict: FullDictionary;
 slot: 1 | 2;
 subidBase: string;
}) {
 const banner = BANNERS[slot];
 const href = buildGoPath({
 slug: banner.brand,
 placement: "sidebar_banner",
 subid: `${subidBase}_${slot}`,
 availability: "unknown",
 deeplinkType: "homepage",
 });

 return (
 <a
 href={href}
 className="card block overflow-hidden border border-border bg-muted/40 p-0 transition-colors hover:border-brand/35 hover: focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
 aria-label={banner.alt}
 rel="noopener sponsored"
 >
 <Image
 src={banner.src}
 alt={banner.alt}
 width={banner.width}
 height={banner.height}
 className="h-auto w-full object-cover"
 sizes="(max-width: 1024px) 100vw, 280px"
 priority={slot === 1}
 />
 <span className="sr-only">{dict.home.visit}</span>
 </a>
 );
}
