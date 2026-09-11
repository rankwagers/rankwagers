import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div
      className="px-4 py-8 text-center"
      style={{
        border: "1px dashed var(--line)",
        background: "var(--surface)",
        borderRadius: 6,
      }}
      role="status"
    >
      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
        {title}
      </h3>
      <p
        className="mx-auto max-w-md"
        style={{ margin: "8px auto 0", fontSize: 13, color: "var(--muted)" }}
      >
        {description}
      </p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
