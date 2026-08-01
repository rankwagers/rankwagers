import type { FullDictionary } from "@/lib/dictionaries";

export function EligibilityNotice({
  dict,
  variant = "card",
}: {
  dict: FullDictionary;
  variant?: "card" | "inline";
}) {
  if (variant === "inline") {
    return (
      <p className="text-sm leading-relaxed text-[var(--ink-secondary)]">
        <span className="font-semibold text-[var(--ink-secondary)]">
          {dict.footer.eligibilityTitle}:{" "}
        </span>
        {dict.footer.eligibilityBody}
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-muted/80 p-4 text-sm text-[var(--ink-secondary)]">
      <div className="text-xs font-semibold uppercase tracking-label text-[var(--ink-secondary)]">
        {dict.footer.eligibilityTitle}
      </div>
      <p className="mt-2 leading-relaxed">{dict.footer.eligibilityBody}</p>
    </div>
  );
}
