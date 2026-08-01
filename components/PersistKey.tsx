"use client";

import { useEffect } from "react";

export function PersistKey({ value }: { value: string }) {
  useEffect(() => {
    try {
      document.cookie = `admin_key=${encodeURIComponent(
        value
      )}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
    } catch {
      // sessiz
    }
  }, [value]);
  return null;
}
