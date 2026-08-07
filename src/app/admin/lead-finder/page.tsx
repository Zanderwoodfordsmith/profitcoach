import { Suspense } from "react";
import { LeadFinderClient } from "@/components/leadFinder/LeadFinderClient";

export default function AdminLeadFinderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
          Loading…
        </div>
      }
    >
      <LeadFinderClient />
    </Suspense>
  );
}
