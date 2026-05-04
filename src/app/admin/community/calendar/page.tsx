import { Suspense } from "react";
import { CommunityCalendarPage } from "@/components/community/CommunityCalendarPage";

export default function AdminCommunityCalendarPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-600">Loading…</p>}>
      <CommunityCalendarPage />
    </Suspense>
  );
}
