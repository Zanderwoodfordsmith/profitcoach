"use client";

import { useCallback, useEffect, useState } from "react";
import { DEMO_PREVIEW_STORAGE_KEY } from "@/lib/campaigns/demoPreview";

export function useCampaignDemoPreview() {
  const [enabled, setEnabledState] = useState(false);

  useEffect(() => {
    try {
      setEnabledState(
        window.localStorage.getItem(DEMO_PREVIEW_STORAGE_KEY) === "1"
      );
    } catch {
      /* private mode */
    }
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    try {
      window.localStorage.setItem(DEMO_PREVIEW_STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* private mode */
    }
  }, []);

  return { enabled, setEnabled };
}
