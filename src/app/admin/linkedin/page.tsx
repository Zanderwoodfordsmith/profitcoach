"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StickyPageHeader } from "@/components/layout";
import { supabaseClient } from "@/lib/supabaseClient";
import { LinkedInSchedulerPanel } from "@/components/admin/LinkedInSchedulerPanel";

export default function AdminLinkedInPage() {
  const router = useRouter();
  const [checkingRole, setCheckingRole] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const roleRes = await fetch("/api/profile-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const roleBody = (await roleRes.json().catch(() => ({}))) as { role?: string };
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
        title="LinkedIn Scheduler"
        description="Admin-only tools for connecting LinkedIn, posting now, and scheduling queued posts."
      />
      <LinkedInSchedulerPanel />
    </div>
  );
}
