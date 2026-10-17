"use client";

import { usePathname } from "next/navigation";

import { PageHeaderUnderlineTabs } from "@/components/layout";

export function CoachesHubTabs() {
  const pathname = usePathname();
  const onCoachesList =
    pathname === "/admin" ||
    pathname === "/admin/" ||
    Boolean(pathname?.startsWith("/admin/coaches/"));
  const onClientSuccess =
    pathname === "/admin/client-success" ||
    Boolean(pathname?.startsWith("/admin/client-success/"));
  const onRevenue =
    pathname === "/admin/client-success/revenue" ||
    Boolean(pathname?.startsWith("/admin/client-success/revenue/"));
  const onBlueprint =
    pathname === "/admin/client-success/blueprint" ||
    Boolean(pathname?.startsWith("/admin/client-success/blueprint/"));
  const onUsage =
    pathname === "/admin/client-success/usage" ||
    Boolean(pathname?.startsWith("/admin/client-success/usage/"));
  const onActionPlans =
    pathname === "/admin/action-plans" ||
    Boolean(pathname?.startsWith("/admin/action-plans/")) ||
    pathname === "/admin/coach-groups" ||
    Boolean(pathname?.startsWith("/admin/coach-groups/"));

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
          active: onClientSuccess && !onRevenue && !onUsage && !onBlueprint,
        },
        {
          kind: "link",
          href: "/admin/client-success/blueprint",
          label: "Blueprint",
          active: onBlueprint,
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
        {
          kind: "link",
          href: "/admin/action-plans",
          label: "Action plans",
          active: onActionPlans,
        },
      ]}
    />
  );
}
