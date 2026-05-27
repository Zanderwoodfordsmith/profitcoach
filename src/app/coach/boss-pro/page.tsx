"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useBossWorkshopChrome } from "@/contexts/BossWorkshopChromeContext";
import { StickyPageHeader } from "@/components/layout";
import { ContactBossWorkshopBody } from "@/components/coach/ContactBossWorkshopBody";
import { ScorecardGlanceModal } from "@/components/scorecard/ScorecardGlanceModal";
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
  boss_score_premium?: number | null;
};

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

function readBossScorePremium(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function mergeCoachWorkshopContacts(
  prospects: Array<{
    id: string;
    full_name: string;
    business_name: string | null;
    job_title: string | null;
    type: string;
    boss_score_premium?: unknown;
  }>,
  clients: Array<{
    id: string;
    full_name: string;
    business_name: string | null;
    job_title?: string | null;
    type: string;
    boss_score_premium?: unknown;
  }>
): PickRow[] {
  const byId = new Map<string, PickRow>();
  for (const row of prospects) {
    byId.set(row.id, {
      id: row.id,
      full_name: row.full_name,
      business_name: row.business_name ?? null,
      job_title: row.job_title ?? null,
      type: row.type,
      coach_name: null,
      boss_score_premium: readBossScorePremium(row.boss_score_premium),
    });
  }
  for (const row of clients) {
    if (byId.has(row.id)) continue;
    byId.set(row.id, {
      id: row.id,
      full_name: row.full_name,
      business_name: row.business_name ?? null,
      job_title: row.job_title ?? null,
      type: row.type,
      coach_name: null,
      boss_score_premium: readBossScorePremium(row.boss_score_premium),
    });
  }
  return [...byId.values()].sort((a, b) => a.full_name.localeCompare(b.full_name));
}

function CoachWorkshopPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const contactFromUrl = searchParams.get("contact")?.trim() ?? "";
  const { impersonatingCoachId } = useImpersonation();

  const syncContactUrl = useCallback(
    (nextSelectedId: string) => {
      if (nextSelectedId && nextSelectedId !== NEW_PERSON_VALUE) {
        router.replace(
          `${pathname}?contact=${encodeURIComponent(nextSelectedId)}`,
          { scroll: false }
        );
        return;
      }
      router.replace(pathname, { scroll: false });
    },
    [pathname, router]
  );
  const chrome = useBossWorkshopChrome();
  const isMinimalChrome = chrome?.isMinimalWorkshopChrome ?? false;
  const [contacts, setContacts] = useState<PickRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>(() => contactFromUrl);
  const [deepLinkedContact, setDeepLinkedContact] =
    useState<WorkshopSessionSummary | null>(null);
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
  const [hasScorecardForContact, setHasScorecardForContact] = useState(false);
  const [scorecardModalContactId, setScorecardModalContactId] = useState<
    string | null
  >(null);

  const refreshWorkshopContacts = useCallback(async () => {
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile) return;

    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    const token = session?.access_token;
    if (!token) return;

    const isAdminUnscopedView = profile.role === "admin" && !impersonatingCoachId;
    if (isAdminUnscopedView) {
      const res = await fetch("/api/admin/contacts", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as {
        prospects?: Array<{
          id: string;
          full_name: string;
          business_name: string | null;
          job_title: string | null;
          type: string;
          coach_name?: string | null;
          boss_score_premium?: unknown;
        }>;
      };
      if (!res.ok) return;
      const mapped = (body.prospects ?? []).map((r) => ({
        id: r.id,
        full_name: r.full_name,
        business_name: r.business_name ?? null,
        job_title: r.job_title ?? null,
        type: r.type,
        coach_name: r.coach_name ?? null,
        boss_score_premium: readBossScorePremium(r.boss_score_premium),
      }));
      mapped.sort((a, b) => a.full_name.localeCompare(b.full_name));
      setContacts(mapped);
      return;
    }

    const headers = authHeaders(token, impersonatingCoachId);
    const [prospectsRes, clientsRes] = await Promise.all([
      fetch("/api/coach/prospects", { headers, cache: "no-store" }),
      fetch("/api/coach/clients", { headers, cache: "no-store" }),
    ]);
    if (!prospectsRes.ok) return;

    const prospectsBody = (await prospectsRes.json().catch(() => ({}))) as {
      prospects?: Array<{
        id: string;
        full_name: string;
        business_name: string | null;
        job_title: string | null;
        type: string;
        boss_score_premium?: unknown;
      }>;
    };
    const clientsBody = (await clientsRes.json().catch(() => ({}))) as {
      clients?: Array<{
        id: string;
        full_name: string;
        business_name: string | null;
        job_title?: string | null;
        type: string;
        boss_score_premium?: unknown;
      }>;
    };

    setContacts(
      mergeCoachWorkshopContacts(
        prospectsBody.prospects ?? [],
        clientsBody.clients ?? []
      )
    );
  }, [impersonatingCoachId]);

  useEffect(() => {
    if (contactFromUrl) {
      setSelectedId(contactFromUrl);
    }
  }, [contactFromUrl]);

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
          cache: "no-store",
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
            boss_score_premium?: unknown;
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
          boss_score_premium: readBossScorePremium(r.boss_score_premium),
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

      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        router.replace("/login");
        return;
      }

      const headers = authHeaders(token, impersonatingCoachId);
      const [prospectsRes, clientsRes] = await Promise.all([
        fetch("/api/coach/prospects", { headers, cache: "no-store" }),
        fetch("/api/coach/clients", { headers, cache: "no-store" }),
      ]);

      if (cancelled) return;

      const prospectsBody = (await prospectsRes.json().catch(() => ({}))) as {
        error?: string;
        prospects?: Array<{
          id: string;
          full_name: string;
          business_name: string | null;
          job_title: string | null;
          type: string;
          boss_score_premium?: unknown;
        }>;
      };
      const clientsBody = (await clientsRes.json().catch(() => ({}))) as {
        error?: string;
        clients?: Array<{
          id: string;
          full_name: string;
          business_name: string | null;
          job_title?: string | null;
          type: string;
          boss_score_premium?: unknown;
        }>;
      };

      if (!prospectsRes.ok) {
        setError(prospectsBody.error ?? "Unable to load contacts.");
        setLoading(false);
        return;
      }

      setContacts(
        mergeCoachWorkshopContacts(
          prospectsBody.prospects ?? [],
          clientsBody.clients ?? []
        )
      );
      setLoading(false);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [router, impersonatingCoachId]);

  const activeContactId = useMemo(() => {
    const id = (contactFromUrl || selectedId).trim();
    return id && id !== NEW_PERSON_VALUE ? id : null;
  }, [contactFromUrl, selectedId]);

  useEffect(() => {
    if (loading) return;

    const contactId = activeContactId;
    if (!contactId) {
      setDeepLinkedContact(null);
      return;
    }
    if (contacts.some((c) => c.id === contactId)) {
      setDeepLinkedContact(null);
      return;
    }
    const resolvedContactId = contactId;

    let cancelled = false;
    async function resolveDeepLinkedContact() {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      const token = session?.access_token;
      if (!token || cancelled) return;

      const res = await fetch(
        `/api/coach/contacts/${encodeURIComponent(resolvedContactId)}/session`,
        { headers: authHeaders(token, impersonatingCoachId) }
      );
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        contact?: {
          id: string;
          full_name: string;
          business_name: string | null;
        };
      };

      if (cancelled) return;

      if (!res.ok || !json.contact?.id) {
        setDeepLinkedContact(null);
        if (res.status === 404) {
          setSelectedId("");
          syncContactUrl("");
        }
        return;
      }

      const summary: WorkshopSessionSummary = {
        fullName: json.contact.full_name,
        jobTitle: null,
        businessName: json.contact.business_name,
      };
      setDeepLinkedContact(summary);
      setContacts((prev) => {
        if (prev.some((c) => c.id === json.contact!.id)) return prev;
        return [
          ...prev,
          {
            id: json.contact!.id,
            full_name: json.contact!.full_name,
            business_name: json.contact!.business_name ?? null,
            job_title: null,
            type: "prospect",
            coach_name: null,
            boss_score_premium: null,
          },
        ].sort((a, b) => a.full_name.localeCompare(b.full_name));
      });
    }

    void resolveDeepLinkedContact();
    return () => {
      cancelled = true;
    };
  }, [loading, contacts, activeContactId, impersonatingCoachId, syncContactUrl]);

  const isEditingNewPerson = selectedId === NEW_PERSON_VALUE;

  const sessionSummary = useMemo((): WorkshopSessionSummary | null => {
    if (!activeContactId) return null;
    const contact = contacts.find((c) => c.id === activeContactId);
    if (contact) {
      return {
        fullName: contact.full_name,
        jobTitle: contact.job_title,
        businessName: contact.business_name,
      };
    }
    if (deepLinkedContact) return deepLinkedContact;
    if (loading) {
      return { fullName: "Loading session…", jobTitle: null, businessName: null };
    }
    return null;
  }, [contacts, activeContactId, deepLinkedContact, loading]);

  useEffect(() => {
    if (!activeContactId) {
      setHasScorecardForContact(false);
      return;
    }

    const contactId = activeContactId;
    let cancelled = false;
    async function checkScorecard() {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      const token = session?.access_token;
      if (!token || cancelled) return;

      const res = await fetch(
        `/api/coach/contacts/${encodeURIComponent(contactId)}/scorecard-report`,
        { headers: authHeaders(token, impersonatingCoachId) }
      );
      if (!cancelled) setHasScorecardForContact(res.ok);
    }

    void checkScorecard();
    return () => {
      cancelled = true;
    };
  }, [activeContactId, impersonatingCoachId]);

  const handleViewScorecard = useCallback(() => {
    if (!activeContactId) return;
    setScorecardModalContactId(activeContactId);
  }, [activeContactId]);

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
    [clearNewPersonDraft, syncContactUrl]
  );

  const handleChangeSession = useCallback(() => {
    setSelectedId("");
    setDeepLinkedContact(null);
    clearNewPersonDraft();
    syncContactUrl("");
  }, [clearNewPersonDraft, syncContactUrl]);

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
            boss_score_premium: null,
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

  const pickerSelectedId = activeContactId ?? selectedId;

  useEffect(() => {
    const prev = document.title;
    document.title = sessionSummary
      ? `Boss Pro — ${sessionSummary.fullName}`
      : "Boss Pro";
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
    if (loading && !activeContactId) {
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
          selectedId={pickerSelectedId}
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
          showScorecardLink={hasScorecardForContact}
          onViewScorecard={handleViewScorecard}
          onPickerOpen={refreshWorkshopContacts}
        />
      </div>
    );
    return () => setWorkshopTopRight(null);
  }, [
    setWorkshopTopRight,
    registerMinimalSlot,
    loading,
    error,
    activeContactId,
    sessionSummary,
    contacts,
    pickerSelectedId,
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
    handleViewScorecard,
    hasScorecardForContact,
    refreshWorkshopContacts,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <StickyPageHeader
        title="Boss Pro"
        description={
          <span className="text-base leading-relaxed text-slate-700">
            Choose someone from the list, or pick <strong>+ Add new person</strong>, enter their
            details, and click <strong>Start session</strong> to begin scoring.
          </span>
        }
      />

      {!isMinimalChrome && loading && !activeContactId && (
        <p className="text-sm text-slate-600">Loading contacts…</p>
      )}
      {!isMinimalChrome && error && <p className="text-sm text-rose-600">{error}</p>}

      {!isMinimalChrome && (!loading || sessionSummary) && !error && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <WorkshopSessionPicker
            idPrefix="workshop-main"
            contacts={contacts}
            selectedId={pickerSelectedId}
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
            showScorecardLink={hasScorecardForContact}
            onViewScorecard={handleViewScorecard}
            onPickerOpen={refreshWorkshopContacts}
          />
        </div>
      )}

      {activeContactId && !error ? (
        <ContactBossWorkshopBody
          contactId={activeContactId}
          draftCoachId={draftCoachId}
          showLiveScoringCheckbox={false}
          showProspectMatrix={adminUnscoped}
          canAddNewPerson={showNewPersonOption}
          editingNewPerson={isEditingNewPerson}
          playbookReturnTo={
            searchParams.toString()
              ? `${pathname}?${searchParams.toString()}`
              : pathname
          }
        />
      ) : null}

      <ScorecardGlanceModal
        contactId={scorecardModalContactId}
        onClose={() => setScorecardModalContactId(null)}
      />
    </div>
  );
}

export default function CoachWorkshopPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6">
          <p className="text-sm text-slate-600">Loading Boss Pro…</p>
        </div>
      }
    >
      <CoachWorkshopPageContent />
    </Suspense>
  );
}
