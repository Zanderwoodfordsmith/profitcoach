"use client";

import { usePathname } from "next/navigation";

import { PageHeaderUnderlineTabs } from "@/components/layout";

export function CoachesHubTabs() {
  const pathname = usePathname();
  const onCoachesList =
    pathname === "/admin" || pathname === "/admin/";
  const onClientSuccess =
    pathname === "/admin/client-success" ||
    Boolean(pathname?.startsWith("/admin/client-success/"));
  const onRevenue =
    pathname === "/admin/client-success/revenue" ||
    Boolean(pathname?.startsWith("/admin/client-success/revenue/"));
  const onUsage =
    pathname === "/admin/client-success/usage" ||
    Boolean(pathname?.startsWith("/admin/client-success/usage/"));

  return (
    <PageHeaderUnderlineTabs
      ariaLabel="Coaches views"
      items={[
        {
          kind: "link",
          href: "/admin",
          label: "Coaches",
          active: onCoachesList,
        },
        {
          kind: "link",
          href: "/admin/client-success",
          label: "Client success",
          active: onClientSuccess && !onRevenue && !onUsage,
        },
        {
          kind: "link",
          href: "/admin/client-success/revenue",
          label: "Revenue",
          active: onRevenue,
        },
        {
          kind: "link",
          href: "/admin/client-success/usage",
          label: "Usage",
          active: onUsage,
        },
      ]}
    />
  );
}
