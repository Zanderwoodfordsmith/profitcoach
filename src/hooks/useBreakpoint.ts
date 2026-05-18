"use client";

import { useEffect, useState } from "react";

/** Tailwind default breakpoints (min-width). */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

export type BreakpointKey = keyof typeof BREAKPOINTS;

function matchesMinWidth(key: BreakpointKey): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(`(min-width: ${BREAKPOINTS[key]}px)`).matches;
}

/**
 * True when viewport width is at or above the Tailwind breakpoint.
 * Use sparingly when CSS alone cannot switch layouts (e.g. calendar view mode).
 */
export function useBreakpoint(key: BreakpointKey): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${BREAKPOINTS[key]}px)`);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [key]);

  return matches;
}

/** True when viewport is below the Tailwind breakpoint. */
export function useBelowBreakpoint(key: BreakpointKey): boolean {
  const atOrAbove = useBreakpoint(key);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return false;
  return !atOrAbove;
}
