"use client";

import { Suspense, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { isCommunityFeedPathname } from "@/lib/communityPostSlug";
import { CommunityFeed } from "@/components/community/CommunityFeed";

/**
 * Keeps `CommunityFeed` mounted across `/community` ↔ `/community/[postSlug]`
 * history updates so opening or closing a post does not remount the feed.
 */
export function CommunityFeedLayoutGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (isCommunityFeedPathname(pathname)) {
    return (
      <Suspense fallback={<p className="text-sm text-slate-600">Loading…</p>}>
        <CommunityFeed />
      </Suspense>
    );
  }
  return <>{children}</>;
}
