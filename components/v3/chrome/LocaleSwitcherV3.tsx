"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { locales, localeNames, isLocale, type Locale } from "@/lib/i18n";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from "@/lib/localePreference";

/* The v3 locale switcher (Bible V3, chrome): a compact "EN ▾" pill that opens
   a listbox of all 30 locales. Replaces the native <select> of the v2
   LanguageSwitcher inside the v3 header — same path-building and cookie
   behavior, v3 skin. The caret is a text glyph (icon law: no inline SVG
   outside the sanctioned files); the panel opens with no animation (motion
   law: a menu opening earns none) and no elevation (a v3 surface that needs
   separation gets a line). Focus ring comes from the `.rw3 :focus-visible`
   scope rule — focus stays on the trigger, the active option is tracked via
   aria-activedescendant. */

function localePath(pathname: string, locale: Locale): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] && isLocale(segments[0])) {
    segments[0] = locale;
  } else {
    segments.unshift(locale);
  }
  return `/${segments.join("/")}`;
}

export function LocaleSwitcherV3({ current }: { current: Locale }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => Math.max(0, locales.indexOf(current)));
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const baseId = useId();
  const listId = `${baseId}-list`;
  const optionId = (locale: Locale) => `${baseId}-${locale}`;

  /* Identical to the v2 LanguageSwitcher: remember the preference in the
     locale cookie, swap the leading path segment, full navigation. */
  function switchTo(locale: Locale) {
    if (locale === current) {
      setOpen(false);
      return;
    }
    try {
      document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(locale)}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
    } catch {
      /* ignore */
    }
    const next = localePath(pathname || `/${current}`, locale);
    window.location.assign(next);
  }

  function toggle() {
    if (!open) setActive(Math.max(0, locales.indexOf(current)));
    setOpen(!open);
  }

  function onTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      /* Enter/Space fire the native click (toggle). Arrows open too. */
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setActive(Math.max(0, locales.indexOf(current)));
        setOpen(true);
      }
      return;
    }
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActive((i) => Math.min(i + 1, locales.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        break;
      case "Home":
        event.preventDefault();
        setActive(0);
        break;
      case "End":
        event.preventDefault();
        setActive(locales.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        switchTo(locales[active]);
        break;
      case "Escape":
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
        break;
      case "Tab":
        /* Not prevented: focus moves on, the panel closes behind it. */
        setOpen(false);
        break;
    }
  }

  /* Click outside closes. */
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  /* Keep the active option in view while arrowing through 30 locales. */
  useEffect(() => {
    if (!open) return;
    document.getElementById(optionId(locales[active]))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active]);

  return (
    <div ref={rootRef} style={{ position: "relative", display: "inline-flex" }}>
      <button
        ref={buttonRef}
        type="button"
        /* The APG select-only combobox: focus stays on the trigger, so the
           trigger carries the active descendant — which requires the
           combobox role (a plain button does not support the attribute). */
        role="combobox"
        aria-label="Language"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? optionId(locales[active]) : undefined}
        onClick={toggle}
        onKeyDown={onTriggerKeyDown}
        className="rw3-hoverable"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          height: 32,
          padding: "0 10px",
          border: "1px solid var(--line)",
          borderRadius: 6,
          background: "var(--surface)",
          color: "var(--text)",
          fontSize: 12,
          fontWeight: 500,
          whiteSpace: "nowrap",
        }}
      >
        {current.toUpperCase()}
        <span aria-hidden style={{ fontSize: 10, color: "var(--muted)" }}>
          ▾
        </span>
      </button>

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label="Language"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            zIndex: 40,
            minWidth: 184,
            maxHeight: 316,
            overflowY: "auto",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 6,
            padding: 4,
          }}
        >
          {locales.map((locale, index) => {
            const selected = locale === current;
            const isActive = index === active;
            return (
              <div
                key={locale}
                id={optionId(locale)}
                role="option"
                aria-selected={selected}
                onClick={() => switchTo(locale)}
                onMouseEnter={() => setActive(index)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 8px",
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  background: isActive ? "var(--hover)" : "transparent",
                  color: selected ? "var(--accent)" : "var(--text)",
                }}
              >
                <span style={{ fontWeight: 600, minWidth: 42 }}>{locale.toUpperCase()}</span>
                <span style={{ color: selected ? "var(--accent)" : "var(--muted)" }}>
                  {localeNames[locale]}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
