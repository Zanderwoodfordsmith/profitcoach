"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";

type ClientRow = {
  id: string;
  coach_id: string | null;
  full_name: string;
  email: string | null;
  business_name: string | null;
  type: string;
  coach_name: string | null;
  coach_business_name: string | null;
  last_score: number | null;
  last_completed_at: string | null;
};

type CoachOption = { id: string; label: string };

type ClientGroup = {
  key: string;
  label: string;
  clients: ClientRow[];
};

export default function AdminClientsPage() {
  const router = useRouter();
  const { setImpersonatingContactId } = useImpersonation();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddClient, setShowAddClient] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [createdContactId, setCreatedContactId] = useState<string | null>(null);
  const [newCoachId, setNewCoachId] = useState<string>("");
  const [newFullName, setNewFullName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newBusinessName, setNewBusinessName] = useState("");
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

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
      };
      if (cancelled) return;
      if (roleBody.role !== "admin") {
        router.replace("/coach");
        return;
      }
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        setError("Unable to load clients.");
        setLoading(false);
        return;
      }
      const headers = { Authorization: `Bearer ${session.access_token}` };
      const [contactsRes, coachesRes] = await Promise.all([
        fetch("/api/admin/contacts?type=client", { headers }),
        fetch("/api/admin/coaches", { headers }),
      ]);
      if (cancelled) return;
      if (!contactsRes.ok) {
        const body = (await contactsRes.json().catch(() => ({}))) as { error?: string };
        setError(body?.error ?? "Unable to load clients.");
        setLoading(false);
        return;
      }
      const contactsBody = (await contactsRes.json()) as { prospects?: ClientRow[] };
      setClients(contactsBody.prospects ?? []);
      if (coachesRes.ok) {
        const coachesBody = (await coachesRes.json()) as {
          coaches?: Array<{ id: string; slug?: string; full_name?: string | null; coach_business_name?: string | null }>;
        };
        const bcaOption: CoachOption = { id: "BCA", label: "BCA (Central)" };
        const list = (coachesBody.coaches ?? [])
          .filter((c) => (c.slug ?? "").toUpperCase() !== "BCA")
          .map((c) => ({
            id: c.id,
            label: c.full_name ?? c.coach_business_name ?? `Coach ${c.id.slice(0, 8)}`,
          }));
        setCoaches([bcaOption, ...list]);
      }
      setLoading(false);
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [router, refreshKey]);

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
      const coachIdValue =
        newCoachId === "none" || newCoachId === "" ? null : newCoachId;
      const res = await fetch("/api/admin/contacts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          coachId: coachIdValue,
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
      setNewCoachId("");
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

  const groupedClients = useMemo(() => {
    const byCoach = new Map<string | null, ClientRow[]>();
    for (const c of clients) {
      const coachKey = c.coach_id ?? "__unassigned__";
      const list = byCoach.get(coachKey) ?? [];
      list.push(c);
      byCoach.set(coachKey, list);
    }
    const unassigned = byCoach.get("__unassigned__") ?? [];
    const coachIds = Array.from(byCoach.keys()).filter((k) => k !== "__unassigned__");
    const coachLabels = new Map<string, string>();
    for (const c of clients) {
      if (c.coach_id) {
        const label = c.coach_name ?? c.coach_business_name ?? `Coach ${c.coach_id.slice(0, 8)}`;
        coachLabels.set(c.coach_id, label);
      }
    }
    const groups: ClientGroup[] = [];
    if (unassigned.length > 0) {
      groups.push({ key: "__unassigned__", label: "Unassigned", clients: unassigned });
    }
    for (const coachId of coachIds.sort((a, b) => {
      const labelA = coachLabels.get(a!) ?? "";
      const labelB = coachLabels.get(b!) ?? "";
      return labelA.localeCompare(labelB);
    })) {
      groups.push({
        key: coachId!,
        label: coachLabels.get(coachId!) ?? coachId!,
        clients: (byCoach.get(coachId) ?? []).sort((a, b) =>
          a.full_name.localeCompare(b.full_name)
        ),
      });
    }
    return groups;
  }, [clients]);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
            BOSS Dashboard
          </p>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">
            Clients
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Create and manage clients, grouped by coach. View as client to see their portal.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddClient(!showAddClient)}
          className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-500"
        >
          {showAddClient ? "Cancel" : "Add client"}
        </button>
      </header>

      {showAddClient && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Add client</h2>
          <form onSubmit={handleCreateClient} className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="clientCoach" className="block text-xs font-medium text-slate-700">
                Coach (optional)
              </label>
              <select
                id="clientCoach"
                value={newCoachId}
                onChange={(e) => setNewCoachId(e.target.value)}
                className="block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              >
                <option value="none">None (unassigned)</option>
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
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

      {error && (
        <p className="text-sm text-rose-600">{error}</p>
      )}

      {!loading && !error && (
        <div
          className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm min-h-0"
          style={{ maxHeight: "calc(100vh - 14rem)" }}
        >
          <div className="overflow-y-auto overflow-x-auto flex-1">
            {clients.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">
                No clients yet. Add a client above.
              </p>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50">
                  <tr className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <th className="px-4 py-3 text-left">Client</th>
                    <th className="px-4 py-3 text-left min-w-[10rem]">Business</th>
                    <th className="px-4 py-3 text-left min-w-[12rem]">Email</th>
                    <th className="px-4 py-3 text-center min-w-[6rem]">Last score</th>
                    <th className="px-4 py-3 text-center min-w-[7rem]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedClients.map((group, groupIndex) => (
                    <Fragment key={group.key}>
                      {groupIndex > 0 && (
                        <tr>
                          <td colSpan={5} className="h-6 p-0 bg-transparent" />
                        </tr>
                      )}
                      <tr className="bg-slate-50/80">
                        <td colSpan={5} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-100">
                          {group.label}
                        </td>
                      </tr>
                      {group.clients.map((c) => (
                        <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                          <td className="px-4 py-2 font-medium text-slate-900">
                            {c.full_name}
                          </td>
                          <td className="px-4 py-2 text-slate-700">
                            {c.business_name ?? "—"}
                          </td>
                          <td className="px-4 py-2 text-slate-600">
                            {c.email ?? "—"}
                          </td>
                          <td className="px-4 py-2 text-center text-slate-700">
                            {c.last_score != null ? `${c.last_score} / 100` : "—"}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleViewAsClient(c.id)}
                              className="rounded-md bg-sky-100 px-2 py-1 text-xs font-medium text-sky-800 hover:bg-sky-200"
                            >
                              View as client
                            </button>
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
