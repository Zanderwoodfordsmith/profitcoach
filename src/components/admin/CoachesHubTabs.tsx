"use client";

import { usePathname } from "next/navigation";

import { PageHeaderUnderlineTabs } from "@/components/layout";

/** Revenue, Client success and Quality are off the tabs for now (28 Oct), Usage too (16 Nov); their pages still work. Launches became the Launch view on All coaches (21 Nov). Getting clients was folded into All coaches as a column group and its page deleted (23 Nov). */
export function CoachesHubTabs() {
  const pathname = usePathname();
  const onJourney = pathname === "/admin/coaches/journey";
  const onCoachesList =
    pathname === "/admin" ||
    pathname === "/admin/" ||
    (Boolean(pathname?.startsWith("/admin/coaches/")) && !onJourney);

  return (
    <PageHeaderUnderlineTabs
      ariaLabel="Coaches views"
      items={[
        {
          kind: "link",
          href: "/admin",
          label: "All coaches",
          active: onCoachesList,
        },
        // The coach journey map (Customer Activation Ramp, job 317, 28 Nov). Admin only.
        {
          kind: "link",
          href: "/admin/coaches/journey",
          label: "Journey",
          active: onJourney,
        },
      ]}
    />
  );
}
