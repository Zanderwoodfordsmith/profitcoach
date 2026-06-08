"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { bossProHubPath } from "@/lib/isBossWorkshopPath";
import { useRouter } from "next/navigation";
import { getValidSupabaseAccessToken } from "@/lib/supabaseAccessToken";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { StickyPageHeader } from "@/components/layout";
import {
  ProspectsTable,
  type ProspectRow,
} from "@/components/prospects/ProspectsTable";
import { AddProspectForm } from "@/components/prospects/AddProspectForm";
import { ProspectsDailyBarChart } from "@/components/admin/ProspectsDailyBarChart";
import type { ProspectFieldPatch } from "@/lib/prospects/updateProspectFields";
import type { UpdatedProspectFields } from "@/lib/prospects/updateProspectFields";

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

  const coachSlugByCoachId = useMemo(
    () =>
      Object.fromEntries(
        coaches
          .map((coach) => [coach.id, coach.slug.trim()] as const)
          .filter(([, slug]) => slug.length > 0)
      ),
    [coaches]
  );

  const navigateToProspect = useCallback(
    (row: ProspectRow) => {
      flushSync(() => {
        if (row.coach_id) setImpersonatingCoachId(row.coach_id);
      });
      router.push(bossProHubPath(row.id, { admin: true }));
    },
    [router, setImpersonatingCoachId]
  );

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

    if (!options?.skipConfirm) {
      setDeletingId(row.id);
    }
    try {
      const res = await fetch(`/api/admin/contacts/${row.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
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

    const res = await fetch(`/api/admin/contacts/${row.id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
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
        rootRef={pageHeaderRef}
        title="Prospects"
        description="View prospects by coach, filter, and add prospects directly from the admin area."
      />

      {loading && (
        <p className="text-sm text-slate-600">Loading…</p>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}

      <ProspectsDailyBarChart prospects={prospects} loading={loading} />

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

      <div className="min-w-0 sm:-mx-3 sm:w-[calc(100%+1.5rem)]">
      <ProspectsTable
        prospects={prospects}
        loading={loading}
        error={error}
        stickyTopOffset={pageHeaderHeight}
        showCoachColumn={true}
        showTypeColumn={false}
        coachFilterOptions={coachOptions}
        onAddClick={() => {
          setShowAddProspect(true);
          setCreateError(null);
          setCreateSuccess(null);
        }}
        onRowClick={(id) => {
          const row = prospects.find((p) => p.id === id);
          if (row) navigateToProspect(row);
        }}
        editable
        onUpdateProspect={handleUpdateProspect}
        onDelete={handleDeleteProspect}
        deletingId={deletingId}
        coachSlugByCoachId={coachSlugByCoachId}
        emptyMessage="No prospects found for this selection."
      />
      </div>
    </div>
  );
}
