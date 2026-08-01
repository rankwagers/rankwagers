export type BrandLogoSize = "sm" | "md" | "lg";

const SIZE: Record<
 BrandLogoSize,
 { shell: string; inner: string; img: string }
> = {
 sm: {
 shell: "h-11 w-[4.75rem] rounded-xl",
 inner: "rounded-lg px-2 py-1.5",
 img: "max-h-[1.75rem]",
 },
 md: {
 shell: "h-[4.75rem] w-[7.5rem] rounded-xl",
 inner: "rounded-lg px-3 py-2.5",
 img: "max-h-[3rem]",
 },
 lg: {
 shell: "h-24 w-[8.75rem] rounded-xl",
 inner: "rounded-lg px-3.5 py-3",
 img: "max-h-[3.75rem]",
 },
};

/** Koyu, gradient çerçeveli logo kutusu — affiliate listelerinde tutarlı “premium” görünüm. */
export function BrandLogo({
 src,
 alt,
 size = "md",
 className = "",
}: {
 src: string;
 alt: string;
 size?: BrandLogoSize;
 className?: string;
}) {
 const s = SIZE[size];
 return (
 <div
 className={`brand-logo-shell relative shrink-0 aspect-[5/3] ${s.shell} ${className}`}
 >
 <div
 className={`brand-logo-inner flex h-full w-full items-center justify-center ${s.inner}`}
 >
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img
 src={src}
 alt={alt}
 className={`w-full object-contain object-center ${s.img}`}
 loading="lazy"
 decoding="async"
 />
 </div>
 </div>
 );
}

export function BrandLogoFallback({
 label,
 size = "md",
 className = "",
}: {
 label: string;
 size?: BrandLogoSize;
 className?: string;
}) {
 const s = SIZE[size];
 const initials = label
 .split(/\s+/)
 .map((w) => w[0])
 .join("")
 .slice(0, 2)
 .toUpperCase();

 return (
 <div
 className={`brand-logo-shell relative shrink-0 aspect-[5/3] ${s.shell} ${className}`}
 >
 <div
 className={`brand-logo-inner flex h-full w-full items-center justify-center from-ink-soft to-ink-card ${s.inner}`}
 >
 <span className="from-brand-light to-brand bg-clip-text text-xl font-semibold tracking-display text-transparent">
 {initials}
 </span>
 </div>
 </div>
 );
}
