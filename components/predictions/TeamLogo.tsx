"use client";

import { useState } from "react";

const SIZE_CLASS = {
  xs: "h-5 w-5 text-metadata",
  sm: "h-6 w-6 text-metadata",
  md: "h-9 w-9 text-metadata",
  lg: "h-11 w-11 text-metadata sm:h-12 sm:w-12 sm:text-xs",
} as const;

export function TeamLogo({
  src,
  size = "md",
  className = "",
}: {
  src?: string;
  name: string;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}) {
  const box = SIZE_CLASS[size];
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      <span
        className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted ${box} ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          className="h-full w-full object-contain p-1"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      </span>
    );
  }

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full border border-border bg-muted text-brand ${box} ${className}`}
      aria-hidden
    >
      <svg viewBox="0 0 24 28" className="h-[78%] w-[72%]" fill="none">
        <path
          d="M12 1.5 21 5v7.4c0 5.7-3.8 10.8-9 13.1-5.2-2.3-9-7.4-9-13.1V5l9-3.5Z"
          fill="currentColor"
          fillOpacity=".14"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path d="M7 11h10M12 7v8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      </svg>
    </span>
  );
}
