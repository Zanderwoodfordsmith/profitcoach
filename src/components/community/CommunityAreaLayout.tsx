"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { StickyPageHeader } from "@/components/layout";
import { ACADEMY_INFO, AcademyTabs } from "@/components/academy/AcademyTabs";
import { CommunityMemberDirectoryProvider } from "@/components/community/useCommunityMemberDirectory";
import { communityPostSlugFromPathname } from "@/lib/communityPostSlug";

export function CommunityAreaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const base = pathname.startsWith("/admin")
    ? "/admin/community"
    : "/coach/community";
  const onCommunityHome =
    pathname === base ||
    pathname === `${base}/` ||
    communityPostSlugFromPathname(pathname) !== null;
  const isFeedbackPage =
    pathname === `${base}/feedback` || pathname === `${base}/feedback/`;

  // The map used to be a feed tab; it now lives on the Members page.
  const oldMapLink = onCommunityHome && searchParams.get("tab") === "map";
  useEffect(() => {
    if (oldMapLink) router.replace(`${base}/members?view=map`);
  }, [oldMapLink, base, router]);

  const description = isFeedbackPage
    ? "Review and prioritise bugs, features, and feedback from staff."
    : ACADEMY_INFO;

  return (
    <>
      <StickyPageHeader
        title={isFeedbackPage ? "Feedback inbox" : "Academy"}
        description={description}
        tabs={isFeedbackPage ? undefined : <AcademyTabs />}
      />
      <CommunityMemberDirectoryProvider>
        {oldMapLink ? null : children}
      </CommunityMemberDirectoryProvider>
    </>
  );
}
