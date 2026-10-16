"use client";

import type { ReactNode } from "react";

import { StickyPageHeader } from "@/components/layout";

/** Main has no horizontal padding on blueprint routes, so the bar only insets its contents. */
const HEADER_BLEED = "px-4 md:px-6";

/** Admin → Blueprint: the coach's blueprint as they see it. The coach switcher lives in its sidebar. */
export default function AdminBlueprintLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <StickyPageHeader title="My Blueprint" bleedInset={HEADER_BLEED} />
      <div className="min-h-0 flex-1 overflow-hidden bg-white">{children}</div>
    </div>
  );
}
