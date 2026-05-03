import { Suspense } from "react";
import { CommunityMembersView } from "@/components/community/CommunityMembersView";

export default function CoachCommunityMembersPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-600">Loading…</p>}>
      <CommunityMembersView />
    </Suspense>
  );
}
