"use client";

import type { ReactNode } from "react";

type Props = {
  prefix: "/coach" | "/admin";
  active: "campaigns" | "pool" | "magnets";
  actions?: ReactNode;
};

/**
 * The row under the Get Calls tabs on Campaigns, Lead Lists and Lead Magnets.
 * Those three are top tabs since 25 Nov 2026, so this row holds only the page's buttons.
 */
export function CampaignsSubTabs({ actions }: Props) {
  if (!actions) return null;
  return (
    <div className="border-b border-slate-200 pt-1">
      <div className="flex min-h-10 flex-nowrap items-center justify-end gap-x-4">
        <div className="-mb-px flex min-h-8 flex-wrap items-center gap-2.5 pb-2">
          {actions}
        </div>
      </div>
    </div>
  );
}
