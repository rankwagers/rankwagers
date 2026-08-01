import type { SiteEvent } from "./events";

export type TrafficKind =
 | "human"
 | "google"
 | "google_render"
 | "bot"
 | "suspicious"
 | "datacenter";

export type TrafficBadge = {
 kind: TrafficKind;
 label: string;
 hint?: string;
};

const KNOWN_BOT_UA =
 /Googlebot|Google-InspectionTool|GoogleOther|Storebot-Google|bingbot|SemrushBot|AhrefsBot|Bytespider|GPTBot|HeadlessChrome|curl\/|python-requests|axios\/|Go-http-client|wget\/|scrapy|petalbot|Dataprovider\.com|BuiltWith\//i;

const GOOGLE_UA = /Googlebot|Google-InspectionTool|GoogleOther|Storebot-Google/i;

/** Arama motoru dizinleme botları (yaş kapısı SSR içeriğini gizlemesin diye). */
const SEARCH_CRAWLER_UA =
 /Googlebot|Google-InspectionTool|GoogleOther|Storebot-Google|bingbot|Slurp|DuckDuckBot|Baiduspider|YandexBot|Applebot|PetalBot|facebookexternalhit/i;

export function isSearchEngineCrawler(
 userAgent: string | null | undefined
): boolean {
 if (!userAgent?.trim()) return false;
 return SEARCH_CRAWLER_UA.test(userAgent);
}

/** Eski / sentetik mobil imzalar (loglardaki click spam) */
const SUSPICIOUS_UA =
 /iPhone OS 1[0-2]_|CPU iPhone OS 13_2_3|CPU iPhone OS 11_|Chrome\/7[0-9]\.|Chrome\/86\.0\.4240|Chrome\/149\.0\.7827|Edge\/18\.19582/i;

/** Linux headless render (GCP tarama benzeri) */
const RENDER_UA =
 /\(X11; Linux x86_64\).*Chrome\/12[0-9]\./i;

const DATACENTER_IPV4_PREFIXES = ["34.", "35.", "52.", "54.", "13.", "104.", "199.", "205.", "32.", "100.",
];

function isDatacenterIp(ip: string): boolean {
 const t = ip.trim();
 if (!t) return false;
 for (const p of DATACENTER_IPV4_PREFIXES) {
 if (t.startsWith(p)) return true;
 }
 return false;
}

export function classifyTraffic(e: SiteEvent): TrafficBadge {
 const ua = e.ua || "";
 const ip = e.ip || "";
 const referer = e.referer || "";

 if (GOOGLE_UA.test(ua)) {
 return { kind: "google", label: "Google", hint: "Resmi Google bot UA" };
 }

 if (e.type === "click" && !referer.trim()) {
 return {
 kind: "suspicious",
 label: "Şüpheli",
 hint: "Affiliate tıklaması, referer yok",
 };
 }

 if (SUSPICIOUS_UA.test(ua)) {
 return {
 kind: "suspicious",
 label: "Şüpheli",
 hint: "Eski veya sentetik tarayıcı imzası",
 };
 }

 if (KNOWN_BOT_UA.test(ua) && !GOOGLE_UA.test(ua)) {
 return { kind: "bot", label: "Bot", hint: "Bilinen bot / crawler UA" };
 }

 if (RENDER_UA.test(ua) && isDatacenterIp(ip)) {
 return {
 kind: "google_render",
 label: "Google?",
 hint: "GCP IP + Linux Chrome (render / tarama)",
 };
 }

 if (isDatacenterIp(ip) && e.type === "view") {
 return {
 kind: "datacenter",
 label: "DC",
 hint: "Bulut / datacenter IP (otomasyon olabilir)",
 };
 }

 if (isDatacenterIp(ip) && e.type === "click") {
 return {
 kind: "suspicious",
 label: "Şüpheli",
 hint: "Datacenter IP üzerinden affiliate tıklaması",
 };
 }

 return { kind: "human", label: "İnsan", hint: "Normal tarayıcı sinyali" };
}

export function isSuspiciousKind(kind: TrafficKind): boolean {
 return kind === "suspicious" || kind === "bot";
}

export function summarizeTrafficKinds(events: SiteEvent[]): {
 suspiciousClicks: number;
 botOrSuspicious: number;
 googleLike: number;
} {
 let suspiciousClicks = 0;
 let botOrSuspicious = 0;
 let googleLike = 0;
 const today = new Date().toISOString().slice(0, 10);

 for (const e of events) {
 if (!e.ts.startsWith(today)) continue;
 const b = classifyTraffic(e);
 if (b.kind === "google" || b.kind === "google_render") googleLike++;
 if (isSuspiciousKind(b.kind)) botOrSuspicious++;
 if (e.type === "click" && (b.kind === "suspicious" || b.kind === "bot"))
 suspiciousClicks++;
 }

 return { suspiciousClicks, botOrSuspicious, googleLike };
}

const BADGE_CLASS: Record<TrafficKind, string> = {
 human: "bg-[var(--green-surface)] text-brand",
 google: "bg-[var(--info-surface)] text-[var(--info-primary)]",
 google_render: "bg-[var(--info-surface)] text-[var(--info-primary)]",
 bot: "bg-[var(--amber-surface)] text-[var(--amber-primary)]",
 suspicious: "bg-[var(--red-surface)] text-[var(--red-primary)]",
 datacenter: "bg-muted/20 text-muted-foreground",
};

export function badgeClassName(kind: TrafficKind): string {
 return BADGE_CLASS[kind];
}
