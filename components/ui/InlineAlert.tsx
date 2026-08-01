import type { ReactNode } from "react";

type AlertTone = "warning" | "error" | "info" | "success";

const TONE: Record<AlertTone, string> = {
  warning:
    "border-[var(--amber-border)] bg-[var(--amber-surface)] text-[var(--amber-primary)]",
  error:
    "border-[var(--red-primary)]/25 bg-[var(--red-surface)] text-[var(--red-primary)]",
  info: "border-[var(--info-primary)]/25 bg-[var(--info-surface)] text-[var(--info-primary)]",
  success:
    "border-[var(--green-primary)]/25 bg-[var(--green-surface)] text-[var(--green-deep)]",
};

/** Consistent, non-technical user-facing alert. */
export function InlineAlert({
  tone = "warning",
  children,
  title,
}: {
  tone?: AlertTone;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm ${TONE[tone]}`}
      role="alert"
    >
      {title ? <p className="font-semibold">{title}</p> : null}
      <div className={title ? "mt-1 opacity-90" : undefined}>{children}</div>
    </div>
  );
}
