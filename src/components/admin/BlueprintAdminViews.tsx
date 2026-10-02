"use client";

import { usePathname } from "next/navigation";

import { PageHeaderUnderlineTabs } from "@/components/layout";

const VIEWS = [
  { href: "/admin/blueprint/coach", label: "Coach view" },
  { href: "/admin/blueprint/records", label: "Coach records" },
  { href: "/admin/blueprint/map", label: "Map" },
];

/** Coach-facing pages, each coach's record, and the page map behind them. */
export function BlueprintAdminViews() {
  const pathname = usePathname();
  return (
    <PageHeaderUnderlineTabs
      ariaLabel="Blueprint views"
      items={VIEWS.map((view) => ({
        kind: "link" as const,
        href: view.href,
        label: view.label,
        active: pathname === view.href || Boolean(pathname?.startsWith(`${view.href}/`)),
      }))}
    />
  );
}
