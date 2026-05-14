"use client";

import { createContext, useContext, type ReactNode } from "react";

export type BossWorkshopChromeContextValue = {
  /** Coach/admin BOSS workshop with nav rail collapsed — minimal top chrome. */
  isMinimalWorkshopChrome: boolean;
  setWorkshopTopRight: (node: ReactNode | null) => void;
};

export const BossWorkshopChromeContext = createContext<BossWorkshopChromeContextValue | null>(null);

export function useBossWorkshopChrome() {
  return useContext(BossWorkshopChromeContext);
}
