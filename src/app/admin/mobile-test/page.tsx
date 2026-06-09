"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DashboardPageSection, StickyPageHeader } from "@/components/layout";
import { SwipeToCompleteTodoList } from "@/components/admin/SwipeToCompleteTodoList";
import { supabaseClient } from "@/lib/supabaseClient";

export default function AdminMobileTestPage() {
  const router = useRouter();
  const [checkingRole, setCheckingRole] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function init() {
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
      const roleBody = (await roleRes.json().catch(() => ({}))) as {
        role?: string;
      };
      if (cancelled) return;
      if (!roleRes.ok || roleBody.role !== "admin") {
        router.replace("/coach");
        return;
      }
      setCheckingRole(false);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <DashboardPageSection
      header={
        <StickyPageHeader
          title="Mobile interactions"
          description="Swipe right to complete, swipe left to delete."
        />
      }
    >
      {checkingRole ? (
        <p className="text-sm text-slate-600">Checking access…</p>
      ) : (
        <SwipeToCompleteTodoList />
      )}
    </DashboardPageSection>
  );
}
