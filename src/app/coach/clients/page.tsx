"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { CoachClientHubGate } from "@/components/coach/CoachClientHubGate";
import {
  CoachClientRoster,
  type CoachClientRosterItem,
} from "@/components/clients/CoachClientRoster";
import { getValidSupabaseAccessToken } from "@/lib/supabaseAccessToken";

type ApiClient = {
  id: string;
  full_name: string;
  business_name: string | null;
  job_title?: string | null;
  photo_url?: string | null;
  headline?: string | null;
  linkedin_url?: string | null;
  boss_score?: number | null;
  boss_score_premium?: number | null;
  client_joined_on?: string | null;
  client_fee_amount?: number | string | null;
  client_problem_notes?: string | null;
};

function readFee(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function toRosterItem(row: ApiClient): CoachClientRosterItem {
  return {
    id: row.id,
    fullName: row.full_name,
    businessName: row.business_name,
    jobTitle: row.job_title ?? null,
    headline: row.headline ?? null,
    photoUrl: row.photo_url ?? null,
    linkedinUrl: row.linkedin_url ?? null,
    joinedOn: row.client_joined_on ?? null,
    feeAmount: readFee(row.client_fee_amount),
    problemNotes: row.client_problem_notes ?? null,
    bossScore: row.boss_score_premium ?? row.boss_score ?? null,
  };
}

export default function CoachClientsPage() {
  const router = useRouter();
  const { impersonatingCoachId } = useImpersonation();
  const [clients, setClients] = useState<ApiClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const loadedCoachKey = useRef<string | null>(null);

  const coachKey = impersonatingCoachId ?? "";

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const silent = loadedCoachKey.current === coachKey && refreshKey > 0;
      if (!silent) {
        setLoading(true);
        setClients([]);
      }
      setError(null);

      const {
        data: { session },
      } = await supabaseClient.auth.getSession();

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      const roleRes = await fetch("/api/profile-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id }),
      });
      const roleBody = (await roleRes.json().catch(() => ({}))) as {
        role?: string;
        error?: string;
      };
      if (!roleRes.ok || !roleBody.role) {
        if (!cancelled) {
          setError("Unable to load your profile.");
          setLoading(false);
        }
        return;
      }
      if (roleBody.role === "admin" && !impersonatingCoachId) {
        router.replace("/admin");
        return;
      }

      const headers: Record<string, string> = {
        Authorization: `Bearer ${session.access_token}`,
      };
      if (roleBody.role === "admin" && impersonatingCoachId) {
        headers["x-impersonate-coach-id"] = impersonatingCoachId;
      }

      const res = await fetch("/api/coach/clients", { headers });

      if (cancelled) return;

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Unable to load clients.");
        setLoading(false);
        return;
      }

      const body = (await res.json()) as { clients?: ApiClient[] };
      setClients(body.clients ?? []);
      loadedCoachKey.current = coachKey;
      setLoading(false);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [router, impersonatingCoachId, refreshKey, coachKey]);

  const items = useMemo(() => clients.map(toRosterItem), [clients]);

  async function authHeaders() {
    const token = await getValidSupabaseAccessToken();
    if (!token) return null;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (impersonatingCoachId) {
      headers["x-impersonate-coach-id"] = impersonatingCoachId;
    }
    return headers;
  }

  return (
    <CoachClientHubGate>
      <div className="flex flex-col gap-4">
        <StickyPageHeader
          title="Keep Clients"
          description="Price and join date live on each row. BOSS Score is the same person, opened from the score."
          tabs={<CoachToolsHubTabs hub="coach-clients" />}
        />

        <CoachClientRoster
          clients={items}
          loading={loading}
          error={error}
          authHeaders={authHeaders}
          onChanged={() => setRefreshKey((key) => key + 1)}
        />
      </div>
    </CoachClientHubGate>
  );
}
