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
  WorkshopSessionActionsMenu,
  WorkshopSessionPicker,
  type WorkshopSessionSummary,
} from "@/components/coach/WorkshopSessionPicker";
import { isAdminUnscopedBossProView } from "@/lib/isBossWorkshopPath";

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

async function loadProfileRole(userId: string): Promise<string | null> {
  const roleRes = await fetch("/api/profile-role", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  const roleBody = (await roleRes.json().catch(() => ({}))) as {
    role?: string;
    error?: string;
  };
  if (!roleRes.ok || !roleBody.role) return null;
  return roleBody.role;
}

function mergeCoachWorkshopContacts(
  rows: Array<{
    id: string;
    full_name: string;
    business_name: string | null;
    job_title?: string | null;
    type: string;
    boss_score_premium?: unknown;
  }>
): PickRow[] {
  return rows
    .map((row) => ({
      id: row.id,
      full_name: row.full_name,
      business_name: row.business_name ?? null,
      job_title: row.job_title ?? null,
      type: row.type,
      coach_name: null,
      boss_score_premium: readBossScorePremium(row.boss_score_premium),
    }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

function coachOptionLabel(coach: {
  full_name?: string | null;
  coach_business_name?: string | null;
  id: string;
}): string {
  return (
    coach.full_name ??
    coach.coach_business_name ??
    `Coach ${coach.id.slice(0, 8)}`
  );
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
  const [coachOptions, setCoachOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [newPersonCoachId, setNewPersonCoachId] = useState("");
  const [hasScorecardForContact, setHasScorecardForContact] = useState(false);
  const [scorecardModalContactId, setScorecardModalContactId] = useState<
    string | null
  >(null);
  const [clientDashboardShareLoading, setClientDashboardShareLoading] =
    useState(false);
  const [clientDashboardShareCopied, setClientDashboardShareCopied] =
    useState(false);
  const [clientDashboardShareMessage, setClientDashboardShareMessage] = useState<
    string | null
  >(null);

  const refreshWorkshopContacts = useCallback(async () => {
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    if (!user) return;

    const role = await loadProfileRole(user.id);
    if (!role) return;

    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    const token = session?.access_token;
    if (!token) return;

    const isAdminUnscopedView = isAdminUnscopedBossProView(
      role,
      pathname,
      impersonatingCoachId
    );
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
    const res = await fetch("/api/coach/workshop-contacts", {
      headers,
      cache: "no-store",
    });
    if (!res.ok) return;

    const body = (await res.json().catch(() => ({}))) as {
      contacts?: Array<{
        id: string;
        full_name: string;
        business_name: string | null;
        job_title: string | null;
        type: string;
        boss_score_premium?: unknown;
      }>;
    };

    setContacts(mergeCoachWorkshopContacts(body.contacts ?? []));
  }, [impersonatingCoachId, pathname]);

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

      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const role =
        (profile?.role as string | undefined) ??
        (await loadProfileRole(user.id));

      if (!role) {
        setError("Unable to load your profile.");
        setDraftCoachId(null);
        setLoading(false);
        return;
      }

      const isAdminUnscoped = isAdminUnscopedBossProView(
        role,
        pathname,
        impersonatingCoachId
      );
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
        const coachesRes = await fetch("/api/admin/coaches", {
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
        if (coachesRes.ok) {
          const coachesBody = (await coachesRes.json().catch(() => ({}))) as {
            coaches?: Array<{
              id: string;
              full_name?: string | null;
              coach_business_name?: string | null;
            }>;
          };
          setCoachOptions(
            (coachesBody.coaches ?? []).map((coach) => ({
              id: coach.id,
              label: coachOptionLabel(coach),
            }))
          );
        } else {
          setCoachOptions([]);
        }
        setLoading(false);
        return;
      }

      setAdminUnscoped(false);
      setCoachOptions([]);
      const effectiveCoachId =
        role === "admin" && impersonatingCoachId
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
      const res = await fetch("/api/coach/workshop-contacts", {
        headers,
        cache: "no-store",
      });

      if (cancelled) return;

      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        contacts?: Array<{
          id: string;
          full_name: string;
          business_name: string | null;
          job_title: string | null;
          type: string;
          boss_score_premium?: unknown;
        }>;
      };

      if (!res.ok) {
        setError(body.error ?? "Unable to load contacts.");
        setLoading(false);
        return;
      }

      setContacts(mergeCoachWorkshopContacts(body.contacts ?? []));
      setLoading(false);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [router, impersonatingCoachId, pathname]);

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
        {
          headers: authHeaders(
            token,
            adminUnscoped ? null : impersonatingCoachId
          ),
        }
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
  }, [loading, contacts, activeContactId, adminUnscoped, impersonatingCoachId, syncContactUrl]);

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
        {
          headers: authHeaders(
            token,
            adminUnscoped ? null : impersonatingCoachId
          ),
        }
      );
      if (!cancelled) setHasScorecardForContact(res.ok);
    }

    void checkScorecard();
    return () => {
      cancelled = true;
    };
  }, [activeContactId, adminUnscoped, impersonatingCoachId]);

  const handleViewScorecard = useCallback(() => {
    if (!activeContactId) return;
    setScorecardModalContactId(activeContactId);
  }, [activeContactId]);

  const handleCopyClientDashboardLink = useCallback(async () => {
    if (!activeContactId) return;
    setClientDashboardShareLoading(true);
    setClientDashboardShareCopied(false);
    setClientDashboardShareMessage(null);
    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setClientDashboardShareMessage("Sign in to copy the client link.");
        return;
      }

      const res = await fetch(
        `/api/coach/contacts/${encodeURIComponent(activeContactId)}/dashboard-share-link`,
        {
          headers: authHeaders(
            token,
            adminUnscoped ? null : impersonatingCoachId
          ),
        }
      );
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        url?: string;
      };
      if (!res.ok || !body.url) {
        setClientDashboardShareMessage(
          body.error ??
            "Could not create a client dashboard link. Score this contact in Boss Pro first."
        );
        return;
      }

      await navigator.clipboard.writeText(body.url);
      setClientDashboardShareCopied(true);
      window.setTimeout(() => setClientDashboardShareCopied(false), 2500);
    } catch {
      setClientDashboardShareMessage("Could not copy the client link.");
    } finally {
      setClientDashboardShareLoading(false);
    }
  }, [activeContactId, adminUnscoped, impersonatingCoachId]);

  const clearNewPersonDraft = useCallback(() => {
    setNewPersonName("");
    setNewPersonTitle("");
    setNewPersonBusiness("");
    setNewPersonCoachId("");
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

      if (adminUnscoped) {
        const coachId = newPersonCoachId.trim();
        if (!coachId) {
          setNewPersonConfirmError("Please select a coach.");
          return;
        }

        const res = await fetch("/api/admin/contacts", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            coachId,
            fullName,
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

        const businessName = newPersonBusiness.trim() || null;
        const coachName =
          coachOptions.find((coach) => coach.id === coachId)?.label ?? null;

        setContacts((prev) => {
          if (prev.some((c) => c.id === json.contactId)) return prev;
          return [
            {
              id: json.contactId!,
              full_name: fullName,
              business_name: businessName,
              job_title: null,
              type: "prospect",
              coach_name: coachName,
              boss_score_premium: null,
            },
            ...prev,
          ].sort((a, b) => a.full_name.localeCompare(b.full_name));
        });
        setSelectedId(json.contactId);
        clearNewPersonDraft();
        syncContactUrl(json.contactId);
        return;
      }

      if (!draftCoachId) {
        setNewPersonConfirmError("Unable to create prospect for this account.");
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
    newPersonCoachId,
    adminUnscoped,
    coachOptions,
    draftCoachId,
    impersonatingCoachId,
    clearNewPersonDraft,
    syncContactUrl,
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
  const showNewPersonOption = Boolean(draftCoachId) || adminUnscoped;
  const showCenteredContactPicker = isMinimalChrome && !activeContactId && !error;

  const workshopPickerProps = useMemo(
    () => ({
      contacts,
      selectedId: pickerSelectedId,
      onSelectedIdChange: handleSelectedIdChange,
      sessionSummary,
      onChangeSession: handleChangeSession,
      newPersonName,
      onNewPersonNameChange: setNewPersonName,
      newPersonTitle,
      onNewPersonTitleChange: setNewPersonTitle,
      newPersonBusiness,
      onNewPersonBusinessChange: setNewPersonBusiness,
      newPersonCoachId,
      onNewPersonCoachIdChange: setNewPersonCoachId,
      coachOptions,
      isEditingNewPerson,
      onConfirmNewPerson: handleConfirmNewPerson,
      onCancelNewPerson: handleCancelNewPerson,
      confirmError: newPersonConfirmError,
      confirming: newPersonConfirming,
      showNewPersonOption,
      adminUnscoped,
      clientsHref,
      clientsLabel,
      showScorecardLink: hasScorecardForContact,
      onViewScorecard: handleViewScorecard,
      showClientDashboardLink: Boolean(activeContactId && sessionSummary),
      clientDashboardLinkLoading: clientDashboardShareLoading,
      onCopyClientDashboardLink: handleCopyClientDashboardLink,
      clientDashboardLinkCopied: clientDashboardShareCopied,
      clientDashboardLinkError: clientDashboardShareMessage,
      onPickerOpen: refreshWorkshopContacts,
      suppressSessionSummary: true,
    }),
    [
      contacts,
      pickerSelectedId,
      handleSelectedIdChange,
      sessionSummary,
      handleChangeSession,
      newPersonName,
      newPersonTitle,
      newPersonBusiness,
      newPersonCoachId,
      coachOptions,
      isEditingNewPerson,
      handleConfirmNewPerson,
      handleCancelNewPerson,
      newPersonConfirmError,
      newPersonConfirming,
      showNewPersonOption,
      adminUnscoped,
      clientsHref,
      clientsLabel,
      hasScorecardForContact,
      handleViewScorecard,
      activeContactId,
      sessionSummary,
      clientDashboardShareLoading,
      handleCopyClientDashboardLink,
      clientDashboardShareCopied,
      clientDashboardShareMessage,
      refreshWorkshopContacts,
    ]
  );

  const sessionToolbar = useMemo(() => {
    if (!sessionSummary) return null;
    return (
      <WorkshopSessionActionsMenu
        variant="toolbar"
        compact={isMinimalChrome}
        summary={sessionSummary}
        onChangeSession={handleChangeSession}
        showScorecardLink={hasScorecardForContact}
        onViewScorecard={handleViewScorecard}
        showClientDashboardLink={Boolean(activeContactId)}
        clientDashboardLinkLoading={clientDashboardShareLoading}
        onCopyClientDashboardLink={handleCopyClientDashboardLink}
        clientDashboardLinkCopied={clientDashboardShareCopied}
        clientDashboardLinkError={clientDashboardShareMessage}
      />
    );
  }, [
    sessionSummary,
    isMinimalChrome,
    handleChangeSession,
    hasScorecardForContact,
    handleViewScorecard,
    activeContactId,
    clientDashboardShareLoading,
    handleCopyClientDashboardLink,
    clientDashboardShareCopied,
    clientDashboardShareMessage,
  ]);

  const setWorkshopTopRight = chrome?.setWorkshopTopRight;

  useEffect(() => {
    if (!setWorkshopTopRight) return;
    if (sessionToolbar && !isMinimalChrome) {
      setWorkshopTopRight(sessionToolbar);
    } else {
      setWorkshopTopRight(null);
    }
    return () => setWorkshopTopRight(null);
  }, [setWorkshopTopRight, sessionToolbar, isMinimalChrome]);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {!(isMinimalChrome && !activeContactId) ? (
        <StickyPageHeader
          title="Boss Pro"
          nowrap
          actions={
            sessionToolbar
              ? isMinimalChrome
                ? sessionToolbar
                : <div className="md:hidden">{sessionToolbar}</div>
              : undefined
          }
          description={
            sessionSummary ? undefined : (
              <span className="text-base leading-relaxed text-slate-700">
                {adminUnscoped ? (
                  <>
                    Choose a contact from the <strong>Clients</strong> or{" "}
                    <strong>Prospects</strong> list, or pick{" "}
                    <strong>+ Add new person</strong> to score someone who is not listed
                    yet.
                  </>
                ) : (
                  <>
                    Choose someone from the list, or pick <strong>+ Add new person</strong>,
                    enter their details, and click <strong>Start session</strong> to begin
                    scoring.
                  </>
                )}
              </span>
            )
          }
        />
      ) : null}

      {!isMinimalChrome && loading && !activeContactId && (
        <p className="text-sm text-slate-600">Loading contacts…</p>
      )}
      {!isMinimalChrome && error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="flex min-w-0 flex-col gap-6 overflow-x-hidden">
      {!isMinimalChrome && !sessionSummary && (!loading || sessionSummary) && !error && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <WorkshopSessionPicker idPrefix="workshop-main" {...workshopPickerProps} />
        </div>
      )}

      {!error ? (
        <ContactBossWorkshopBody
          contactId={activeContactId}
          draftCoachId={draftCoachId}
          adminUnscoped={adminUnscoped}
          showLiveScoringCheckbox={false}
          showProspectMatrix={adminUnscoped}
          canAddNewPerson={showNewPersonOption}
          editingNewPerson={isEditingNewPerson}
          centerSessionGate={isMinimalChrome}
          sessionGateContactsLoading={loading}
          sessionGateSlot={
            showCenteredContactPicker ? (
              <WorkshopSessionPicker
                idPrefix="workshop-gate"
                hideEmptyStateHeading
                autoOpenContactList
                {...workshopPickerProps}
              />
            ) : undefined
          }
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
