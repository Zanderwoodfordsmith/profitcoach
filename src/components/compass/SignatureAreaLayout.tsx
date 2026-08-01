"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { ClassroomShell } from "@/components/academy/ClassroomShell";
import { StickyPageHeader } from "@/components/layout";

/**
 * Compass home + Actions sit under Classroom chrome.
 * Scorecard is admin-only with a simple header (no Compass sidebar area).
 * Ladder redirects to Account settings.
 */
export function SignatureAreaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const isScorecard = pathname.includes("/signature/scorecard");
  const isLadder = pathname.includes("/signature/ladder");

  const scorecardHeader = useMemo(
    () => (
      <StickyPageHeader
        title="My Scorecard"
        description="Log weekly pipeline and revenue numbers; targets follow your ladder goal."
      />
    ),
    []
  );

  if (isLadder) {
    return <>{children}</>;
  }

  if (isScorecard) {
    return (
      <div className="flex flex-col gap-6">
        {scorecardHeader}
        <div className="pl-4 sm:pl-5 md:pl-6">{children}</div>
      </div>
    );
  }

  return <ClassroomShell>{children}</ClassroomShell>;
}
