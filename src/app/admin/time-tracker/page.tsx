"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ToolkitHubTabs } from "@/components/admin/ToolkitHubTabs";
import { StickyPageHeader } from "@/components/layout";
import { supabaseClient } from "@/lib/supabaseClient";
import { TimeTrackerBoard } from "@/components/admin/timeTracker/TimeTrackerBoard";
import { fetchProfileRole } from "@/lib/getClients/cachedProfileRole";
import { getSessionUser } from "@/lib/supabaseAccessToken";

export default function AdminTimeTrackerPage() {
  const router = useRouter();
  const [checkingRole, setCheckingRole] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const user = await getSessionUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const roleBody = (await fetchProfileRole(user.id)) as { role?: string };
      if (cancelled) return;
      if (roleBody.role !== "admin") {
        router.replace("/coach");
        return;
      }
      setCheckingRole(false);
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checkingRole) {
    return <p className="text-sm text-slate-600">Checking access…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader
        title="Time Tracker"
        description="Block out your week in 15-minute slots, capture notes, and review how the team is spending their time."
        tabs={<ToolkitHubTabs />}
      />
      <TimeTrackerBoard />
    </div>
  );
}
