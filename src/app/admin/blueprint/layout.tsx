"use client";

import { useCallback, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { BlueprintAdminViews } from "@/components/admin/BlueprintAdminViews";
import { BlueprintToolbarProvider } from "@/components/admin/BlueprintCoachPreview";
import { StickyPageHeader } from "@/components/layout";

/** Main has no horizontal padding on blueprint routes, so the bar only insets its contents. */
const HEADER_BLEED = "px-4 md:px-6";

export default function AdminBlueprintLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const coachView = Boolean(pathname?.startsWith("/admin/blueprint/coach"));
  const [toolbar, setToolbarNode] = useState<ReactNode>(null);
  const setToolbar = useCallback((node: ReactNode) => {
    setToolbarNode(node);
  }, []);

  return (
    <BlueprintToolbarProvider setToolbar={setToolbar}>
      <div className="flex h-full min-h-0 flex-col">
        <StickyPageHeader
          title="Blueprint"
          tabs={<BlueprintAdminViews />}
          below={toolbar}
          bleedInset={HEADER_BLEED}
        />
        <div
          className={
            coachView
              ? "min-h-0 flex-1 overflow-hidden bg-white"
              : "min-h-0 flex-1 overflow-y-auto"
          }
        >
          {coachView ? (
            children
          ) : (
            <div className="px-4 py-5 md:px-6">{children}</div>
          )}
        </div>
      </div>
    </BlueprintToolbarProvider>
  );
}
