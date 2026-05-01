"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "boss-wheel-view-mode";

export type WheelViewMode = "areas" | "pillars" | "levels";

export function useWheelViewMode() {
  const [viewMode, setViewModeState] = useState<WheelViewMode>("areas");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as WheelViewMode | null;
      if (stored === "areas" || stored === "pillars" || stored === "levels") {
        setViewModeState(stored);
      }
    } catch {
      // ignore
    }
  }, []);

  const setViewMode = useCallback((value: WheelViewMode) => {
    setViewModeState(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // ignore
    }
  }, []);

  return [viewMode, setViewMode] as const;
}
