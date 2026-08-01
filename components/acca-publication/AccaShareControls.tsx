"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  trackPublicAccaEvent,
  type PublicAccaAnalyticsProperties,
} from "@/lib/acca-publication/analytics";

/**
 * Share controls for a published Acca (Sprint 24).
 *
 * THE ONLY INTERACTIVE PART OF THE PAGE. Everything else on a public Acca page is server-rendered
 * and static, so this island is small on purpose: two buttons, a status line and a selectable
 * input. No modal, no menu, no portal, no third-party widget, no tracking pixel.
 *
 * CANONICAL URL ONLY. The URL is passed in already absolute and already canonical, built by
 * `publicAccaCanonicalUrl`. It is never read from `window.location`, so a link shared from a page
 * reached with a stray query string still points at the canonical address — which is also what
 * keeps shared links from fragmenting into near-duplicate URLs.
 *
 * PROGRESSIVE ENHANCEMENT, IN BOTH DIRECTIONS
 *
 *   no JavaScript      the input still holds the canonical URL and can be selected and copied
 *   JavaScript, no Web Share API   the copy button uses the async clipboard
 *   Web Share API      an additional native share button appears
 *
 * The native button is revealed in an effect rather than during render because `navigator.share`
 * does not exist on the server: branching on it during render would produce different server and
 * client trees and a hydration error.
 *
 * ACCESSIBILITY
 *
 *   - Native `<button>` elements: focusable, Enter/Space activated, no key handling of our own.
 *   - Every outcome is announced through one polite live region, including failures. A copy
 *     button that silently does nothing is unusable without sight of the clipboard.
 *   - When the clipboard is refused the input is focused and selected, and the status says so, so
 *     the manual path is reachable by keyboard rather than being a dead end.
 *   - The input is labelled and read-only rather than disabled, because a disabled input is not
 *     reachable by keyboard and its text cannot be selected.
 */

export type AccaShareContext = Omit<PublicAccaAnalyticsProperties, "surface" | "shareMethod">;

export function AccaShareControls({
  url,
  title,
  context,
}: {
  /** Absolute canonical URL. */
  url: string;
  /** Acca title, used as the native share sheet's subject. */
  title: string;
  context: AccaShareContext;
}) {
  const [nativeShareAvailable, setNativeShareAvailable] = useState(false);
  const [status, setStatus] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  useEffect(() => {
    setNativeShareAvailable(
      typeof navigator !== "undefined" && typeof navigator.share === "function",
    );
  }, []);

  const track = (
    event: "acca_share_open" | "acca_share_copy" | "acca_share_native",
    shareMethod: "native" | "clipboard" | "manual",
  ) => {
    trackPublicAccaEvent(event, { ...context, surface: "acca_detail", shareMethod });
  };

  const selectManually = () => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  };

  const onCopy = async () => {
    track("acca_share_open", "clipboard");
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Link copied to the clipboard.");
      track("acca_share_copy", "clipboard");
    } catch {
      // Clipboard access is refused in plenty of ordinary situations — an insecure origin, a
      // permissions policy, a browser that never implemented it. Say so and hand over a path
      // that always works rather than failing silently.
      setStatus("The clipboard is not available here. The link is selected — copy it manually.");
      selectManually();
      track("acca_share_copy", "manual");
    }
  };

  const onNativeShare = async () => {
    track("acca_share_open", "native");
    try {
      await navigator.share({ title, url });
      setStatus("Share sheet opened.");
      track("acca_share_native", "native");
    } catch {
      // A dismissed share sheet rejects exactly like a failure. Neither is an error worth
      // shouting about, and neither is reported as a completed share.
      setStatus("");
    }
  };

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
        >
          Copy link
        </button>
        {nativeShareAvailable ? (
          <button
            type="button"
            onClick={onNativeShare}
            className="inline-flex items-center rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
          >
            Share…
          </button>
        ) : null}
      </div>

      <label htmlFor={inputId} className="mt-3 block text-xs uppercase tracking-label text-muted-foreground">
        Link to this page
      </label>
      <input
        id={inputId}
        ref={inputRef}
        type="text"
        readOnly
        value={url}
        onFocus={(event) => event.currentTarget.select()}
        className="mt-1 w-full max-w-xl rounded-lg border border-border bg-black/20 px-3 py-2 font-mono text-xs text-[var(--ink-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
      />

      <p role="status" aria-live="polite" className="mt-2 min-h-[1.25rem] text-xs text-[var(--ink-secondary)]">
        {status}
      </p>
    </div>
  );
}
