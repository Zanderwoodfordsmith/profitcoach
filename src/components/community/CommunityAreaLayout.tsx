"use client";

import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { PageHeaderUnderlineTabs, StickyPageHeader } from "@/components/layout";
import { CommunityMemberDirectoryProvider } from "@/components/community/useCommunityMemberDirectory";
import { communityPostSlugFromPathname } from "@/lib/communityPostSlug";

export function CommunityAreaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const base = pathname.startsWith("/admin")
    ? "/admin/community"
    : "/coach/community";
  const isMembers = pathname === `${base}/members`;
  const onCommunityHome =
    pathname === base ||
    pathname === `${base}/` ||
    communityPostSlugFromPathname(pathname) !== null;
  const isCalendarPage =
    pathname === `${base}/calendar` || pathname === `${base}/calendar/`;
  const isFeedbackPage =
    pathname === `${base}/feedback` || pathname === `${base}/feedback/`;

  const isMap =
    !isMembers &&
    onCommunityHome &&
    searchParams.get("tab") === "map";
  const isFeed = !isMembers && onCommunityHome && !isMap;

  const description = isFeedbackPage
    ? "Review and prioritise bugs, features, and feedback from staff."
    : isMembers
      ? "Browse all members, see who's online, and find staff admins."
      : isCalendarPage
        ? "See upcoming community events in calendar or list view."
        : "Browse posts and see where coaches are based.";

  const pageTitle = isFeedbackPage
    ? "Feedback inbox"
    : isCalendarPage
      ? "Calendar"
      : "Community";

  const tabs = useMemo(() => {
    if (isCalendarPage || isFeedbackPage) return undefined;
    return (
      <PageHeaderUnderlineTabs
        ariaLabel="Community views"
        items={[
          {
            kind: "link",
            href: base,
            label: "Feed",
            active: isFeed,
          },
          {
            kind: "link",
            href: `${base}/members`,
            label: "Members",
            active: isMembers,
          },
          {
            kind: "link",
            href: `${base}?tab=map`,
            label: "Map",
            active: isMap,
          },
        ]}
      />
    );
  }, [base, isCalendarPage, isFeedbackPage, isFeed, isMap, isMembers]);

  return (
    <>
      <StickyPageHeader
        title={pageTitle}
        description={description}
        tabs={tabs}
      />
      <CommunityMemberDirectoryProvider>{children}</CommunityMemberDirectoryProvider>
    </>
  );
}
