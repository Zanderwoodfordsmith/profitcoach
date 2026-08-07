"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadCallTableRows } from "@/lib/loadCallTableRows";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useCoachClientHubAccess } from "@/hooks/useCoachClientHubAccess";
import { StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { CallsHub } from "@/components/calls/CallsHub";
import type { CallRow } from "@/lib/callRow";
import { bossProHubPath } from "@/lib/isBossWorkshopPath";

export default function CoachCallsPage() {
  const router = useRouter();
  const { impersonatingCoachId } = useImpersonation();
  const { allowed: clientHubAllowed } = useCoachClientHubAccess(impersonatingCoachId);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      setError(null);

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
        error?: string;
      };
      if (!roleRes.ok || !roleBody.role) {
        setError("Unable to load your profile.");
        setLoading(false);
        return;
      }

      const effectiveId =
        roleBody.role === "admin" && impersonatingCoachId
          ? impersonatingCoachId
          : user.id;
      if (roleBody.role === "admin" && !impersonatingCoachId) {
        router.replace("/admin/calls");
        return;
      }

      try {
        const rows = await loadCallTableRows(supabaseClient, {
          coachId: effectiveId,
        });
        if (!cancelled) {
          setCalls(rows);
        }
      } catch (err) {
        console.error("coach/calls load:", err);
        if (!cancelled) {
          setError("Unable to load calls.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [router, impersonatingCoachId]);

  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader
        title="Get Clients"
        description="Booked calls from native calendars and GoHighLevel."
        tabs={<CoachToolsHubTabs hub="get-clients" />}
      />

      <CallsHub
        calls={calls}
        loading={loading}
        error={error}
        showCoachColumn={false}
        onCallsChange={setCalls}
        onRowClick={(row) => {
          if (row.contact_id && clientHubAllowed) {
            router.push(bossProHubPath(row.contact_id));
          }
        }}
        emptyMessage="No calls yet. When prospects book through your calendars, they will appear here."
      />
    </div>
  );
}
