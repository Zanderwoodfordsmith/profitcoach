"use client";

import { usePathname } from "next/navigation";

import { PageHeaderUnderlineTabs } from "@/components/layout";

/** Revenue, Client success and Quality are off the tabs for now (28 Oct); their pages still work. */
export function CoachesHubTabs() {
  const pathname = usePathname();
  const onCoachesList =
    pathname === "/admin" ||
    pathname === "/admin/" ||
    Boolean(pathname?.startsWith("/admin/coaches/"));
  const onBlueprint =
    pathname === "/admin/client-success/blueprint" ||
    Boolean(pathname?.startsWith("/admin/client-success/blueprint/"));
  const onGetClients =
    pathname === "/admin/client-success/get-clients" ||
    Boolean(pathname?.startsWith("/admin/client-success/get-clients/"));
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
          href: "/admin/client-success/get-clients",
          label: "Get clients",
          active: onGetClients,
        },
        {
          kind: "link",
          href: "/admin/client-success/blueprint",
          label: "Blueprint",
          active: onBlueprint,
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
