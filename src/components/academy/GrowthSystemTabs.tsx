"use client";

import { usePathname } from "next/navigation";

import { PageHeaderUnderlineTabs } from "@/components/layout/PageHeaderUnderlineTabs";

export function GrowthSystemTabs() {
  const pathname = usePathname();

  return (
    <PageHeaderUnderlineTabs
      ariaLabel="Growth System views"
      items={[
        {
          kind: "link",
          href: "/admin/growth-system",
          label: "Overview",
          active: pathname === "/admin/growth-system",
        },
        {
          kind: "link",
          href: "/admin/growth-system/lead-flow",
          label: "Lead Flow",
          active: pathname === "/admin/growth-system/lead-flow",
        },
        {
          kind: "link",
          href: "/admin/growth-system/lead-flow-horizontal",
          label: "Horizontal test",
          active: pathname.startsWith("/admin/growth-system/lead-flow-horizontal"),
        },
      ]}
    />
  );
}
