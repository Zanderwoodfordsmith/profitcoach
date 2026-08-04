"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StartApplyPanel } from "@/components/booking/StartApplyPanel";
import { ToolkitHubTabs } from "@/components/admin/ToolkitHubTabs";
import { DashboardPageSection, StickyPageHeader } from "@/components/layout";
import { BCA_DISCOVERY_BOOKING_BASE } from "@/lib/bcaDiscoveryCalendar";
import { supabaseClient } from "@/lib/supabaseClient";

/**
 * Staff-only preview of the BCA Let’s Talk gate + discovery calendar.
 * Does not write calendar_embed_code onto any coach account.
 * Lead webhook capture is off here so testing doesn’t hit GHL.
 */
export default function AdminDiscoveryCalendarPage() {
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
          title="Let’s Talk"
          description="BCA gated book-a-call flow + Fit Call embed (staff preview — not applied to coaches)."
          tabs={<ToolkitHubTabs />}
        />
      }
    >
      {checkingRole ? (
        <p className="text-sm text-slate-600">Checking access…</p>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
            <p className="m-0">
              Phone → name → email + qualify filters → unlocks{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800">
                {BCA_DISCOVERY_BOOKING_BASE}
              </code>
              . Lead capture is off on this page.
            </p>
          </div>
          <div className="mx-auto w-full max-w-[920px]">
            <StartApplyPanel variant="modal" enableLeadCapture={false} />
          </div>
        </div>
      )}
    </DashboardPageSection>
  );
}
