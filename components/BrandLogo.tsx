export type BrandLogoSize = "sm" | "md" | "lg";

const SIZE: Record<
 BrandLogoSize,
 { shell: string; inner: string; img: string; initials: string }
> = {
 sm: {
 shell: "h-11 w-[4.75rem] rounded-lg",
 inner: "rounded-md px-2 py-1.5",
 img: "max-h-[1.75rem]",
 initials: "text-sm",
 },
 md: {
 shell: "h-[4.75rem] w-[7.5rem] rounded-lg",
 inner: "rounded-md px-3 py-2.5",
 img: "max-h-[3rem]",
 initials: "text-lg",
 },
 lg: {
 shell: "h-24 w-[8.75rem] rounded-lg",
 inner: "rounded-md px-3.5 py-3",
 img: "max-h-[3.75rem]",
 initials: "text-xl",
 },
};

/** Logo container. A hairline-bordered surface so every operator mark sits in the same box. */
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
 className={`relative shrink-0 overflow-hidden border border-[var(--border-subtle)] bg-[var(--canvas-secondary)] ${s.shell} ${className}`}
 >
 <div
 className={`flex h-full w-full items-center justify-center ${s.inner}`}
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
 className={`relative shrink-0 overflow-hidden border border-[var(--border-subtle)] bg-[var(--canvas-secondary)] ${s.shell} ${className}`}
 >
 <div
 className={`flex h-full w-full items-center justify-center ${s.inner}`}
 >
 <span className={`font-semibold tracking-display text-[var(--ink-secondary)] ${s.initials}`}>
 {initials}
 </span>
 </div>
 </div>
 );
}
