"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

let lastTracked = "";

export function Tracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname === lastTracked) return;
    if (pathname === "/admin" || pathname.startsWith("/admin/")) return;
    lastTracked = pathname;
    try {
      fetch("/api/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: pathname }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // sessiz
    }
  }, [pathname]);

  return null;
}
