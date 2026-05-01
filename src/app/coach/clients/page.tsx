"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { StickyPageHeader } from "@/components/layout";
import {
  ProspectsTable,
  type ProspectRow,
} from "@/components/prospects/ProspectsTable";

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
    <div className="flex flex-col gap-4">
      <StickyPageHeader
        title="Clients"
        description="View your clients. Add clients or move prospects to clients when they convert."
        actions={
          <button
            type="button"
            onClick={() => setShowAddClient(!showAddClient)}
            className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-500"
          >
            {showAddClient ? "Cancel" : "Add client"}
          </button>
        }
      />

      <div className="flex w-full flex-col gap-4">
      {showAddClient && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Add client</h2>
          <form onSubmit={handleCreateClient} className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="clientFullName" className="block text-xs font-medium text-slate-700">
                Full name
              </label>
              <input
                id="clientFullName"
                type="text"
                required
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                className="block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="clientEmail" className="block text-xs font-medium text-slate-700">
                Email (optional)
              </label>
              <input
                id="clientEmail"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="clientBusinessName" className="block text-xs font-medium text-slate-700">
                Business name (optional)
              </label>
              <input
                id="clientBusinessName"
                type="text"
                value={newBusinessName}
                onChange={(e) => setNewBusinessName(e.target.value)}
                className="block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <button
                type="submit"
                disabled={creating}
                className="inline-flex w-fit items-center rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-500 disabled:cursor-wait disabled:opacity-70"
              >
                {creating ? "Creating…" : "Create client"}
              </button>
              {createError && (
                <p className="text-sm text-rose-600" role="alert">
                  {createError}
                </p>
              )}
              {createSuccess && (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm text-emerald-600" role="status">
                    {createSuccess}
                  </p>
                  {createdContactId && (
                    <button
                      type="button"
                      onClick={() => handleViewAsClient(createdContactId)}
                      className="text-sm font-medium text-sky-700 underline hover:text-sky-800"
                    >
                      View as client →
                    </button>
                  )}
                </div>
              )}
            </div>
          </form>
        </section>
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
        onRowClick={(id) => router.push(`/coach/contacts/${id}`)}
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
  );
}
