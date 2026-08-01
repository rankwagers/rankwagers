import { Check, Circle, CircleDot } from "lucide-react";
"use client";

const STAGES = [
  "Checking qualified fixtures",
  "Evaluating evidence quality",
  "Filtering supported markets",
  "Removing correlated selections",
  "Matching your target range",
  "Checking operator availability",
] as const;

export function ComboGenerationProgress({ activeIndex }: { activeIndex: number }) {
  return (
    <div
      className="rounded-md border border-border bg-[var(--canvas-secondary)] px-4 py-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <p className="text-sm font-semibold text-foreground">Building your evidence combo</p>
      <ol className="mt-3 space-y-2">
        {STAGES.map((stage, index) => {
          const done = index < activeIndex;
          const current = index === activeIndex;
          return (
            <li
              key={stage}
              className={`text-sm ${
                current
                  ? "font-medium text-brand"
                  : done
                    ? "text-foreground"
                    : "text-muted-foreground"
              }`}
            >
              <span className="mr-2 inline-flex" aria-hidden>{done ? <Check className="h-3.5 w-3.5" /> : current ? <CircleDot className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}</span>
              {stage}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export const COMBO_PROGRESS_STAGE_COUNT = STAGES.length;
