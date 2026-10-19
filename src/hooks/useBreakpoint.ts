"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

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

/**
 * True/false once the viewport is known, null while hydrating a server render.
 * Unlike useBreakpoint it is right on the first client render, so it can
 * decide which of two layouts to mount instead of mounting both and hiding
 * one with CSS (which doubled their data loading).
 */
export function useMatchesBreakpoint(key: BreakpointKey): boolean | null {
  const query = `(min-width: ${BREAKPOINTS[key]}px)`;
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => null
  );
}
