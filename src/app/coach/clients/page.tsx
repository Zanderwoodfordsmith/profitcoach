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
  ClientsRoster,
  type ClientRosterItem,
} from "@/components/clients/ClientsRoster";
import { clientWorkspacePath } from "@/lib/clientCoaching/defaults";
import { getValidSupabaseAccessToken } from "@/lib/supabaseAccessToken";

export default function CoachClientsPage() {
  const router = useRouter();
  const { impersonatingCoachId, setImpersonatingContactId } = useImpersonation();
  const [clients, setClients] = useState<ClientRosterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
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

      const body = (await res.json()) as {
        clients?: Array<{
          id: string;
          full_name: string;
          email: string | null;
          business_name: string | null;
          job_title?: string | null;
          photo_url?: string | null;
          headline?: string | null;
          linkedin_url?: string | null;
          last_score?: number | null;
        }>;
      };
      setClients(body.clients ?? []);
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

  return (
    <CoachClientHubGate>
      <div className="flex flex-col gap-4">
        <StickyPageHeader
          title="Clients"
          description="Your coaching roster — sessions, notes, and delivery tools."
          below={<CoachToolsHubTabs hub="coach-clients" />}
        />

        <div className="flex w-full flex-col gap-4">
          {showAdd ? (
            <AddClientPanel
              onClose={() => setShowAdd(false)}
              authHeaders={authHeaders}
              onImported={handleCreated}
              onManualCreated={handleCreated}
            />
          ) : null}

          <ClientsRoster
            clients={clients}
            loading={loading}
            error={error}
            search={search}
            onSearchChange={setSearch}
            onAddClick={() => setShowAdd((open) => !open)}
            addActive={showAdd}
            onViewAsClient={handleViewAsClient}
          />
        </div>
      </div>
    </CoachClientHubGate>
  );
}
