"use client";

import type { ReactNode } from "react";
import { PageHeaderUnderlineTabs } from "@/components/layout/PageHeaderUnderlineTabs";

type Props = {
  prefix: "/coach" | "/admin";
  active: "campaigns" | "pool" | "magnets";
  actions?: ReactNode;
};

export function CampaignsSubTabs({ prefix, active, actions }: Props) {
  return (
    <div className="border-b border-slate-200 pt-1">
      <div className="flex min-h-10 flex-nowrap items-center justify-between gap-x-4">
        <PageHeaderUnderlineTabs
          placement="header"
          className="min-w-0 self-end"
          ariaLabel="Campaigns sections"
          items={[
            {
              kind: "link",
              href: `${prefix}/campaigns?tab=pool`,
              label: "Pool",
              active: active === "pool",
              scroll: false,
            },
            {
              kind: "link",
              href: `${prefix}/campaigns`,
              label: "Campaigns",
              active: active === "campaigns",
              scroll: false,
            },
            {
              kind: "link",
              href: `${prefix}/campaigns?tab=magnets`,
              label: "Lead Magnets",
              active: active === "magnets",
              scroll: false,
            },
          ]}
        />
        {/* Always reserve action-row height so Pool / Magnets match Campaigns. */}
        <div className="-mb-px flex min-h-8 flex-wrap items-center gap-2.5 pb-2">
          {actions}
        </div>
      </div>
    </div>
  );
}
