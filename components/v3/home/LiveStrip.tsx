import { Icon } from "@/components/v3/Icon";
import type { LiveStripItem } from "@/lib/v3/homeTable.server";

/* The live strip (Bible V3, block C): fixed live path — rows flagged live by
   the fresh provider payload only. Hidden entirely when nothing is live; a
   strip with zero matches is not a surface. */

export function LiveStrip({ items, liveLabel }: { items: LiveStripItem[]; liveLabel: string }) {
  if (!items.length) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        minHeight: 30,
        padding: "4px 20px",
        borderBottom: "1px solid var(--line)",
        fontSize: 12,
        background: "var(--surface)",
        overflowX: "auto",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 600 }}>
        <span style={{ color: "var(--loss)", display: "inline-flex" }}>
          <Icon name="live" size={20} strokePx={1.75} />
        </span>
        {liveLabel} · {items.length}
      </span>
      {items.map((item) => (
        <span key={item.matchId} style={{ display: "flex", gap: 6 }}>
          <span>{item.label}</span>
          {item.minute ? <span style={{ color: "var(--muted)" }}>{item.minute}</span> : null}
        </span>
      ))}
    </div>
  );
}
