"use client";

/**
 * A number that counts up to its value.
 *
 * ## Why it exists at all
 *
 * The hero is making an argument: that this data arrives from a few lines of code, and
 * watching a figure settle is what makes that argument legible rather than merely
 * asserted. A table that is simply *there* reads as a screenshot; one that fills in reads
 * as something that ran.
 *
 * ## It is not allowed to lie
 *
 * The animation ends on the exact value and never overshoots, `easeOut` only. A number
 * that bounces past its target and settles back is a number a reader briefly believes
 * something false about, which is a bad trade for a flourish.
 *
 * ## Every state update comes from the animation frame
 *
 * The state starts at the target, so the server-rendered HTML carries the real figure and
 * a reader without JavaScript sees it. The effect then hands over to
 * `requestAnimationFrame`, and **the frame callback is the only thing that ever calls
 * `setValue`**. No `setState` runs synchronously inside the effect body. That is not
 * fussiness: a synchronous update there is a second render on every mount, which the
 * `set-state-in-effect` lint rule exists to catch, and it is why the reset to zero lives
 * in the first frame rather than above the loop.
 *
 * ## Reduced motion never starts
 *
 * The effect returns before scheduling anything, so the value stays at the target from
 * the first paint, no flash of a counting figure for a reader who asked for no motion.
 */

import { useEffect, useState } from "react";

const DURATION_MS = 900;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useCountUp(target: number, options: { durationMs?: number } = {}): number {
  const duration = options.durationMs ?? DURATION_MS;

  // Seeded with the target, so the first paint, and the server-rendered markup, is
  // already correct. Only an animation ever moves it away from the truth.
  const [value, setValue] = useState(target);

  useEffect(() => {
    if (prefersReducedMotion() || duration <= 0 || !Number.isFinite(target)) return;

    const started = performance.now();
    let frame = 0;

    const step = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      // Ease-out cubic: quick off the mark, settling gently. No overshoot.
      const eased = 1 - (1 - progress) ** 3;

      setValue(progress < 1 ? target * eased : target);

      if (progress < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}
