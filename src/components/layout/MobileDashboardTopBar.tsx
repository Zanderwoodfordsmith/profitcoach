"use client";

import type { DashboardSidebarVariant } from "./DashboardSidebar";
import { DashboardTopActions } from "./DashboardTopActions";

type MobileDashboardTopBarProps = {
  variant: DashboardSidebarVariant;
  signingOut: boolean;
  onSignOut: () => void | Promise<void>;
  avatarOverride?: {
    name: string;
    avatarUrl: string | null;
  } | null;
};

/** Fixed top bar on mobile: notifications only (account lives in bottom nav). */
export function MobileDashboardTopBar({
  variant,
  signingOut,
  onSignOut,
  avatarOverride,
}: MobileDashboardTopBarProps) {
  return (
    <div className="md:hidden">
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[90] flex justify-end px-3 pt-[max(0.375rem,env(safe-area-inset-top))]">
        <DashboardTopActions
          variant={variant}
          signingOut={signingOut}
          onSignOut={onSignOut}
          avatarOverride={avatarOverride}
          notificationsOnly
          className="pointer-events-auto !static !right-auto !top-auto"
        />
      </div>
    </div>
  );
}
