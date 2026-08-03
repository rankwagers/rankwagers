import { useEffect, useRef, useState } from "react";

/* ============================================================================
   THE MOTION RUNTIME
   ----------------------------------------------------------------------------
   Every animated number on this page is driven from here, on the same curves
   the stylesheet uses. A counter and the rule underneath it decelerate
   identically because they are literally the same cubic bézier.
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
    for (let i = 0; i < 4; i++) {
      const slope = slopeX(t);
      if (slope === 0) break;
      t -= (sampleX(t) - x) / slope;
    }
    return sampleY(t);
  };
}

/** --ease-settle — entrances, counters, anything resolving into place. */
export const settle = bezier(0.16, 1, 0.3, 1);
/** --ease-glide — live data moving to a new reading. */
export const glide = bezier(0.33, 0, 0.15, 1);

/** The duration scale, mirrored from the stylesheet. */
export const DUR = {
  respond: 520,
  expand: 900,
  reveal: 1300,
  resolve: 2400,
  live: 1100,
} as const;

export const REDUCED = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Runs a curve from `from` → `to` and hands back each frame. Returns a cancel. */
function ramp(
  from: number,
  to: number,
  duration: number,
  ease: (t: number) => number,
  onFrame: (v: number) => void,
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
 * Scroll reveal. Adds `is-in` once the element has entered; stagger children
 * with the `--i` custom property so a group arrives in sequence.
 *
 * Elements are observed early and low, so content begins resolving while it is
 * still below the fold and is already sharp by the time it is being read.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(threshold = 0.12) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (REDUCED()) {
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
      { threshold, rootMargin: "0px 0px -4% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return ref;
}

/**
 * A value that resolves from 0 → target on mount, or after `delay`. If the
 * target later changes — a different fixture is selected — it travels from
 * wherever it currently is, on the same curve. A reading is never seen to
 * restart from zero.
 */
export function useResolve(target: number, duration: number = DUR.resolve, delay = 0) {
  const [value, setValue] = useState(0);
  const current = useRef(0);
  const mounted = useRef(false);

  useEffect(() => {
    if (REDUCED()) {
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
 * A value that resolves whenever `active` turns on — and, when it turns off,
 * retreats along the same curve instead of being cut. Nothing snaps back.
 */
export function useResolveWhen(target: number, active: boolean, duration: number = DUR.expand) {
  const [value, setValue] = useState(0);
  const current = useRef(0);

  useEffect(() => {
    if (REDUCED()) {
      current.current = active ? target : 0;
      setValue(current.current);
      return;
    }
    const to = active ? target : 0;
    // Retreating is a little quicker than arriving, but never abrupt.
    return ramp(current.current, to, active ? duration : duration * 0.72, settle, (v) => {
      current.current = v;
      setValue(v);
    });
  }, [active, target, duration]);

  return value;
}

/** A value that resolves the first time it scrolls into view. */
export function useResolveOnView(target: number, decimals = 0, duration: number = DUR.resolve) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [value, setValue] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (REDUCED()) {
      setValue(target);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || started.current) return;
        started.current = true;
        ramp(0, target, duration, settle, setValue);
      },
      { threshold: 0.35, rootMargin: "0px 0px -6% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [target, duration]);

  return { ref, text: value.toFixed(decimals) };
}

/**
 * A live reading. When the underlying number changes, the display glides from
 * where it was to where it now is — a match minute or an xG figure is never
 * seen to jump.
 */
export function useLive(target: number, duration: number = DUR.live) {
  const [value, setValue] = useState(target);
  const current = useRef(target);

  useEffect(() => {
    if (REDUCED()) {
      current.current = target;
      setValue(target);
      return;
    }
    return ramp(current.current, target, duration, glide, (v) => {
      current.current = v;
      setValue(v);
    });
  }, [target, duration]);

  return value;
}

/**
 * Hover intent. A cursor crossing a row on its way somewhere else should not
 * trigger anything; a cursor that comes to rest should. The delay is short
 * enough to feel immediate and long enough to feel deliberate.
 */
export function useIntent(onEnter: () => void, delay = 110) {
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return {
    enter: () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(onEnter, delay);
    },
    cancel: () => window.clearTimeout(timer.current),
  };
}
