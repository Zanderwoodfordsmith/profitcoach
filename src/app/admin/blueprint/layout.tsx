"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { BlueprintAdminViews } from "@/components/admin/BlueprintAdminViews";
import { CoachesHubTabs } from "@/components/admin/CoachesHubTabs";
import { StickyPageHeader } from "@/components/layout";

export default function AdminBlueprintLayout({ children }: { children: ReactNode }) {
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  // Sticky table headers on the map sit just under this header.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setHeaderHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="flex flex-col gap-5"
      style={{ "--blueprint-header-h": `${headerHeight}px` } as CSSProperties}
    >
      <StickyPageHeader title="Blueprint" tabs={<CoachesHubTabs />} rootRef={headerRef} />
      <BlueprintAdminViews />
      {children}
    </div>
  );
}
