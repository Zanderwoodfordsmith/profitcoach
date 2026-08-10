"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LinkedInMirrorInbox } from "@/components/admin/LinkedInMirrorInbox";
import { ToolkitHubTabs } from "@/components/admin/ToolkitHubTabs";
import { DashboardPageSection, StickyPageHeader } from "@/components/layout";
import { supabaseClient } from "@/lib/supabaseClient";

export default function AdminLinkedInInboxPage() {
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
