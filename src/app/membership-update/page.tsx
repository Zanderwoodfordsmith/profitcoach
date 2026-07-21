import type { Metadata } from "next";
import { Suspense } from "react";

import { MembershipUpdatePageClient } from "@/components/membership/MembershipUpdatePageClient";

export const metadata: Metadata = {
  title: "Profit Coach OS | Membership",
  description:
    "Licence the Profit Coach brand, get listed in the directory, and unlock tools and support — separate from lifetime Front End access.",
};

export default function PublicMembershipUpdatePage() {
  return (
    <Suspense
      fallback={
        <div className="px-4 py-8">
          <p className="text-sm text-slate-600">Loading membership…</p>
        </div>
      }
    >
      <MembershipUpdatePageClient />
    </Suspense>
  );
}
