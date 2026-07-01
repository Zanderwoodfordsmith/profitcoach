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
  const onUsage =
    pathname === "/admin/client-success/usage" ||
    Boolean(pathname?.startsWith("/admin/client-success/usage/"));
  const onPayments =
    pathname === "/admin/payments" ||
    Boolean(pathname?.startsWith("/admin/payments/"));
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
        {
          kind: "link",
          href: "/admin/payments",
          label: "Payments",
          active: onPayments,
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
