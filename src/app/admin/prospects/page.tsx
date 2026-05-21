"use client";

import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { StickyPageHeader } from "@/components/layout";
import {
  ProspectsTable,
  type ProspectRow,
} from "@/components/prospects/ProspectsTable";
import { AddProspectForm } from "@/components/prospects/AddProspectForm";

export default function AdminProspectsPage() {
  const router = useRouter();
  const { setImpersonatingCoachId } = useImpersonation();
  const [prospects, setProspects] = useState<ProspectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddProspect, setShowAddProspect] = useState(false);
  const [creatingProspect, setCreatingProspect] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [newCoachId, setNewCoachId] = useState<string | "">("");
  const [newFullName, setNewFullName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newBusinessName, setNewBusinessName] = useState("");
  const [sendInvite, setSendInvite] = useState(false);
  const [coaches, setCoaches] = useState<Array<{ id: string; slug: string; full_name: string | null; coach_business_name: string | null }>>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
      if (roleBody.role !== "admin") {
        router.replace("/coach");
        return;
      }

      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        setError("Unable to load prospects.");
        setLoading(false);
        return;
      }

      const headers = { Authorization: `Bearer ${session.access_token}` };
      const [contactsRes, coachesRes] = await Promise.all([
        fetch("/api/admin/contacts?type=prospect", { headers }),
        fetch("/api/admin/coaches", { headers }),
      ]);

      if (cancelled) return;

      if (!contactsRes.ok) {
        const body = (await contactsRes.json().catch(() => ({}))) as { error?: string };
        setError(body?.error ?? "Unable to load prospects.");
        setLoading(false);
        return;
      }

      const contactsBody = (await contactsRes.json()) as { prospects?: ProspectRow[] };
      setProspects(contactsBody.prospects ?? []);

      if (coachesRes.ok) {
        const coachesBody = (await coachesRes.json()) as { coaches?: Array<{ id: string; slug: string; full_name?: string | null; coach_business_name?: string | null }> };
        const list = (coachesBody.coaches ?? []).map((c) => ({
          id: c.id,
          slug: c.slug,
          full_name: c.full_name ?? null,
          coach_business_name: c.coach_business_name ?? null,
        }));
        setCoaches(list);
      }

      setLoading(false);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const coachOptionsFromProspects = Array.from(
    new Map(
      prospects.map((p) => [
        p.coach_id,
        {
          id: p.coach_id!,
          label:
            p.coach_name ??
            p.coach_business_name ??
            `Coach ${(p.coach_id ?? "").slice(0, 6)}`,
        },
      ])
    ).values()
  ).filter((c) => c.id);
  const coachOptionsFromList = coaches.map((c) => ({
    id: c.id,
    label: c.full_name ?? c.coach_business_name ?? `Coach ${c.id.slice(0, 8)}`,
  }));
  const coachOptions =
    coachOptionsFromProspects.length > 0
      ? Array.from(
          new Map(
            [...coachOptionsFromProspects, ...coachOptionsFromList].map((c) => [c.id, c])
          ).values()
        )
      : coachOptionsFromList;

  const navigateToProspect = useCallback(
    (row: ProspectRow) => {
      flushSync(() => {
        if (row.coach_id) setImpersonatingCoachId(row.coach_id);
      });
      router.push(`/coach/contacts/${row.id}`);
    },
    [router, setImpersonatingCoachId]
  );

  async function handleDeleteProspect(row: ProspectRow) {
    if (
      !confirm(
        `Delete prospect "${row.full_name}"? This cannot be undone.`
      )
    ) {
      return;
    }

    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) {
      setError("You must be signed in to delete a prospect.");
      return;
    }

    setDeletingId(row.id);
    try {
      const res = await fetch(`/api/admin/contacts/${row.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? "Unable to delete prospect.");
      }
      setProspects((prev) => prev.filter((p) => p.id !== row.id));
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Unable to delete prospect."
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCreateProspect(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);
    setCreatingProspect(true);

    try {
      if (!newCoachId) {
        throw new Error("Please select a coach for this prospect.");
      }

      const {
        data: { session },
      } = await supabaseClient.auth.getSession();

      if (!session?.access_token) {
        throw new Error("You must be signed in to add a prospect.");
      }

      const res = await fetch("/api/admin/contacts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          coachId: newCoachId,
          fullName: newFullName,
          email: newEmail,
          businessName: newBusinessName,
          sendInvite,
        }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(body?.error ?? "Unable to create prospect.");
      }

      const coachSlug: string | undefined = body?.coachSlug;
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const assessmentLink =
        coachSlug && origin
          ? `${origin}/landing/a?coach=${encodeURIComponent(coachSlug)}`
          : coachSlug
            ? `/landing/a?coach=${encodeURIComponent(coachSlug)}`
            : null;

      if (sendInvite && assessmentLink && navigator?.clipboard) {
        try {
          await navigator.clipboard.writeText(assessmentLink);
          setCreateSuccess(
            "Prospect created. Landing link copied to clipboard – paste it into your email."
          );
        } catch {
          setCreateSuccess(
            "Prospect created. Copy and share the landing link below."
          );
        }
      } else {
        setCreateSuccess("Prospect created.");
      }

      setNewCoachId("");
      setNewFullName("");
      setNewEmail("");
      setNewBusinessName("");
      setSendInvite(false);

      router.refresh();
    } catch (err: any) {
      setCreateError(err?.message ?? "Unable to create prospect.");
    } finally {
      setCreatingProspect(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader
        title="Prospects"
        description="View prospects by coach, filter, and add prospects directly from the admin area."
        actions={
          <button
            type="button"
            onClick={() => {
              setShowAddProspect(true);
              setCreateError(null);
              setCreateSuccess(null);
            }}
            className="inline-flex items-center rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-500"
          >
            + Add prospect
          </button>
        }
      />

      {loading && (
        <p className="text-sm text-slate-600">Loading…</p>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}

      {showAddProspect && (
        <AddProspectForm
          fullName={newFullName}
          email={newEmail}
          businessName={newBusinessName}
          sendInvite={sendInvite}
          onFullNameChange={setNewFullName}
          onEmailChange={setNewEmail}
          onBusinessNameChange={setNewBusinessName}
          onSendInviteChange={setSendInvite}
          onSubmit={handleCreateProspect}
          onClose={() => {
            setShowAddProspect(false);
            setCreateError(null);
            setCreateSuccess(null);
          }}
          creating={creatingProspect}
          createError={createError}
          createSuccess={createSuccess}
          coachOptions={coachOptions}
          selectedCoachId={newCoachId}
          onCoachIdChange={(id) => setNewCoachId(id)}
          title="Add prospect"
          description="Create a prospect under a specific coach and optionally copy their assessment link so you can email it to them."
          inviteCheckboxLabel="Copy the assessment link for this coach to my clipboard after creating the prospect"
        />
      )}

      <ProspectsTable
        prospects={prospects}
        loading={loading}
        error={error}
        showCoachColumn={true}
        showTypeColumn={false}
        coachFilterOptions={coachOptions}
        onRowClick={(id) => {
          const row = prospects.find((p) => p.id === id);
          if (row) navigateToProspect(row);
        }}
        renderRowActions={(row) => (
          <button
            type="button"
            className="font-medium text-sky-700 hover:text-sky-900"
            onClick={() => navigateToProspect(row)}
          >
            View prospect
          </button>
        )}
        onDelete={handleDeleteProspect}
        deletingId={deletingId}
        emptyMessage="No prospects found for this selection."
      />
    </div>
  );
}
