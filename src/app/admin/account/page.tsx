"use client";

import { Suspense } from "react";
import { BossDashboardSettings } from "@/components/settings/BossDashboardSettings";

export default function AdminAccountPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-600">Loading…</p>}>
      <BossDashboardSettings variant="admin" />
    </Suspense>
  );
}
