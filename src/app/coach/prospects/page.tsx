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
import { AddProspectForm } from "@/components/prospects/AddProspectForm";

export default function CoachProspectsPage() {
  const router = useRouter();
  const { impersonatingCoachId } = useImpersonation();
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
        await supabaseClient
          .from("contacts")
          .select(
            "id, full_name, email, business_name, type, created_at"
          )
          .eq("coach_id", effectiveId)
          .eq("type", "prospect")
          .order("created_at", { ascending: false });

      if (cancelled) return;

      if (contactsError) {
        setError("Unable to load prospects.");
        setLoading(false);
        return;
      }

      const contactIds =
        contactsData?.map((c: any) => c.id as string) ?? [];

      let latestByContact: Record<
        string,
        { total_score: number; completed_at: string }
      > = {};

      if (contactIds.length > 0) {
        const { data: assessments, error: assessmentsError } =
          await supabaseClient
            .from("assessments")
            .select("contact_id, total_score, completed_at")
            .in("contact_id", contactIds)
            .order("completed_at", { ascending: false });

        if (!assessmentsError && assessments) {
          for (const row of assessments as any[]) {
            const cid = row.contact_id as string;
            if (!latestByContact[cid]) {
              latestByContact[cid] = {
                total_score: row.total_score as number,
                completed_at: row.completed_at as string,
              };
            }
          }
        }
      }

      const mapped: ProspectRow[] =
        contactsData?.map((c: any) => {
          const latest = latestByContact[c.id as string];
          return {
            id: c.id as string,
            full_name: c.full_name as string,
            email: c.email ?? null,
            business_name: c.business_name ?? null,
            type: (c.type as string) ?? "prospect",
            last_score: latest?.total_score ?? null,
            last_completed_at: latest?.completed_at ?? null,
          };
        }) ?? [];

      setProspects(mapped);
      setLoading(false);
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

  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader
        title="Prospects"
        description="Add prospects and share your assessment link, or view those who have completed assessments."
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
        onRowClick={(id) => router.push(`/coach/contacts/${id}`)}
        emptyMessage="No prospects yet. Add one below or share your assessment link."
      />
      </div>
    </div>
  );
}
