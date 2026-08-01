"use client";

import { useState } from "react";

export function CopyCode({
  code,
  label,
  copyLabel,
  copiedLabel,
}: {
  code: string;
  label: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // clipboard erişimi yoksa sessiz geç
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="flex items-center gap-3">
      <div className="text-xs uppercase tracking-label text-[var(--ink-secondary)]">
        {label}
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="group inline-flex items-center gap-2 rounded-lg border border-dashed border-brand/60 bg-brand/10 px-3 py-1.5 font-mono text-base font-semibold tracking-label text-brand hover:bg-brand/20"
        aria-label={`${copyLabel} ${code}`}
      >
        {code}
        <span className="rounded bg-brand px-2 py-0.5 text-xs font-semibold text-background">
          {copied ? copiedLabel : copyLabel}
        </span>
      </button>
    </div>
  );
}
