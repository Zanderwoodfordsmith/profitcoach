import { Suspense, type ReactNode } from "react";
import { CommunityAreaLayout } from "@/components/community/CommunityAreaLayout";
import { CommunityFeedLayoutGate } from "@/components/community/CommunityFeedLayoutGate";

export default function CoachCommunityLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense
      fallback={<p className="text-sm text-slate-600">Loading…</p>}
    >
      <CommunityAreaLayout>
        <CommunityFeedLayoutGate>{children}</CommunityFeedLayoutGate>
      </CommunityAreaLayout>
    </Suspense>
  );
}
