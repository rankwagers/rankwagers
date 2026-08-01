"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { describeActionError } from "@/lib/acca-publication/presentation";
import { locales, localeNames } from "@/lib/i18n";

/**
 * Candidate lifecycle controls (Sprint 20B-B, stage B4).
 *
 * Approve, reject and create-Acca, driven through the stage B3 HTTP endpoints so that
 * authorization, CSRF, rate limiting and HTTP idempotency all apply exactly as they would to any
 * other client. No transition logic exists here — this component decides nothing about what is
 * legal; it renders the controls the current status permits and lets the API refuse anything else.
 *
 * The operator supplies only editorial framing (title, summary, locale). Legs, odds, evidence,
 * qualification and every lifecycle field are derived server-side from the stored candidate; the
 * API rejects them outright if sent, so they are not collected here.
 */

const CANDIDATE_BASE = "/api/admin/builder-approval/candidates";
const REASON_MAX = 500;
const TITLE_MAX = 160;
const SUMMARY_MAX = 400;

type Status = "DRAFT" | "APPROVED" | "REJECTED" | "CONVERTED" | string;

export function CandidateActions({
 candidateId,
 status,
 expectedVersion,
 convertedAccaId,
}: {
 candidateId: string;
 status: Status;
 expectedVersion: number;
 convertedAccaId: string | null;
}) {
 if (status === "DRAFT") {
 return <DraftActions candidateId={candidateId} expectedVersion={expectedVersion} />;
 }
 if (status === "APPROVED") {
 return <CreateAccaForm candidateId={candidateId} expectedVersion={expectedVersion} />;
 }
 if (status === "CONVERTED") {
 return (
 <p className="text-sm text-[var(--ink-secondary)]" role="status">
 This candidate has been converted into an Acca
 {convertedAccaId ? (
 <>
 {""}
 —{""}
 <a
 href={`/admin/accas/${convertedAccaId}`}
 className="text-brand underline underline-offset-2 hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 open it in the Acca Studio
 </a>
 </>
 ) : null}
 . A candidate can only ever produce one Acca, so no further action is available.
 </p>
 );
 }
 if (status === "REJECTED") {
 return (
 <p className="text-sm text-[var(--ink-secondary)]" role="status">
 This candidate was rejected. Rejection is final — no further action is available.
 </p>
 );
 }
 return (
 <p className="text-sm text-[var(--ink-secondary)]" role="status">
 No action is available from this state.
 </p>
 );
}

/* ------------------------------------------------------------------ *
 * DRAFT: approve / reject
 * ------------------------------------------------------------------ */

function DraftActions({
 candidateId,
 expectedVersion,
}: {
 candidateId: string;
 expectedVersion: number;
}) {
 const router = useRouter();
 const [mode, setMode] = useState<"idle" | "approve" | "reject">("idle");
 const [reason, setReason] = useState("");
 const [pending, setPending] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const approveKey = useStableKey("approve");
 const rejectKey = useStableKey("reject");

 const reasonTrimmed = reason.trim();
 const reasonInvalid = reasonTrimmed === "" || reasonTrimmed.length > REASON_MAX;

 async function submit(action: "approve" | "reject") {
 setPending(true);
 setError(null);
 const body: Record<string, unknown> = { expectedVersion };
 if (action === "reject") body.rejectionReason = reasonTrimmed;

 const result = await postAction(
 `${CANDIDATE_BASE}/${candidateId}/${action}`,
 action === "approve" ? approveKey : rejectKey,
 body,
 );
 setPending(false);
 if (!result.ok) {
 setError(result.message);
 return;
 }
 setMode("idle");
 router.refresh();
 }

 return (
 <div>
 {mode === "idle" ? (
 <div className="flex flex-wrap gap-2">
 <button
 type="button"
 onClick={() => {
 setError(null);
 setMode("approve");
 }}
 className="inline-flex min-h-10 items-center rounded-md border border-[var(--green-primary)] bg-[var(--green-surface)] px-4 text-sm font-medium text-brand hover:bg-[var(--green-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 Approve candidate
 </button>
 <button
 type="button"
 onClick={() => {
 setError(null);
 setMode("reject");
 }}
 className="inline-flex min-h-10 items-center rounded-md border border-border px-4 text-sm text-foreground hover:bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 Reject candidate
 </button>
 </div>
 ) : null}

 {mode === "approve" ? (
 <div className="rounded-lg border border-border bg-[var(--surface-elevated)] p-4">
 <h3 className="text-sm font-semibold text-foreground">Approve this candidate?</h3>
 <p className="mt-1 text-xs text-[var(--ink-secondary)]">
 Approving marks it eligible to become an Acca. It does not create an Acca, does not
 publish anything, and has no public effect.
 </p>
 <div className="mt-3 flex flex-wrap gap-2">
 <ConfirmButton pending={pending} onClick={() => submit("approve")} label="Yes, approve" />
 <CancelButton pending={pending} onClick={() => setMode("idle")} />
 </div>
 </div>
 ) : null}

 {mode === "reject" ? (
 <div className="rounded-lg border border-border bg-[var(--surface-elevated)] p-4">
 <h3 className="text-sm font-semibold text-foreground">Reject this candidate?</h3>
 <p className="mt-1 text-xs text-[var(--ink-secondary)]">
 Rejection is final. Record why, so the decision is auditable later.
 </p>
 <label htmlFor="rejectionReason" className="mt-3 block text-xs text-[var(--ink-secondary)]">
 Reason (required, up to {REASON_MAX} characters)
 </label>
 <textarea
 id="rejectionReason"
 value={reason}
 onChange={(e) => setReason(e.target.value)}
 rows={3}
 maxLength={REASON_MAX + 50}
 className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 />
 <p className="mt-1 text-xs text-muted-foreground">
 {reasonTrimmed.length} / {REASON_MAX}
 </p>
 <div className="mt-3 flex flex-wrap gap-2">
 <ConfirmButton
 pending={pending}
 disabled={reasonInvalid}
 onClick={() => submit("reject")}
 label="Yes, reject"
 />
 <CancelButton pending={pending} onClick={() => setMode("idle")} />
 </div>
 </div>
 ) : null}

 <ErrorNote error={error} />
 </div>
 );
}

/* ------------------------------------------------------------------ *
 * APPROVED: create Acca
 * ------------------------------------------------------------------ */

function CreateAccaForm({
 candidateId,
 expectedVersion,
}: {
 candidateId: string;
 expectedVersion: number;
}) {
 const router = useRouter();
 const [open, setOpen] = useState(false);
 const [title, setTitle] = useState("");
 const [summary, setSummary] = useState("");
 const [locale, setLocale] = useState("en");
 const [pending, setPending] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const key = useStableKey("create-acca");

 const titleTrimmed = title.trim();
 const summaryTrimmed = summary.trim();
 const titleInvalid = titleTrimmed === "" || titleTrimmed.length > TITLE_MAX;
 const summaryInvalid = summaryTrimmed.length > SUMMARY_MAX;

 async function submit() {
 setPending(true);
 setError(null);
 const body: Record<string, unknown> = {
 expectedCandidateVersion: expectedVersion,
 title: titleTrimmed,
 locale,
 };
 if (summaryTrimmed !== "") body.summary = summaryTrimmed;

 const result = await postAction(`${CANDIDATE_BASE}/${candidateId}/create-acca`, key, body);
 setPending(false);
 if (!result.ok) {
 setError(result.message);
 return;
 }
 const acca = result.body.acca as { accaId?: unknown } | undefined;
 if (acca && typeof acca.accaId === "string") {
 router.push(`/admin/accas/${acca.accaId}`);
 return;
 }
 router.refresh();
 }

 if (!open) {
 return (
 <div>
 <button
 type="button"
 onClick={() => {
 setError(null);
 setOpen(true);
 }}
 className="inline-flex min-h-10 items-center rounded-md border border-[var(--green-primary)] bg-[var(--green-surface)] px-4 text-sm font-medium text-brand hover:bg-[var(--green-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 Create Acca from this candidate
 </button>
 <ErrorNote error={error} />
 </div>
 );
 }

 return (
 <div className="rounded-lg border border-border bg-[var(--surface-elevated)] p-4">
 <h3 className="text-sm font-semibold text-foreground">Create an Acca</h3>
 <p className="mt-1 text-xs text-[var(--ink-secondary)]">
 The selections, captured odds, evidence and combined price are copied from this candidate
 and recalculated server-side. You choose only how it is presented. The Acca is created as a
 draft and is not publicly visible.
 </p>

 <label htmlFor="accaTitle" className="mt-3 block text-xs text-[var(--ink-secondary)]">
 Title (required, up to {TITLE_MAX} characters)
 </label>
 <input
 id="accaTitle"
 type="text"
 value={title}
 onChange={(e) => setTitle(e.target.value)}
 maxLength={TITLE_MAX + 20}
 className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 />
 <p className="mt-1 text-xs text-muted-foreground">
 {titleTrimmed.length} / {TITLE_MAX}. Describe the evidence, not an outcome — avoid
 certainty language.
 </p>

 <label htmlFor="accaSummary" className="mt-3 block text-xs text-[var(--ink-secondary)]">
 Summary (optional, up to {SUMMARY_MAX} characters)
 </label>
 <textarea
 id="accaSummary"
 value={summary}
 onChange={(e) => setSummary(e.target.value)}
 rows={3}
 maxLength={SUMMARY_MAX + 50}
 className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 />
 <p className="mt-1 text-xs text-muted-foreground">
 {summaryTrimmed.length} / {SUMMARY_MAX}
 </p>

 <label htmlFor="accaLocale" className="mt-3 block text-xs text-[var(--ink-secondary)]">
 Locale
 </label>
 {/*
 Sprint 20B-B stage B6. A free-text field allowed a well-shaped but unserved locale, which
 produced an Acca no reader could ever reach. The API now refuses those; constraining the
 input to the locales this site actually serves prevents the mistake instead of reporting
 it after the fact.
 */}
 <select
 id="accaLocale"
 value={locale}
 onChange={(e) => setLocale(e.target.value)}
 className="mt-1 w-56 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 {locales.map((code) => (
 <option key={code} value={code}>
 {localeNames[code] ?? code} ({code})
 </option>
 ))}
 </select>
 <p className="mt-1 text-xs text-muted-foreground">
 The Acca is published under this language only. It will not appear in any other.
 </p>

 <div className="mt-4 flex flex-wrap gap-2">
 <ConfirmButton
 pending={pending}
 disabled={titleInvalid || summaryInvalid}
 onClick={submit}
 label="Create draft Acca"
 />
 <CancelButton pending={pending} onClick={() => setOpen(false)} />
 </div>

 <ErrorNote error={error} />
 </div>
 );
}

/* ------------------------------------------------------------------ *
 * Shared pieces
 * ------------------------------------------------------------------ */

function ConfirmButton({
 pending,
 disabled,
 onClick,
 label,
}: {
 pending: boolean;
 disabled?: boolean;
 onClick: () => void;
 label: string;
}) {
 return (
 <button
 type="button"
 onClick={onClick}
 disabled={pending || disabled}
 className="inline-flex min-h-10 items-center rounded-md border border-[var(--green-primary)] bg-[var(--green-surface)] px-4 text-sm font-medium text-brand hover:bg-[var(--green-surface)] disabled:cursor-not-allowed disabled:opacity-[var(--opacity-disabled)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 {pending ? "Working…" : label}
 </button>
 );
}

function CancelButton({ pending, onClick }: { pending: boolean; onClick: () => void }) {
 return (
 <button
 type="button"
 onClick={onClick}
 disabled={pending}
 className="inline-flex min-h-10 items-center rounded-md border border-border px-4 text-sm text-foreground hover:bg-card disabled:opacity-[var(--opacity-disabled)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 Cancel
 </button>
 );
}

function ErrorNote({ error }: { error: string | null }) {
 if (!error) return null;
 return (
 <p
 role="alert"
 className="mt-3 rounded border border-[var(--red-primary)] bg-[var(--red-surface)] px-3 py-2 text-sm text-[var(--red-primary)]"
 >
 {error}
 </p>
 );
}

/** One idempotency key per action per mount, stable across retries of that intent. */
function useStableKey(scope: string): string {
 const ref = useRef<string | null>(null);
 if (ref.current === null) {
 const uuid =
 typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto
 ? globalThis.crypto.randomUUID()
 : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
 ref.current = `studio-${scope}-${uuid}`;
 }
 return ref.current;
}

type PostResult =
 | { ok: true; body: Record<string, unknown> }
 | { ok: false; message: string };

/**
 * POST helper.
 *
 * Only the failure CODE is ever used to build the message — no server-supplied text is
 * rendered, so nothing from a driver or a stack trace can reach the screen through this path.
 */
async function postAction(
 url: string,
 idempotencyKey: string,
 body: Record<string, unknown>,
): Promise<PostResult> {
 try {
 const response = await fetch(url, {
 method: "POST",
 headers: {"content-type": "application/json", "idempotency-key": idempotencyKey },
 body: JSON.stringify(body),
 });
 const parsed = (await response.json().catch(() => ({}))) as Record<string, unknown>;
 if (!response.ok) {
 return {
 ok: false,
 message: describeActionError(parsed.error, {
 currentStatus: parsed.currentStatus,
 retryAfterSec: Number(response.headers.get("retry-after")) || null,
 }),
 };
 }
 return { ok: true, body: parsed };
 } catch {
 return {
 ok: false,
 message: "The request could not be sent. Check your connection and try again.",
 };
 }
}
