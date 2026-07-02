import type { Metadata } from "next";
import { Suspense } from "react";

import { MembershipPageClient } from "@/components/membership/MembershipPageClient";

export const metadata: Metadata = {
  title: "Membership | Profit Coach",
  description: "Choose your Profit Coach membership level and keep your system live.",
};

export default function PublicMembershipPage() {
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
