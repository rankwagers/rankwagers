"use client";

import { useEffect, useState } from "react";
import { BrandLogo } from "./BrandLogo";

export function StickyCta({
  brandName,
  bonus,
  href,
  label,
  logo,
}: {
  brandName: string;
  bonus: string;
  href: string;
  label: string;
  logo?: string;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    function onScroll() {
      setShow(window.scrollY > 400);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur transition-transform duration-300 ${
        show ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="container-wide flex items-center justify-between gap-3 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {logo && (
            <div className="hidden sm:block">
              <BrandLogo src={logo} alt={`${brandName} logo`} size="sm" />
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">
              {brandName}
            </div>
            <div className="truncate text-xs text-brand-light">{bonus}</div>
          </div>
        </div>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow sponsored"
          className="btn-primary shrink-0 whitespace-nowrap"
        >
          {label}
        </a>
      </div>
    </div>
  );
}
