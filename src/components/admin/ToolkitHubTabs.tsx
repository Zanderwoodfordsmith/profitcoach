"use client";

import { usePathname } from "next/navigation";

import { PageHeaderUnderlineTabs } from "@/components/layout";

export function ToolkitHubTabs() {
  const pathname = usePathname();

  const onLinks =
    pathname === "/admin/links" ||
    Boolean(pathname?.startsWith("/admin/links/")) ||
    pathname === "/admin/settings" ||
    Boolean(pathname?.startsWith("/admin/settings/"));
  const onScorecard =
    pathname === "/admin/signature/scorecard" ||
    Boolean(pathname?.startsWith("/admin/signature/scorecard/"));
  const onTimeTracker =
    pathname === "/admin/time-tracker" ||
    Boolean(pathname?.startsWith("/admin/time-tracker/"));
  const onLanding =
    pathname === "/admin/landing-analytics" ||
    Boolean(pathname?.startsWith("/admin/landing-analytics/"));
  const onLessonImport =
    pathname === "/admin/lesson-import" ||
    Boolean(pathname?.startsWith("/admin/lesson-import/"));
  const onFunnelAnalyzer =
    pathname === "/admin/funnel-analyzer" ||
    Boolean(pathname?.startsWith("/admin/funnel-analyzer/"));
  const onSalesNavImports =
    pathname === "/admin/sales-nav-imports" ||
    Boolean(pathname?.startsWith("/admin/sales-nav-imports/"));
  const onLinkedInInbox =
    pathname === "/admin/linkedin-inbox" ||
    Boolean(pathname?.startsWith("/admin/linkedin-inbox/"));

  const items = [
    {
      kind: "link" as const,
      href: "/admin/links",
      label: "Links",
      active: onLinks,
    },
    {
      kind: "link" as const,
      href: "/admin/signature/scorecard",
      label: "Scorecard",
      active: onScorecard,
    },
    {
      kind: "link" as const,
      href: "/admin/time-tracker",
      label: "Time Tracker",
      active: onTimeTracker,
    },
    {
      kind: "link" as const,
      href: "/admin/landing-analytics",
      label: "Landing",
      active: onLanding,
    },
    {
      kind: "link" as const,
      href: "/admin/lesson-import",
      label: "Lesson import",
      active: onLessonImport,
    },
    {
      kind: "link" as const,
      href: "/admin/funnel-analyzer",
      label: "Funnel Analyzer",
      active: onFunnelAnalyzer,
    },
    {
      kind: "link" as const,
      href: "/admin/sales-nav-imports",
      label: "Sales Nav",
      active: onSalesNavImports,
    },
    {
      kind: "link" as const,
      href: "/admin/linkedin-inbox",
      label: "LI Inbox",
      active: onLinkedInInbox,
    },
  ];

  return <PageHeaderUnderlineTabs ariaLabel="Links" items={items} />;
}
