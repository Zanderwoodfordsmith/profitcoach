"use client";

import type { ReactNode } from "react";

import { StickyPageHeader } from "@/components/layout";

/** Main has no horizontal padding on blueprint routes, so the bar only insets its contents. */
// md:px-7 lines the title up with the page menu's icons and group names below it.
const HEADER_BLEED = "px-4 md:px-7";

/** Admin → Blueprint: the coach's blueprint as they see it. The coach switcher lives in its sidebar. */
export default function AdminBlueprintLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <StickyPageHeader
        title="My Blueprint"
        bleedInset={HEADER_BLEED}
      />
      <div className="app-canvas-bg flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
