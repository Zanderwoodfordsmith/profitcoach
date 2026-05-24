"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { enrichProspectRows } from "@/lib/loadProspectTableRows";
import { selectContactsWithOptionalPhone } from "@/lib/contactsSchemaSafeSelect";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useCoachClientHubAccess } from "@/hooks/useCoachClientHubAccess";
import { StickyPageHeader } from "@/components/layout";
import {
  ProspectsTable,
  type ProspectRow,
} from "@/components/prospects/ProspectsTable";
import { AddProspectForm } from "@/components/prospects/AddProspectForm";
import type { ProspectFieldPatch } from "@/lib/prospects/updateProspectFields";
import type { UpdatedProspectFields } from "@/lib/prospects/updateProspectFields";

export default function CoachProspectsPage() {
  const router = useRouter();
  const { impersonatingCoachId } = useImpersonation();
  const { allowed: clientHubAllowed } = useCoachClientHubAccess(impersonatingCoachId);
  const [prospects, setProspects] = useState<ProspectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [effectiveCoachId, setEffectiveCoachId] = useState<string | null>(
    null
  );
  const [userId, setUserId] = useState<string | null>(null);
  const [showAddProspect, setShowAddProspect] = useState(false);
  const [creatingProspect, setCreatingProspect] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [newFullName, setNewFullName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newBusinessName, setNewBusinessName] = useState("");
  const [sendInvite, setSendInvite] = useState(false);
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
      const effectiveId =
        roleBody.role === "admin" && impersonatingCoachId
          ? impersonatingCoachId
          : user.id;
      if (roleBody.role === "admin" && !impersonatingCoachId) {
        router.replace("/admin");
        return;
      }

      setUserId(user.id);
      setEffectiveCoachId(effectiveId);

      const { data: contactsData, error: contactsError } =
        await selectContactsWithOptionalPhone<{
          id: string;
          full_name: string;
          email: string | null;
          business_name: string | null;
          job_title: string | null;
          prospect_status: string | null;
          phone: string | null;
          type: string;
          created_at: string;
        }>(
          async (columns) =>
            supabaseClient
              .from("contacts")
              .select(columns)
              .eq("coach_id", effectiveId)
              .eq("type", "prospect")
              .order("created_at", { ascending: false }),
          "id, full_name, email, business_name, job_title, prospect_status, type, created_at"
        );

      if (cancelled) return;

      if (contactsError) {
        console.error("coach/prospects contacts:", contactsError);
        setError("Unable to load prospects.");
        setLoading(false);
        return;
      }

      try {
        const mapped = await enrichProspectRows(
          supabaseClient,
          contactsData.map((c) => ({
            id: c.id,
            full_name: c.full_name,
            job_title: c.job_title ?? null,
            prospect_status: c.prospect_status ?? null,
            email: c.email ?? null,
            business_name: c.business_name ?? null,
            phone: c.phone ?? null,
            type: c.type ?? "prospect",
            coach_id: effectiveId,
          }))
        );

        if (!cancelled) {
          setProspects(mapped);
        }
      } catch (err) {
        console.error("coach/prospects enrich:", err);
        if (!cancelled) {
          setError("Unable to load prospects.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
      return;
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [router, impersonatingCoachId]);

  async function handleCreateProspect(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);
    setCreatingProspect(true);

    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();

      if (!session?.access_token) {
        throw new Error("You must be signed in to add a prospect.");
      }

      const isRealCoach = effectiveCoachId === userId;
      const url = isRealCoach
        ? "/api/coach/contacts"
        : "/api/admin/contacts";
      const body: Record<string, unknown> = {
        fullName: newFullName,
        email: newEmail,
        businessName: newBusinessName,
        sendInvite,
      };
      if (!isRealCoach && effectiveCoachId) {
        body.coachId = effectiveCoachId;
      }

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error ?? "Unable to create prospect.");
      }

      const coachSlug: string | undefined = data?.coachSlug;
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

    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.access_token}`,
    };
    if (impersonatingCoachId) {
      headers["x-impersonate-coach-id"] = impersonatingCoachId;
    }

    setDeletingId(row.id);
    try {
      const res = await fetch(`/api/coach/contacts/${row.id}`, {
        method: "DELETE",
        headers,
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

  async function handleUpdateProspect(
    row: ProspectRow,
    patch: ProspectFieldPatch
  ) {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) {
      setError("You must be signed in to update a prospect.");
      return;
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    };
    if (impersonatingCoachId) {
      headers["x-impersonate-coach-id"] = impersonatingCoachId;
    }

    const res = await fetch(`/api/coach/contacts/${row.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(patch),
    });
    const body = (await res.json().catch(() => ({}))) as UpdatedProspectFields & {
      error?: string;
    };
    if (!res.ok) {
      throw new Error(body.error ?? "Unable to update prospect.");
    }

    setProspects((prev) =>
      prev.map((p) =>
        p.id === row.id
          ? {
              ...p,
              full_name: body.full_name,
              email: body.email,
              phone: body.phone,
              job_title: body.job_title,
              business_name: body.business_name,
              prospect_status: body.prospect_status,
              status: body.status,
              next_action: body.next_action,
            }
          : p
      )
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader
        title="Prospects"
        description="Add prospects and share your assessment link, or view those who have completed assessments."
      />

      <div className="flex w-full flex-col gap-4">
      {loading && (
        <p className="text-sm text-slate-600">Loading…</p>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}

      {showAddProspect && effectiveCoachId && (
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
          fixedCoachId={effectiveCoachId}
          title="Add prospect"
          description="Create a prospect and optionally copy your assessment link to email them."
          inviteCheckboxLabel="Copy my assessment link to clipboard after creating"
        />
      )}

      <ProspectsTable
        prospects={prospects}
        loading={loading}
        error={error}
        showCoachColumn={false}
        showTypeColumn={true}
        onAddClick={() => {
          setShowAddProspect(true);
          setCreateError(null);
          setCreateSuccess(null);
        }}
        onRowClick={
          clientHubAllowed
            ? (id) => router.push(`/coach/contacts/${id}`)
            : undefined
        }
        editable
        onUpdateProspect={handleUpdateProspect}
        onDelete={handleDeleteProspect}
        deletingId={deletingId}
        emptyMessage="No prospects yet. Add one below or share your assessment link."
      />
      </div>
    </div>
  );
}
