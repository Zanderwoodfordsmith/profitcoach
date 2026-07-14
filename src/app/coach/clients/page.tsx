"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { StickyPageHeader } from "@/components/layout";
import { CoachClientHubGate } from "@/components/coach/CoachClientHubGate";
import { AddClientForm } from "@/components/clients/AddClientForm";
import {
  ProspectsTable,
  type ProspectRow,
} from "@/components/prospects/ProspectsTable";
import { bossProHubPath } from "@/lib/isBossWorkshopPath";

export default function CoachClientsPage() {
  const router = useRouter();
  const { impersonatingCoachId, setImpersonatingContactId } = useImpersonation();
  const [prospects, setProspects] = useState<ProspectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddClient, setShowAddClient] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [createdContactId, setCreatedContactId] = useState<string | null>(null);
  const [newFullName, setNewFullName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newBusinessName, setNewBusinessName] = useState("");
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

      const body = (await res.json()) as { clients?: ProspectRow[] };
      setProspects(body.clients ?? []);
      setLoading(false);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [router, impersonatingCoachId, refreshKey]);

  async function handleCreateClient(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);
    setCreating(true);
    setCreatedContactId(null);
    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        throw new Error("You must be signed in to add a client.");
      }
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      };
      if (impersonatingCoachId) {
        headers["x-impersonate-coach-id"] = impersonatingCoachId;
      }
      const res = await fetch("/api/coach/contacts", {
        method: "POST",
        headers,
        body: JSON.stringify({
          fullName: newFullName,
          email: newEmail || undefined,
          businessName: newBusinessName || undefined,
          type: "client",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        contactId?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data?.error ?? "Unable to create client.");
      }
      setCreateSuccess("Client created.");
      setCreatedContactId(data.contactId ?? null);
      setNewFullName("");
      setNewEmail("");
      setNewBusinessName("");
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Unable to create client.");
    } finally {
      setCreating(false);
    }
  }

  function handleViewAsClient(contactId: string) {
    setImpersonatingContactId(contactId);
    router.push("/client");
  }

  return (
    <CoachClientHubGate>
    <div className="flex flex-col gap-4">
      <StickyPageHeader
        title="Clients"
        description="View your clients. Add clients or move prospects to clients when they convert."
      />

      <div className="flex w-full flex-col gap-4">
      {showAddClient && (
        <AddClientForm
          fullName={newFullName}
          email={newEmail}
          businessName={newBusinessName}
          onFullNameChange={setNewFullName}
          onEmailChange={setNewEmail}
          onBusinessNameChange={setNewBusinessName}
          onSubmit={handleCreateClient}
          onClose={() => setShowAddClient(false)}
          creating={creating}
          createError={createError}
          createSuccess={createSuccess}
          createdContactId={createdContactId}
          onViewAsClient={handleViewAsClient}
        />
      )}

      {loading && (
        <p className="text-sm text-slate-600">Loading…</p>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}

      <ProspectsTable
        prospects={prospects}
        loading={loading}
        error={error}
        showCoachColumn={false}
        showTypeColumn={true}
        onAddClick={() => setShowAddClient((open) => !open)}
        addActive={showAddClient}
        addLabel={showAddClient ? "Cancel" : "Add"}
        onRowClick={(id) => router.push(bossProHubPath(id))}
        emptyMessage="No clients yet."
        renderRowActions={(row) => (
          <button
            type="button"
            onClick={() => handleViewAsClient(row.id)}
            className="rounded-md bg-sky-100 px-2 py-1 text-xs font-medium text-sky-800 hover:bg-sky-200"
          >
            View as client
          </button>
        )}
      />
      </div>
    </div>
    </CoachClientHubGate>
  );
}
