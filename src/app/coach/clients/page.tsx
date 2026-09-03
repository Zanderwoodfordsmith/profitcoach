"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { CoachClientHubGate } from "@/components/coach/CoachClientHubGate";
import { AddClientPanel } from "@/components/clients/AddClientPanel";
import {
  CoachClientsHome,
  type CoachClientHomeItem,
} from "@/components/clients/CoachClientsHome";
import { clientWorkspacePath } from "@/lib/clientCoaching/defaults";
import type { ProspectNextCall } from "@/lib/prospectNextCall";
import { getValidSupabaseAccessToken } from "@/lib/supabaseAccessToken";

type ApiClient = {
  id: string;
  full_name: string;
  email: string | null;
  business_name: string | null;
  job_title?: string | null;
  photo_url?: string | null;
  headline?: string | null;
  linkedin_url?: string | null;
  last_score?: number | null;
  boss_score?: number | null;
  boss_score_premium?: number | null;
  last_assessed_at?: string | null;
  next_call?: ProspectNextCall | null;
};

function toHomeItem(row: ApiClient): CoachClientHomeItem {
  const score =
    row.boss_score_premium ?? row.boss_score ?? row.last_score ?? null;
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    business_name: row.business_name,
    job_title: row.job_title ?? null,
    photo_url: row.photo_url ?? null,
    headline: row.headline ?? null,
    linkedin_url: row.linkedin_url ?? null,
    last_score: score,
    boss_score: row.boss_score ?? null,
    boss_score_premium: row.boss_score_premium ?? null,
    last_assessed_at: row.last_assessed_at ?? null,
    next_call: row.next_call ?? null,
  };
}

export default function CoachClientsPage() {
  const router = useRouter();
  const { impersonatingCoachId, setImpersonatingContactId } = useImpersonation();
  const [clients, setClients] = useState<CoachClientHomeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
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
        setError("Unable to load your profile.");
        setLoading(false);
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
      setClients((body.clients ?? []).map(toHomeItem));
      setLoading(false);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [router, impersonatingCoachId, refreshKey]);

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

  function handleViewAsClient(contactId: string) {
    setImpersonatingContactId(contactId);
    router.push("/client");
  }

  function handleCreated(contactId: string) {
    setRefreshKey((k) => k + 1);
    setShowAdd(false);
    router.push(clientWorkspacePath(contactId));
  }

  const empty = !loading && !error && clients.length === 0;

  return (
    <CoachClientHubGate>
      <div className="flex flex-col gap-4">
        <StickyPageHeader
          title="Coach Clients"
          description={
            empty
              ? "Import a client from LinkedIn to open their coaching workspace."
              : "Upcoming sessions, attention items, and your roster."
          }
          tabs={<CoachToolsHubTabs hub="coach-clients" />}
        />

        <div className="flex w-full flex-col gap-4">
          {error && !loading ? (
            <p className="text-sm text-rose-700">{error}</p>
          ) : null}

          {empty ? (
            <AddClientPanel
              variant="hero"
              authHeaders={authHeaders}
              onImported={handleCreated}
              onManualCreated={handleCreated}
            />
          ) : (
            <>
              {showAdd ? (
                <div className="max-w-lg">
                  <AddClientPanel
                    variant="panel"
                    onClose={() => setShowAdd(false)}
                    authHeaders={authHeaders}
                    onImported={handleCreated}
                    onManualCreated={handleCreated}
                  />
                </div>
              ) : null}

              <CoachClientsHome
                clients={clients}
                loading={loading}
                onAddClient={() => setShowAdd(true)}
                onViewAsClient={handleViewAsClient}
              />
            </>
          )}
        </div>
      </div>
    </CoachClientHubGate>
  );
}
