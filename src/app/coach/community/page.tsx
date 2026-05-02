import { Suspense } from "react";
import { CommunityFeed } from "@/components/community/CommunityFeed";

export default function CoachCommunityPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-600">Loading…</p>}>
      <CommunityFeed />
    </Suspense>
  );
}
