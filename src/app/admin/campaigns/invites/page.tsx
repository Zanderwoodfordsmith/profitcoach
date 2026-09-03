"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LinkedInPendingInvitesPanel } from "@/components/campaigns/LinkedInPendingInvitesPanel";
import { DashboardPageSection, StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { supabaseClient } from "@/lib/supabaseClient";

export default function AdminCampaignInvitesPage() {
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
      const roleBody = (await roleRes.json().catch(() => ({}))) as {
        role?: string;
      };
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

  return (
    <DashboardPageSection
      contentMaxWidthClass="max-w-6xl"
      header={
        <StickyPageHeader
          title="Get Clients"
          description="Withdraw pending LinkedIn connection requests."
          tabs={<CoachToolsHubTabs hub="get-clients" />}
        />
      }
    >
      {checkingRole ? (
        <p className="text-sm text-slate-600">Checking access…</p>
      ) : (
        <LinkedInPendingInvitesPanel />
      )}
    </DashboardPageSection>
  );
}
