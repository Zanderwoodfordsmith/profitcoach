"use client";

import { ACADEMY_INFO, AcademyTabs } from "@/components/academy/AcademyTabs";
import { StickyPageHeader } from "@/components/layout";

export function ClassroomShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <StickyPageHeader
        title="Academy"
        tabs={<AcademyTabs />}
        description={ACADEMY_INFO}
      />
      {children}
    </div>
  );
}
