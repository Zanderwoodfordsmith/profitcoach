"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useBossWorkshopChrome } from "@/contexts/BossWorkshopChromeContext";
import { StickyPageHeader } from "@/components/layout";
import { ContactBossWorkshopBody } from "@/components/coach/ContactBossWorkshopBody";
import {
  NEW_PERSON_VALUE,
  WorkshopSessionPicker,
  type WorkshopSessionSummary,
} from "@/components/coach/WorkshopSessionPicker";

type PickRow = {
  id: string;
  full_name: string;
  business_name: string | null;
  job_title: string | null;
  type: string;
  coach_name?: string | null;
};

function syncContactUrl(selectedId: string) {
  const url = new URL(window.location.href);
  if (selectedId && selectedId !== NEW_PERSON_VALUE) {
    url.searchParams.set("contact", selectedId);
  } else {
    url.searchParams.delete("contact");
  }
  window.history.replaceState({}, "", url.toString());
}

function authHeaders(
  token: string,
  impersonatingCoachId: string | null
): Record<string, string> {
  const h: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (impersonatingCoachId) {
    h["x-impersonate-coach-id"] = impersonatingCoachId;
  }
  return h;
}

export default function CoachWorkshopPage() {
  const router = useRouter();
  const { impersonatingCoachId } = useImpersonation();
  const chrome = useBossWorkshopChrome();
  const isMinimalChrome = chrome?.isMinimalWorkshopChrome ?? false;
  const [contacts, setContacts] = useState<PickRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonTitle, setNewPersonTitle] = useState("");
  const [newPersonBusiness, setNewPersonBusiness] = useState("");
  const [newPersonConfirmError, setNewPersonConfirmError] = useState<string | null>(
    null
  );
  const [newPersonConfirming, setNewPersonConfirming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminUnscoped, setAdminUnscoped] = useState(false);
  const [draftCoachId, setDraftCoachId] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("contact");
    if (q) setSelectedId(q);
  }, []);

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

      const { data: profile, error: profileError } = await supabaseClient
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile || profileError) {
        setError("Unable to load your profile.");
        setDraftCoachId(null);
        setLoading(false);
        return;
      }

      const isAdminUnscoped = profile.role === "admin" && !impersonatingCoachId;
      if (isAdminUnscoped) {
        setAdminUnscoped(true);
        setDraftCoachId(null);
        const {
          data: { session },
        } = await supabaseClient.auth.getSession();
        const token = session?.access_token;
        if (!token) {
          router.replace("/login");
          return;
        }
        const res = await fetch("/api/admin/contacts", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          prospects?: Array<{
            id: string;
            full_name: string;
            business_name: string | null;
            job_title: string | null;
            type: string;
            coach_name?: string | null;
          }>;
        };
        if (cancelled) return;
        if (!res.ok) {
          setError(body.error ?? "Unable to load contacts.");
          setLoading(false);
          return;
        }
        const rows = body.prospects ?? [];
        const mapped = rows.map((r) => ({
          id: r.id,
          full_name: r.full_name,
          business_name: r.business_name ?? null,
          job_title: r.job_title ?? null,
          type: r.type,
          coach_name: r.coach_name ?? null,
        }));
        mapped.sort((a, b) => a.full_name.localeCompare(b.full_name));
        setContacts(mapped);
        setLoading(false);
        return;
      }

      setAdminUnscoped(false);
      const effectiveCoachId =
        profile.role === "admin" && impersonatingCoachId
          ? impersonatingCoachId
          : user.id;
      setDraftCoachId(effectiveCoachId);

      const { data: rows, error: listError } = await supabaseClient
        .from("contacts")
        .select("id, full_name, business_name, job_title, type")
        .eq("coach_id", effectiveCoachId)
        .order("full_name", { ascending: true });

      if (cancelled) return;

      if (listError) {
        setError("Unable to load contacts.");
        setLoading(false);
        return;
      }

      setContacts((rows ?? []) as PickRow[]);
      setLoading(false);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [router, impersonatingCoachId]);

  useEffect(() => {
    if (loading) return;
    if (!selectedId || selectedId === NEW_PERSON_VALUE) return;
    if (!contacts.length) return;
    if (!contacts.some((c) => c.id === selectedId)) {
      setSelectedId("");
      syncContactUrl("");
    }
  }, [loading, contacts, selectedId]);

  const isEditingNewPerson = selectedId === NEW_PERSON_VALUE;

  const sessionSummary = useMemo((): WorkshopSessionSummary | null => {
    if (!selectedId || selectedId === NEW_PERSON_VALUE) return null;
    const contact = contacts.find((c) => c.id === selectedId);
    if (!contact) return null;
    return {
      fullName: contact.full_name,
      jobTitle: contact.job_title,
      businessName: contact.business_name,
    };
  }, [contacts, selectedId]);

  const clearNewPersonDraft = useCallback(() => {
    setNewPersonName("");
    setNewPersonTitle("");
    setNewPersonBusiness("");
    setNewPersonConfirmError(null);
  }, []);

  const handleSelectedIdChange = useCallback(
    (value: string) => {
      setSelectedId(value);
      setNewPersonConfirmError(null);
      if (value !== NEW_PERSON_VALUE) {
        clearNewPersonDraft();
      }
      syncContactUrl(value);
    },
    [clearNewPersonDraft]
  );

  const handleChangeSession = useCallback(() => {
    setSelectedId("");
    clearNewPersonDraft();
    syncContactUrl("");
  }, [clearNewPersonDraft]);

  const handleCancelNewPerson = useCallback(() => {
    handleChangeSession();
  }, [handleChangeSession]);

  const handleConfirmNewPerson = useCallback(async () => {
    const fullName = newPersonName.trim();
    if (!fullName) {
      setNewPersonConfirmError("Please enter a name.");
      return;
    }
    if (!draftCoachId) {
      setNewPersonConfirmError("Unable to create prospect for this account.");
      return;
    }

    setNewPersonConfirming(true);
    setNewPersonConfirmError(null);

    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setNewPersonConfirmError("Not signed in.");
        return;
      }

      const res = await fetch("/api/coach/contacts", {
        method: "POST",
        headers: {
          ...authHeaders(token, impersonatingCoachId),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName,
          jobTitle: newPersonTitle.trim() || undefined,
          businessName: newPersonBusiness.trim() || undefined,
          type: "prospect",
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        contactId?: string;
      };

      if (!res.ok || !json.contactId) {
        throw new Error(json.error ?? "Could not create prospect.");
      }

      const jobTitle = newPersonTitle.trim() || null;
      const businessName = newPersonBusiness.trim() || null;

      setContacts((prev) => {
        if (prev.some((c) => c.id === json.contactId)) return prev;
        return [
          {
            id: json.contactId!,
            full_name: fullName,
            business_name: businessName,
            job_title: jobTitle,
            type: "prospect",
            coach_name: null,
          },
          ...prev,
        ];
      });
      setSelectedId(json.contactId);
      clearNewPersonDraft();
      syncContactUrl(json.contactId);
    } catch (e) {
      setNewPersonConfirmError(
        e instanceof Error ? e.message : "Could not create prospect."
      );
    } finally {
      setNewPersonConfirming(false);
    }
  }, [
    newPersonName,
    newPersonTitle,
    newPersonBusiness,
    draftCoachId,
    impersonatingCoachId,
    clearNewPersonDraft,
  ]);

  const activeContactId =
    selectedId && selectedId !== NEW_PERSON_VALUE ? selectedId : null;

  useEffect(() => {
    const prev = document.title;
    document.title = sessionSummary
      ? `BOSS score — ${sessionSummary.fullName}`
      : "BOSS score";
    return () => {
      document.title = prev;
    };
  }, [sessionSummary]);

  const clientsHref = adminUnscoped ? "/admin/clients" : "/coach/clients";
  const clientsLabel = adminUnscoped ? "Admin clients" : "Clients";
  const showNewPersonOption = Boolean(draftCoachId);

  const setWorkshopTopRight = chrome?.setWorkshopTopRight;
  const registerMinimalSlot = chrome?.isMinimalWorkshopChrome;

  useEffect(() => {
    if (!setWorkshopTopRight) return;
    if (!registerMinimalSlot) {
      setWorkshopTopRight(null);
      return;
    }
    if (loading) {
      setWorkshopTopRight(
        <p className="text-xs text-slate-600">Loading contacts…</p>
      );
      return () => setWorkshopTopRight(null);
    }
    if (error) {
      setWorkshopTopRight(<p className="text-xs text-rose-600">{error}</p>);
      return () => setWorkshopTopRight(null);
    }

    setWorkshopTopRight(
      <div
        className={
          sessionSummary
            ? "rounded-lg border border-sky-200/90 bg-white px-3 py-2.5 text-left shadow-md ring-1 ring-slate-900/5 backdrop-blur-sm"
            : "rounded-xl border border-sky-200/90 bg-white px-3.5 py-3 text-left shadow-lg ring-1 ring-slate-900/5 backdrop-blur-sm sm:min-w-[18rem]"
        }
      >
        <WorkshopSessionPicker
          idPrefix="workshop-top"
          compact
          contacts={contacts}
          selectedId={selectedId}
          onSelectedIdChange={handleSelectedIdChange}
          sessionSummary={sessionSummary}
          onChangeSession={handleChangeSession}
          newPersonName={newPersonName}
          onNewPersonNameChange={setNewPersonName}
          newPersonTitle={newPersonTitle}
          onNewPersonTitleChange={setNewPersonTitle}
          newPersonBusiness={newPersonBusiness}
          onNewPersonBusinessChange={setNewPersonBusiness}
          isEditingNewPerson={isEditingNewPerson}
          onConfirmNewPerson={handleConfirmNewPerson}
          onCancelNewPerson={handleCancelNewPerson}
          confirmError={newPersonConfirmError}
          confirming={newPersonConfirming}
          showNewPersonOption={showNewPersonOption}
          adminUnscoped={adminUnscoped}
          clientsHref={clientsHref}
          clientsLabel={clientsLabel}
        />
      </div>
    );
    return () => setWorkshopTopRight(null);
  }, [
    setWorkshopTopRight,
    registerMinimalSlot,
    loading,
    error,
    sessionSummary,
    contacts,
    selectedId,
    handleSelectedIdChange,
    handleChangeSession,
    newPersonName,
    newPersonTitle,
    newPersonBusiness,
    isEditingNewPerson,
    handleConfirmNewPerson,
    handleCancelNewPerson,
    newPersonConfirmError,
    newPersonConfirming,
    showNewPersonOption,
    adminUnscoped,
    clientsHref,
    clientsLabel,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <StickyPageHeader
        title="BOSS score"
        description={
          <span className="text-base leading-relaxed text-slate-700">
            Choose someone from the list, or pick <strong>+ Add new person</strong>, enter their
            details, and click <strong>Start session</strong> to begin scoring.
          </span>
        }
      />

      {!isMinimalChrome && loading && <p className="text-sm text-slate-600">Loading contacts…</p>}
      {!isMinimalChrome && error && <p className="text-sm text-rose-600">{error}</p>}

      {!isMinimalChrome && !loading && !error && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <WorkshopSessionPicker
            idPrefix="workshop-main"
            contacts={contacts}
            selectedId={selectedId}
            onSelectedIdChange={handleSelectedIdChange}
            sessionSummary={sessionSummary}
            onChangeSession={handleChangeSession}
            newPersonName={newPersonName}
            onNewPersonNameChange={setNewPersonName}
            newPersonTitle={newPersonTitle}
            onNewPersonTitleChange={setNewPersonTitle}
            newPersonBusiness={newPersonBusiness}
            onNewPersonBusinessChange={setNewPersonBusiness}
            isEditingNewPerson={isEditingNewPerson}
            onConfirmNewPerson={handleConfirmNewPerson}
            onCancelNewPerson={handleCancelNewPerson}
            confirmError={newPersonConfirmError}
            confirming={newPersonConfirming}
            showNewPersonOption={showNewPersonOption}
            adminUnscoped={adminUnscoped}
            clientsHref={clientsHref}
            clientsLabel={clientsLabel}
          />
        </div>
      )}

      {!loading && !error ? (
        <ContactBossWorkshopBody
          contactId={activeContactId}
          draftCoachId={draftCoachId}
          variant="embedded"
          showPillarNotes={false}
          showLiveScoringCheckbox={false}
          canAddNewPerson={showNewPersonOption}
          editingNewPerson={isEditingNewPerson}
        />
      ) : null}
    </div>
  );
}
