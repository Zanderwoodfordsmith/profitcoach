"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LinkedInMirrorInbox } from "@/components/admin/LinkedInMirrorInbox";
import { ToolkitHubTabs } from "@/components/admin/ToolkitHubTabs";
import { DashboardPageSection, StickyPageHeader } from "@/components/layout";
import { supabaseClient } from "@/lib/supabaseClient";
import { fetchProfileRole } from "@/lib/getClients/cachedProfileRole";
import { getSessionUser } from "@/lib/supabaseAccessToken";

export default function AdminLinkedInInboxPage() {
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
      header={
        <StickyPageHeader
          title="LI Inbox"
          description="Mirror of your 3 most recent LinkedIn Messaging threads (admin cookie scrape)."
          tabs={<ToolkitHubTabs />}
        />
      }
    >
      {checkingRole ? (
        <p className="text-sm text-slate-600">Checking access…</p>
      ) : (
        <LinkedInMirrorInbox />
      )}
    </DashboardPageSection>
  );
}
