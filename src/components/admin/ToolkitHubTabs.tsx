"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { PageHeaderUnderlineTabs } from "@/components/layout";
import { isLeadFinderAllowedEmail } from "@/lib/leadFinderAccess";
import { supabaseClient } from "@/lib/supabaseClient";

export function ToolkitHubTabs() {
  const pathname = usePathname();
  const [leadFinderAllowed, setLeadFinderAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (!cancelled) {
        setLeadFinderAllowed(isLeadFinderAllowedEmail(user?.email));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
  const onLinkedIn =
    pathname === "/admin/linkedin" ||
    Boolean(pathname?.startsWith("/admin/linkedin/"));
  const onLeadFinder =
    pathname === "/admin/lead-finder" ||
    Boolean(pathname?.startsWith("/admin/lead-finder/"));
  const onFunnelAnalyzer =
    pathname === "/admin/funnel-analyzer" ||
    Boolean(pathname?.startsWith("/admin/funnel-analyzer/"));
  const onDiscoveryCalendar =
    pathname === "/admin/discovery-calendar" ||
    Boolean(pathname?.startsWith("/admin/discovery-calendar/"));

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
      href: "/admin/linkedin",
      label: "LinkedIn",
      active: onLinkedIn,
    },
    {
      kind: "link" as const,
      href: "/admin/funnel-analyzer",
      label: "Funnel Analyzer",
      active: onFunnelAnalyzer,
    },
    {
      kind: "link" as const,
      href: "/admin/discovery-calendar",
      label: "Let’s Talk",
      active: onDiscoveryCalendar,
    },
    ...(leadFinderAllowed
      ? [
          {
            kind: "link" as const,
            href: "/admin/lead-finder",
            label: "Lead Finder",
            active: onLeadFinder,
          },
        ]
      : []),
  ];

  return <PageHeaderUnderlineTabs ariaLabel="Links" items={items} />;
}
