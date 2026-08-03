"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

/* ============================================================================
   HERO MOTION RUNTIME
   ----------------------------------------------------------------------------
   Every animated number in the hero is driven from here, on the same curves the
   stylesheet uses. A counter and the rule underneath it decelerate identically
   because they are literally the same cubic bézier.
   ========================================================================== */

/** A real cubic-bézier sampler, so JS and CSS share one curve. */
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    // Newton–Raphson: four passes is exact enough for a screen.
    let t = x;
    for (let i = 0; i < 4; i += 1) {
      const slope = slopeX(t);
      if (slope === 0) break;
      t -= (sampleX(t) - x) / slope;
    }
    return sampleY(t);
  };
}

/** --ease-settle — entrances, counters, anything resolving into place. */
export const settle = bezier(0.16, 1, 0.3, 1);

/** The duration scale, mirrored from the stylesheet. */
export const DUR = {
  respond: 520,
  expand: 900,
  reveal: 1300,
  resolve: 2400,
  live: 1100,
} as const;

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Runs a curve from `from` → `to` and hands back each frame. Returns a cancel. */
function ramp(
  from: number,
  to: number,
  duration: number,
  ease: (t: number) => number,
  onFrame: (value: number) => void
) {
  let raf = 0;
  const start = performance.now();
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    onFrame(from + (to - from) * ease(t));
    if (t < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

/**
 * Scroll reveal. Adds `is-in` once the element has entered.
 *
 * Elements are observed early and low, so content begins resolving while it is still below the
 * fold and is already sharp by the time it is being read.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(threshold = 0.12) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      node.classList.add("is-in");
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold, rootMargin: "0px 0px -4% 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return ref;
}

/**
 * A value that resolves from 0 → target on mount, or after `delay`. If the target later changes —
 * a different fixture is selected — it travels from wherever it currently is, on the same curve.
 * A reading is never seen to restart from zero.
 */
export function useResolve(target: number, duration: number = DUR.resolve, delay = 0) {
  const [value, setValue] = useState(0);
  const current = useRef(0);
  const mounted = useRef(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      current.current = target;
      setValue(target);
      return;
    }
    let cancel = () => {};
    const from = current.current;
    // The staged entrance delay belongs to the first arrival only.
    const wait = mounted.current ? 0 : delay;
    const span = mounted.current ? duration * 0.6 : duration;
    mounted.current = true;
    const timer = window.setTimeout(() => {
      cancel = ramp(from, target, span, settle, (v) => {
        current.current = v;
        setValue(v);
      });
    }, wait);
    return () => {
      window.clearTimeout(timer);
      cancel();
    };
  }, [target, duration, delay]);

  return value;
}

/**
 * Hover intent. A cursor crossing a row on its way somewhere else should not trigger anything; a
 * cursor that comes to rest should. The delay is short enough to feel immediate and long enough to
 * feel deliberate.
 */
export function useIntent(onEnter: () => void, delay = 110) {
  const timer = useRef(0);
  const handler = useRef(onEnter);
  handler.current = onEnter;

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const enter = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => handler.current(), delay);
  }, [delay]);

  const cancel = useCallback(() => window.clearTimeout(timer.current), []);

  return { enter, cancel };
}

/**
 * Two-plane pointer drift for the hero stage.
 *
 * Writes `--px` / `--py` on the stage element. Coalesced onto a single animation frame — the
 * approved design writes on every `mousemove`, which on a pointer-heavy machine is several hundred
 * style invalidations a second for a 12px parallax. The visual result is identical.
 */
export function usePointerDrift<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T | null>(null);
  const raf = useRef(0);
  const next = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const flush = useCallback(() => {
    raf.current = 0;
    const node = ref.current;
    const point = next.current;
    if (!node || !point) return;
    node.style.setProperty("--px", point.x.toFixed(3));
    node.style.setProperty("--py", point.y.toFixed(3));
  }, []);

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<T>) => {
      // Touch drives scroll, not parallax; a drifting stage under a finger reads as a bug.
      if (event.pointerType !== "mouse") return;
      const node = ref.current;
      if (!node || prefersReducedMotion()) return;
      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      next.current = {
        x: (event.clientX - rect.left) / rect.width - 0.5,
        y: (event.clientY - rect.top) / rect.height - 0.5,
      };
      if (!raf.current) raf.current = requestAnimationFrame(flush);
    },
    [flush]
  );

  const onPointerLeave = useCallback(() => {
    next.current = { x: 0, y: 0 };
    if (!raf.current) raf.current = requestAnimationFrame(flush);
  }, [flush]);

  return { ref, onPointerMove, onPointerLeave };
}
