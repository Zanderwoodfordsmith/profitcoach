import { Suspense } from "react";

import { MembershipPageClient } from "@/components/membership/MembershipPageClient";

export default function CoachMembershipPage() {
  return (
    <Suspense
      fallback={
        <div className="px-4 py-8">
          <p className="text-sm text-slate-600">Loading membership…</p>
        </div>
      }
    >
      <MembershipPageClient />
    </Suspense>
  );
}
