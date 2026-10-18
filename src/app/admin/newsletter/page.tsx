"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { LinkedInNewsletterPanel } from "@/components/admin/linkedin/LinkedInNewsletterPanel";
import { supabaseClient } from "@/lib/supabaseClient";
import { fetchProfileRole } from "@/lib/getClients/cachedProfileRole";
import { getSessionUser } from "@/lib/supabaseAccessToken";

export default function AdminNewsletterPage() {
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

  if (checkingRole) {
    return <p className="text-sm text-slate-600">Checking access…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader
        title="Newsletter"
        description="Plan your newsletter series and draft each edition."
        tabs={<CoachToolsHubTabs hub="get-clients" />}
        below={
          <Link
            href="/admin/message-generator"
            className="w-fit text-sm font-medium text-sky-800 hover:text-sky-950"
          >
            ← All tools
          </Link>
        }
      />
      <LinkedInNewsletterPanel />
    </div>
  );
}
