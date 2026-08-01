"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import {
  loadSavedFixtures,
  type SavedFixtureRecord,
} from "@/lib/research/savedFixtures";
import { filterCodeToMarketKey } from "@/lib/fixtures/marketCodes";
import { fixturePath } from "@/lib/fixtures/paths";

export function SavedFixturesPanel({ locale }: { locale: Locale }) {
  const [items, setItems] = useState<SavedFixtureRecord[]>([]);

  useEffect(() => {
    const refresh = () => setItems(loadSavedFixtures());
    refresh();
    window.addEventListener("rankwagers:saved-fixtures-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("rankwagers:saved-fixtures-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  if (!items.length) {
    return (
      <p className="max-w-2xl rounded-lg border border-border bg-[var(--canvas-secondary)] px-4 py-6 text-sm leading-relaxed text-[var(--ink-secondary)]">
        No saved fixtures yet. Open a qualified fixture and choose{" "}
        <strong className="font-medium text-foreground">Save to research notes</strong>{" "}
        to keep it here for this browser.
      </p>
    );
  }

  return (
    <ul className="max-w-3xl space-y-2">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={fixturePath(
              locale,
              item.matchId,
              filterCodeToMarketKey(item.marketCode),
              "saved"
            )}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-[var(--canvas-secondary)] px-4 py-3 transition-colors hover:border-brand/35"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {item.home}{" "}
                <span className="font-normal text-muted-foreground">vs</span>{" "}
                {item.away}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {item.league} · {item.marketCode}
              </p>
            </div>
            <strong className="shrink-0 font-mono text-base tabular-nums text-brand">
              {item.modelProbability}%
            </strong>
          </Link>
        </li>
      ))}
    </ul>
  );
}
