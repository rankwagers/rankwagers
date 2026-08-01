"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { describeActionError } from "@/lib/acca-publication/presentation";

/**
 * Acca lifecycle controls (Sprint 20B-B, stage B4).
 *
 * WHY THIS IS A CLIENT COMPONENT CALLING THE HTTP API.
 * Every other admin surface reads through the service layer directly, which is right for reads.
 * Writes are different: authorization, CSRF, rate limiting and HTTP idempotency all live in the
 * stage B3 route handlers. Calling the service directly from a server action would bypass that
 * entire pipeline and duplicate it here — so this posts to the same endpoints an external client
 * would use, and gets the same guarantees.
 *
 * IDEMPOTENCY. One key is minted per mounted control and reused for every attempt of that
 * action. A double-click therefore REPLAYS the first response instead of performing a second
 * mutation. A page reload mints a new key, which is correct: that is a genuinely new intent.
 *
 * OPTIMISTIC CONCURRENCY. `expectedVersion` comes from the record the operator is actually
 * looking at. If it moved, the API refuses and this reports it rather than retrying blindly.
 */

type Action = "publish" | "archive";

const COPY: Record<
 Action,
 { button: string; pending: string; heading: string; body: string; confirm: string }
> = {
 publish: {
 button: "Publish Acca",
 pending: "Publishing…",
 heading: "Publish this Acca?",
 body: "Publishing marks this Acca publicly visible. The selections, captured odds and evidence are frozen — publishing never re-fetches prices, so readers see exactly what is shown above. It is not a tip and must not be presented as one.",
 confirm: "Yes, publish",
 },
 archive: {
 button: "Archive Acca",
 pending: "Archiving…",
 heading: "Archive this Acca?",
 body: "Archiving withdraws it from public visibility. Its publication history is kept, and archiving is final — it cannot be re-published, because changing what a reader already saw would undermine the record.",
 confirm: "Yes, archive",
 },
};

export function AccaLifecycleActions({
 accaId,
 expectedVersion,
 action,
 unavailableReason,
 storageIsDurable,
}: {
 accaId: string;
 expectedVersion: number;
 action: Action | null;
 unavailableReason: string;
 storageIsDurable: boolean;
}) {
 const router = useRouter();
 const [confirming, setConfirming] = useState(false);
 const [pending, setPending] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [replayed, setReplayed] = useState(false);

 // Minted once per mount. Stable across retries of this same intent.
 const keyRef = useRef<string | null>(null);
 if (keyRef.current === null) keyRef.current = newIdempotencyKey();

 if (!action) {
 return (
 <p className="text-sm text-[var(--ink-secondary)]" role="status">
 {unavailableReason}
 </p>
 );
 }

 const copy = COPY[action];

 async function submit() {
 setPending(true);
 setError(null);
 try {
 const response = await fetch(`/api/admin/accas/${accaId}/${action}`, {
 method: "POST",
 headers: {"content-type": "application/json", "idempotency-key": keyRef.current as string,
 },
 body: JSON.stringify({ expectedVersion }),
 });
 const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;

 if (!response.ok) {
 setError(
 describeActionError(body.error, {
 currentStatus: body.currentStatus,
 retryAfterSec: Number(response.headers.get("retry-after")) || null,
 }),
 );
 setPending(false);
 return;
 }

 setReplayed(response.headers.get("idempotent-replay") === "true");
 setConfirming(false);
 setPending(false);
 // Re-read from the server rather than patching local state, so what is displayed is
 // always what is actually stored.
 router.refresh();
 } catch {
 setError("The request could not be sent. Check your connection and try again.");
 setPending(false);
 }
 }

 return (
 <div>
 {!storageIsDurable && action === "publish" ? (
 <p className="mb-3 rounded border border-[var(--amber-border)] bg-[var(--amber-surface)] px-3 py-2 text-xs text-[var(--amber-primary)]">
 Storage is not durable. Anything published now is held in process memory and is lost on
 restart. This is not production behaviour.
 </p>
 ) : null}

 {!confirming ? (
 <button
 type="button"
 onClick={() => {
 setError(null);
 setConfirming(true);
 }}
 className="inline-flex min-h-10 items-center rounded-md border border-[var(--green-primary)] bg-[var(--green-surface)] px-4 text-sm font-medium text-brand hover:bg-[var(--green-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 {copy.button}
 </button>
 ) : (
 <div className="rounded-lg border border-border bg-[var(--surface-elevated)] p-4">
 <h3 className="text-sm font-semibold text-foreground">{copy.heading}</h3>
 <p className="mt-1 text-xs text-[var(--ink-secondary)]">{copy.body}</p>
 <div className="mt-3 flex flex-wrap gap-2">
 <button
 type="button"
 onClick={submit}
 disabled={pending}
 className="inline-flex min-h-10 items-center rounded-md border border-[var(--green-primary)] bg-[var(--green-surface)] px-4 text-sm font-medium text-brand hover:bg-[var(--green-surface)] disabled:cursor-not-allowed disabled:opacity-[var(--opacity-disabled)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 {pending ? copy.pending : copy.confirm}
 </button>
 <button
 type="button"
 onClick={() => setConfirming(false)}
 disabled={pending}
 className="inline-flex min-h-10 items-center rounded-md border border-border px-4 text-sm text-foreground hover:bg-card disabled:opacity-[var(--opacity-disabled)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 Cancel
 </button>
 </div>
 </div>
 )}

 {error ? (
 <p
 role="alert"
 className="mt-3 rounded border border-[var(--red-primary)] bg-[var(--red-surface)] px-3 py-2 text-sm text-[var(--red-primary)]"
 >
 {error}
 </p>
 ) : null}

 {replayed ? (
 <p role="status" className="mt-3 text-xs text-[var(--ink-secondary)]">
 This action had already been submitted; the stored result was returned and no second
 change was made.
 </p>
 ) : null}
 </div>
 );
}

/**
 * Idempotency key.
 *
 * `crypto.randomUUID` where available; otherwise a timestamp plus two random segments. Both
 * satisfy the API contract (8–200 characters, `[A-Za-z0-9._:-]`). The fallback is not a
 * cryptographic guarantee and does not need to be — the key only has to be unique per intent
 * within one operator's session, and the API scopes it by actor, action and target anyway.
 */
function newIdempotencyKey(): string {
 const uuid =
 typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto
 ? globalThis.crypto.randomUUID()
 : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random()
 .toString(36)
 .slice(2, 12)}`;
 return `studio-${uuid}`;
}
