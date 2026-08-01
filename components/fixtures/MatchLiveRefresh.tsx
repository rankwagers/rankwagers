"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Soft refresh for live/HT only — no polling for finished fixtures. */
export function MatchLiveRefresh({
  enabled,
  intervalSec,
}: {
  enabled: boolean;
  intervalSec: number | null;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled || !intervalSec || intervalSec < 30) return;
    const id = window.setInterval(() => {
      router.refresh();
    }, intervalSec * 1000);
    return () => window.clearInterval(id);
  }, [enabled, intervalSec, router]);

  return null;
}
