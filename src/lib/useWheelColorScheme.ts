"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "boss-wheel-color-scheme";

export type WheelColorScheme = "default" | "alt";

export function useWheelColorScheme() {
  const [scheme, setSchemeState] = useState<WheelColorScheme>("alt");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as WheelColorScheme | null;
      if (stored === "default" || stored === "alt") {
        setSchemeState(stored);
      }
    } catch {
      // ignore
    }
  }, []);

  const setScheme = useCallback((value: WheelColorScheme) => {
    setSchemeState(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // ignore
    }
  }, []);

  return [scheme, setScheme] as const;
}

export function getWheelColorScheme(): WheelColorScheme {
  if (typeof window === "undefined") return "alt";
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as WheelColorScheme | null;
    return stored === "default" || stored === "alt" ? stored : "alt";
  } catch {
    return "alt";
  }
}
