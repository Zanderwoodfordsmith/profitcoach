"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { ToolkitHubTabs } from "@/components/admin/ToolkitHubTabs";
import { StickyPageHeader } from "@/components/layout";

/**
 * Compass and Scorecard are admin tools under Tools & links (coaches are sent
 * back to Classroom; admins impersonating a coach still see the plain header).
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
  const isAdminArea = pathname.startsWith("/admin/signature");

  const scorecardHeader = useMemo(
    () => (
      <StickyPageHeader
        title="My Scorecard"
        description="Log weekly pipeline and revenue numbers; targets follow your ladder goal."
        tabs={isAdminArea ? <ToolkitHubTabs /> : undefined}
      />
    ),
    [isAdminArea]
  );

  const compassHeader = useMemo(
    () => (
      <StickyPageHeader
        title="Compass"
        description={
          isAdminArea
            ? "Tap the circle beside each line to score. To score with a coach, impersonate them first. Client Success shows everyone's scores."
            : "Tap the circle beside each line to score. The model updates as you go."
        }
        tabs={isAdminArea ? <ToolkitHubTabs /> : undefined}
      />
    ),
    [isAdminArea]
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

  return (
    <div className="flex flex-col gap-6">
      {compassHeader}
      {children}
    </div>
  );
}
