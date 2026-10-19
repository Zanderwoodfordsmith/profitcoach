"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LinkedInCampaignEditor } from "@/components/campaigns/LinkedInCampaignEditor";
import { DashboardPageSection, StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { supabaseClient } from "@/lib/supabaseClient";
import { fetchProfileRole } from "@/lib/getClients/cachedProfileRole";
import { getSessionUser } from "@/lib/supabaseAccessToken";

export default function AdminCampaignDetailPage() {
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
      contentMaxWidthClass="max-w-none"
      gapClass="gap-3"
      header={
        <StickyPageHeader
          title="Get Clients"
          tabs={<CoachToolsHubTabs hub="get-clients" />}
        />
      }
    >
      {checkingRole ? (
        <p className="text-sm text-slate-600">Checking access…</p>
      ) : (
        <LinkedInCampaignEditor />
      )}
    </DashboardPageSection>
  );
}
