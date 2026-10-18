"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LinkedInPendingInvitesPanel } from "@/components/campaigns/LinkedInPendingInvitesPanel";
import { DashboardPageSection, StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { supabaseClient } from "@/lib/supabaseClient";
import { fetchProfileRole } from "@/lib/getClients/cachedProfileRole";
import { getSessionUser } from "@/lib/supabaseAccessToken";

export default function AdminCampaignInvitesPage() {
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
      const roleBody = (await fetchProfileRole(user.id)) as {
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
          description="Withdraw pending LinkedIn connection requests, by hand or on a schedule."
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
