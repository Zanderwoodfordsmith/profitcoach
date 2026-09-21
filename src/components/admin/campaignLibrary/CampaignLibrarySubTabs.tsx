"use client";

import { PageHeaderUnderlineTabs } from "@/components/layout/PageHeaderUnderlineTabs";
import type { ReactNode } from "react";
import type { CampaignLibraryItemType } from "@/lib/campaignLibrary/types";
import { libraryListHref } from "@/lib/campaignLibrary/types";

export function CampaignLibrarySubTabs({
  active,
  actions,
}: {
  active: CampaignLibraryItemType;
  actions?: ReactNode;
}) {
  return (
    <div className="border-b border-slate-200 pt-1">
      <div className="flex min-h-10 flex-nowrap items-center justify-between gap-x-4">
        <PageHeaderUnderlineTabs
          placement="header"
          className="min-w-0 self-end"
          ariaLabel="Campaign library sections"
          items={[
            {
              kind: "link",
              href: libraryListHref("template"),
              label: "Templates",
              active: active === "template",
              scroll: false,
            },
            {
              kind: "link",
              href: libraryListHref("sequence"),
              label: "Campaign sequences",
              active: active === "sequence",
              scroll: false,
            },
            {
              kind: "link",
              href: libraryListHref("step"),
              label: "Steps",
              active: active === "step",
              scroll: false,
            },
          ]}
        />
        <div className="-mb-px flex min-h-8 flex-wrap items-center gap-2.5 pb-2">
          {actions}
        </div>
      </div>
    </div>
  );
}
