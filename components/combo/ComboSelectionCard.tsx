"use client";

import { useState } from "react";
import { EvidenceStrengthBadge } from "@/components/evidence-ui/EvidenceStrengthBadge";
import type { PublicEvidenceCombo } from "@/lib/combo/apiTypes";
import type { EvidenceStrength } from "@/lib/evidence-ui";
import type { ReplacementMode } from "@/lib/combo/types";
import { ComboReasoningPanel } from "./ComboReasoningPanel";

type Selection = PublicEvidenceCombo["selections"][number];

const REPLACE_MODES: Array<{ id: ReplacementMode; label: string }> = [
 { id: "same_market", label: "Same market" },
 { id: "similar_odds", label: "Similar odds" },
 { id: "stronger_evidence", label: "Stronger evidence" },
 { id: "different_competition", label: "Different competition" },
];

export function ComboSelectionCard({
 selection,
 pending,
 onReplace,
 onRemove,
 onExpand,
}: {
 selection: Selection;
 pending: boolean;
 onReplace: (mode: ReplacementMode) => void;
 onRemove: () => void;
 onExpand: () => void;
}) {
 const [open, setOpen] = useState(false);
 const [mode, setMode] = useState<ReplacementMode>("stronger_evidence");

 return (
 <article className="rounded-md border border-border bg-[var(--canvas-secondary)] px-4 py-4">
 <div className="flex flex-wrap items-start justify-between gap-3">
 <div>
 <p className="text-metadata uppercase tracking-label text-muted-foreground">
 {selection.competitionName}
 </p>
 <h3 className="mt-1 font-display text-lg font-semibold text-foreground">
 {selection.homeTeam} vs {selection.awayTeam}
 </h3>
 <p className="mt-1 text-sm text-[var(--ink-secondary)]">
 {selection.marketLabel} · Kickoff{""}
 <time dateTime={selection.kickoffAt}>
 {new Date(selection.kickoffAt).toLocaleString()}
 </time>
 </p>
 </div>
 <div className="text-right">
 <p className="font-mono text-2xl font-semibold text-brand">
 {selection.odds.toFixed(2)}
 </p>
 <div className="mt-2">
 <EvidenceStrengthBadge
 strength={selection.evidenceStrength as EvidenceStrength}
 />
 </div>
 </div>
 </div>

 <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
 <div>
 <dt className="text-metadata uppercase text-muted-foreground">Coverage</dt>
 <dd className="font-mono">{selection.coverage}%</dd>
 </div>
 <div>
 <dt className="text-metadata uppercase text-muted-foreground">Sample</dt>
 <dd className="font-mono">
 {selection.qualifiedSample}
 {selection.evidenceSource === "daily_list" ? " (proxy)" : ""}
 </dd>
 </div>
 <div>
 <dt className="text-metadata uppercase text-muted-foreground">Qualification</dt>
 <dd>Passed</dd>
 </div>
 </dl>

 <ComboReasoningPanel
 selection={selection}
 open={open}
 onToggle={() => {
 const next = !open;
 setOpen(next);
 if (next) onExpand();
 }}
 />

 <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-end">
 <label className="flex-1 text-sm">
 <span className="text-muted-foreground">Replace mode</span>
 <select
 value={mode}
 onChange={(e) => setMode(e.target.value as ReplacementMode)}
 className="mt-1 min-h-12 w-full rounded-md border border-border bg-background px-3"
 disabled={pending}
 >
 {REPLACE_MODES.map((row) => (
 <option key={row.id} value={row.id}>
 {row.label}
 </option>
 ))}
 </select>
 </label>
 <button
 type="button"
 disabled={pending}
 onClick={() => onReplace(mode)}
 className="min-h-12 rounded-md border border-border px-4 py-2 text-sm font-semibold disabled:opacity-[var(--opacity-disabled)]"
 >
 Replace
 </button>
 <button
 type="button"
 disabled={pending}
 onClick={onRemove}
 className="min-h-12 rounded-md border border-border px-4 py-2 text-sm font-semibold text-[var(--red-primary)] disabled:opacity-[var(--opacity-disabled)]"
 >
 Remove
 </button>
 </div>
 </article>
 );
}
