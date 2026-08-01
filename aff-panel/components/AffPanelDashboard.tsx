"use client";

import { useCallback, useEffect, useState } from "react";

import type { VipApplication, VipApplicationStatus, VipSettings } from "@/lib/types";

function statusBadge(status: VipApplicationStatus) {
  const map = {
    pending_review: "bg-amber-500/20 text-amber-200",
    approved: "bg-emerald-500/20 text-emerald-200",
    rejected: "bg-red-500/20 text-red-200",
  };
  return map[status];
}

export function AffPanelDashboard({ adminKeyFromUrl }: { adminKeyFromUrl: string }) {
  const [filter, setFilter] = useState<VipApplicationStatus | "all">("pending_review");
  const [apps, setApps] = useState<VipApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<VipSettings | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [approveTarget, setApproveTarget] = useState<VipApplication | null>(null);
  const [rejectTarget, setRejectTarget] = useState<VipApplication | null>(null);
  const [vipLink, setVipLink] = useState("");
  const [approveTemplate, setApproveTemplate] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qs = adminKeyFromUrl ? `?key=${encodeURIComponent(adminKeyFromUrl)}` : "";

  const loadApps = useCallback(async () => {
    setLoading(true);
    setError(null);
    const url =
      filter === "all"
        ? `/api/applications${qs}`
        : `/api/applications${qs}${qs ? "&" : "?"}status=${filter}`;
    const res = await fetch(url);
    if (!res.ok) {
      setError("Failed to load applications");
      setLoading(false);
      return;
    }
    const data = (await res.json()) as { applications: VipApplication[] };
    setApps(data.applications);
    setLoading(false);
  }, [filter, qs]);

  const loadSettings = useCallback(async () => {
    const res = await fetch(`/api/settings${qs}`);
    if (res.ok) {
      const s = (await res.json()) as VipSettings;
      setSettings(s);
      setVipLink(s.defaultVipLink);
      setApproveTemplate(s.approvalMessageTemplate);
    }
  }, [qs]);

  useEffect(() => {
    loadApps();
    loadSettings();
  }, [loadApps, loadSettings]);

  async function saveSettings() {
    if (!settings) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/settings${qs}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        approvalMessageTemplate: approveTemplate,
        defaultVipLink: vipLink,
        rejectMessagePrefix: settings.rejectMessagePrefix,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Could not save settings");
      return;
    }
    const s = (await res.json()) as VipSettings;
    setSettings(s);
    setSettingsOpen(false);
  }

  async function confirmApprove() {
    if (!approveTarget) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/applications/${approveTarget.id}/approve${qs}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vipLink,
        messageTemplate: approveTemplate,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = (await res.json()) as { error?: string };
      setError(j.error || "Approve failed");
      return;
    }
    setApproveTarget(null);
    loadApps();
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/applications/${rejectTarget.id}/reject${qs}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: rejectReason }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = (await res.json()) as { error?: string };
      setError(j.error || "Reject failed");
      return;
    }
    setRejectTarget(null);
    setRejectReason("");
    loadApps();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white">VIP applications</h1>
          <p className="text-sm text-slate-400">Telegram invite bot · English messages</p>
        </div>
        <button
          type="button"
          className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5"
          onClick={() => setSettingsOpen(true)}
        >
          Message settings
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(["pending_review", "approved", "rejected", "all"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              filter === f
                ? "bg-brand text-ink"
                : "border border-white/10 text-slate-400 hover:text-white"
            }`}
          >
            {f === "all" ? "All" : f.replace("_", " ")}
          </button>
        ))}
        <button
          type="button"
          onClick={() => loadApps()}
          className="ml-auto text-xs text-slate-500 hover:text-brand-light"
        >
          Refresh
        </button>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : apps.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No applications in this tab.</p>
        ) : (
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Telegram</th>
                <th className="px-4 py-3">Region</th>
                <th className="px-4 py-3">Site</th>
                <th className="px-4 py-3">Player ID</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id} className="border-t border-white/5">
                  <td className="px-4 py-3 text-slate-400">
                    {new Date(a.created_at).toLocaleString("en-GB")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-slate-200">{a.telegram_user_id}</div>
                    <div className="text-xs text-slate-500">
                      {a.username ? `@${a.username}` : "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{a.region}</td>
                  <td className="px-4 py-3 font-semibold text-white">{a.brand_name}</td>
                  <td className="px-4 py-3 font-mono text-brand-light">{a.player_id}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge(a.status)}`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {a.status === "pending_review" ? (
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                          onClick={() => {
                            setApproveTarget(a);
                            if (settings) {
                              setVipLink(settings.defaultVipLink);
                              setApproveTemplate(settings.approvalMessageTemplate);
                            }
                          }}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          className="rounded-lg bg-red-600/90 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-500 disabled:opacity-50"
                          onClick={() => {
                            setRejectTarget(a);
                            setRejectReason("");
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">
                        {a.reject_reason ? a.reject_reason.slice(0, 40) : "—"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {settingsOpen && settings && (
        <Modal title="Approval message settings" onClose={() => setSettingsOpen(false)}>
          <label className="block text-xs font-semibold text-slate-400">Default VIP link</label>
          <input
            className="mt-1 w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-white"
            value={vipLink}
            onChange={(e) => setVipLink(e.target.value)}
          />
          <label className="mt-4 block text-xs font-semibold text-slate-400">
            Approval template ({`{brand}`}, {`{player_id}`}, {`{vip_link}`}, {`{region}`})
          </label>
          <textarea
            className="mt-1 h-40 w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-white"
            value={approveTemplate}
            onChange={(e) => setApproveTemplate(e.target.value)}
          />
          <label className="mt-4 block text-xs font-semibold text-slate-400">
            Reject message prefix
          </label>
          <textarea
            className="mt-1 h-20 w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-white"
            value={settings.rejectMessagePrefix}
            onChange={(e) =>
              setSettings({ ...settings, rejectMessagePrefix: e.target.value })
            }
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-white/15 px-4 py-2 text-sm"
              onClick={() => setSettingsOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-ink"
              onClick={saveSettings}
            >
              Save
            </button>
          </div>
        </Modal>
      )}

      {approveTarget && (
        <Modal title={`Approve · ${approveTarget.brand_name}`} onClose={() => setApproveTarget(null)}>
          <p className="text-sm text-slate-400">
            Player ID: <span className="font-mono text-brand-light">{approveTarget.player_id}</span>
          </p>
          <label className="mt-3 block text-xs font-semibold text-slate-400">VIP link for this approval</label>
          <input
            className="mt-1 w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-white"
            value={vipLink}
            onChange={(e) => setVipLink(e.target.value)}
          />
          <label className="mt-3 block text-xs font-semibold text-slate-400">Message (editable)</label>
          <textarea
            className="mt-1 h-36 w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-white"
            value={approveTemplate}
            onChange={(e) => setApproveTemplate(e.target.value)}
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-white/15 px-4 py-2 text-sm"
              onClick={() => setApproveTarget(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white"
              onClick={confirmApprove}
            >
              Send &amp; approve
            </button>
          </div>
        </Modal>
      )}

      {rejectTarget && (
        <Modal title={`Reject · ${rejectTarget.brand_name}`} onClose={() => setRejectTarget(null)}>
          <p className="text-sm text-slate-400">
            Explain why (sent to user in English):
          </p>
          <textarea
            className="mt-2 h-32 w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-white"
            placeholder="e.g. We could not verify a qualifying first deposit on this account."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-white/15 px-4 py-2 text-sm"
              onClick={() => setRejectTarget(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || !rejectReason.trim()}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              onClick={confirmReject}
            >
              Send &amp; reject
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="card max-h-[90vh] w-full max-w-lg overflow-y-auto p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button type="button" className="text-slate-400 hover:text-white" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
