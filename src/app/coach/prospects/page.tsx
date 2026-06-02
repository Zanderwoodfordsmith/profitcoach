"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getValidSupabaseAccessToken } from "@/lib/supabaseAccessToken";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useCoachClientHubAccess } from "@/hooks/useCoachClientHubAccess";
import { StickyPageHeader } from "@/components/layout";
import {
  ProspectsTable,
  type ProspectRow,
} from "@/components/prospects/ProspectsTable";
import { AddProspectForm } from "@/components/prospects/AddProspectForm";
import { ProspectsLandingStats } from "@/components/prospects/ProspectsLandingStats";
import type { ProspectFieldPatch } from "@/lib/prospects/updateProspectFields";
import { bossProHubPath } from "@/lib/isBossWorkshopPath";
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
  const [coachSlug, setCoachSlug] = useState<string | null>(null);
  const pageHeaderRef = useRef<HTMLDivElement>(null);
  const [pageHeaderHeight, setPageHeaderHeight] = useState(0);

  useLayoutEffect(() => {
    const el = pageHeaderRef.current;
    if (!el) return;

    const measure = () => {
      setPageHeaderHeight(Math.round(el.getBoundingClientRect().height));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading, showAddProspect]);

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

      const {
        data: { session },
      } = await supabaseClient.auth.getSession();

      if (!session?.access_token) {
        router.replace("/login");
        return;
      }

      const headers: Record<string, string> = {
        Authorization: `Bearer ${session.access_token}`,
      };
      if (roleBody.role === "admin" && impersonatingCoachId) {
        headers["x-impersonate-coach-id"] = impersonatingCoachId;
      }

      const res = await fetch("/api/coach/prospects", { headers });
      const body = (await res.json().catch(() => ({}))) as {
        prospects?: ProspectRow[];
        coachSlug?: string | null;
        error?: string;
      };

      if (cancelled) return;

      if (!res.ok) {
        console.error("coach/prospects:", body.error);
        setError(body.error ?? "Unable to load prospects.");
        setLoading(false);
        return;
      }

      if (!cancelled) {
        setProspects(body.prospects ?? []);
        setCoachSlug(body.coachSlug ?? null);
        setLoading(false);
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

  async function handleDeleteProspect(
    row: ProspectRow,
    options?: { skipConfirm?: boolean }
  ) {
    const accessToken = await getValidSupabaseAccessToken();
    if (!accessToken) {
      const message = "You must be signed in to delete a prospect.";
      setError(message);
      throw new Error(message);
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };
    if (impersonatingCoachId) {
      headers["x-impersonate-coach-id"] = impersonatingCoachId;
    }

    if (!options?.skipConfirm) {
      setDeletingId(row.id);
    }
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
      throw err;
    } finally {
      if (!options?.skipConfirm) {
        setDeletingId(null);
      }
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
              crm_contact_id: body.crm_contact_id,
            }
          : p
      )
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader
        rootRef={pageHeaderRef}
        title="Prospects"
        description="Add prospects and share your assessment link, or view those who have completed assessments."
      />

      {loading && (
        <p className="text-sm text-slate-600">Loading…</p>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}

      {!loading && !error && (
        <ProspectsLandingStats
          coachSlug={coachSlug}
          impersonatingCoachId={impersonatingCoachId}
        />
      )}

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

      <div className="min-w-0 sm:-mx-3 sm:w-[calc(100%+1.5rem)]">
      <ProspectsTable
        prospects={prospects}
        loading={loading}
        error={error}
        stickyTopOffset={pageHeaderHeight}
        showCoachColumn={false}
        showTypeColumn={true}
        onAddClick={() => {
          setShowAddProspect(true);
          setCreateError(null);
          setCreateSuccess(null);
        }}
        onRowClick={
          clientHubAllowed
            ? (id) => router.push(bossProHubPath(id))
            : undefined
        }
        editable
        onUpdateProspect={handleUpdateProspect}
        onDelete={handleDeleteProspect}
        deletingId={deletingId}
        coachSlug={coachSlug}
        emptyMessage="No prospects yet. Add one below or share your assessment link."
      />
      </div>
    </div>
  );
}
