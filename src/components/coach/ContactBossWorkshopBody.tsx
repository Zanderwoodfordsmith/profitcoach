"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { StickyPageHeader } from "@/components/layout";
import { BossGridTransposed } from "@/components/BossGrid";
import { BossWheel, BossDoughnut, FocusAreas } from "@/components/BossCharts";
import { ContactPillarNotes } from "@/components/coach/ContactPillarNotes";
import { BossScoreDialStrip, BossAnswerMixBar } from "@/components/coach/BossScoreDialStrip";
import { computeAreaScores, computeBossPillarDialStats, computeScoreBreakdown, getTotalScore } from "@/lib/bossScores";
import { useWheelColorScheme } from "@/lib/useWheelColorScheme";
import { useWheelViewMode } from "@/lib/useWheelViewMode";

type Contact = {
  id: string;
  full_name: string;
  email: string | null;
  business_name: string | null;
};

type Assessment = {
  id: string;
  total_score: number;
  completed_at: string;
  answers: Record<string, 0 | 1 | 2>;
};

type WorkshopSessionScores = {
  answers: Record<string, 0 | 1 | 2>;
  total_score: number;
};

const ANSWERS_DEBOUNCE_MS = 500;
const NOTES_DEBOUNCE_MS = 800;

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

export type PendingNewWorkshopContact = {
  fullName: string;
  jobTitle?: string;
  businessName?: string;
};

async function createWorkshopDraftContact(
  token: string,
  impersonatingCoachId: string | null,
  contact: PendingNewWorkshopContact
): Promise<string> {
  const headers: Record<string, string> = {
    ...authHeaders(token, impersonatingCoachId),
    "Content-Type": "application/json",
  };
  const res = await fetch("/api/coach/contacts", {
    method: "POST",
    headers,
    body: JSON.stringify({
      fullName: contact.fullName,
      jobTitle: contact.jobTitle?.trim() || undefined,
      businessName: contact.businessName?.trim() || undefined,
      type: "prospect",
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    contactId?: string;
  };
  if (!res.ok || !json.contactId) {
    throw new Error(json.error ?? "Could not create session contact.");
  }
  return json.contactId;
}

export type ContactBossWorkshopBodyProps = {
  /** When null, shows an empty matrix; first save can create a prospect if `draftCoachId` is set. */
  contactId: string | null;
  /**
   * Coach user id (or impersonated coach) used to auto-create a prospect on first save when
   * `contactId` is null. Omit or null when only manual contact selection can persist (e.g. admin
   * viewing all coaches without impersonation).
   */
  draftCoachId?: string | null;
  /** Name for a new prospect when `contactId` is null — required before the first save. */
  pendingNewContact?: PendingNewWorkshopContact | null;
  /** Called after a draft workshop contact is created so the parent can sync selection / URL. */
  onDraftContactCreated?: (contact: {
    id: string;
    fullName: string;
    jobTitle?: string | null;
    businessName?: string | null;
  }) => void;
  /** Full contact header (name, back links). Omit when embedded in another page header. */
  variant?: "page" | "embedded";
  /** Shown in page variant only (e.g. back to clients + playbooks). */
  headerLeading?: ReactNode;
  /** When false, hides pillar session notes UI (e.g. BOSS workshop hub). Default true. */
  showPillarNotes?: boolean;
  /**
   * Controlled matrix edit mode (live scoring). When both are set, internal toggle state is not used.
   */
  workshopMode?: boolean;
  onWorkshopModeChange?: (next: boolean) => void;
  /** When false, omits the inline “Score together” checkbox (parent renders it). Default true. */
  showLiveScoringCheckbox?: boolean;
  /** When true, gate copy mentions “Add new person” in the contact picker. */
  canAddNewPerson?: boolean;
  /** When true, gate copy prompts user to confirm new-person details in the picker. */
  editingNewPerson?: boolean;
};

export function ContactBossWorkshopBody({
  contactId,
  draftCoachId = null,
  pendingNewContact = null,
  onDraftContactCreated,
  variant = "page",
  headerLeading,
  showPillarNotes = true,
  workshopMode: workshopModeProp,
  onWorkshopModeChange,
  showLiveScoringCheckbox = true,
  canAddNewPerson = false,
  editingNewPerson = false,
}: ContactBossWorkshopBodyProps) {
  const router = useRouter();
  const { impersonatingCoachId } = useImpersonation();
  const [wheelColorScheme] = useWheelColorScheme();
  const [wheelViewMode] = useWheelViewMode();

  const [contact, setContact] = useState<Contact | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(Boolean(contactId));
  const [error, setError] = useState<string | null>(null);
  const [matrixAnswers, setMatrixAnswers] = useState<Record<string, 0 | 1 | 2>>({});
  const [pillarNotes, setPillarNotes] = useState<Partial<Record<string, string>>>({});
  const [playbookNotes, setPlaybookNotes] = useState<Record<string, string>>({});
  const [internalWorkshopMode, setInternalWorkshopMode] = useState(true);
  const workshopModeControlled =
    typeof workshopModeProp === "boolean" && typeof onWorkshopModeChange === "function";
  const workshopMode = workshopModeControlled ? workshopModeProp : internalWorkshopMode;
  const setWorkshopMode = workshopModeControlled ? onWorkshopModeChange! : setInternalWorkshopMode;
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [scoresSaveState, setScoresSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [savedToastVisible, setSavedToastVisible] = useState(false);

  const draftContactIdRef = useRef<string | null>(null);

  const answersDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playbookNotesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAnswersRef = useRef<Record<string, 0 | 1 | 2> | null>(null);
  const pendingNotesRef = useRef<Partial<Record<string, string>> | null>(null);
  const pendingPlaybookNotesRef = useRef<Partial<Record<string, string>> | null>(null);

  useEffect(() => {
    if (contactId) {
      draftContactIdRef.current = null;
      return;
    }
    draftContactIdRef.current = null;
    setContact(null);
    setAssessment(null);
    setMatrixAnswers({});
    setPillarNotes({});
    setPlaybookNotes({});
    setError(null);
    setLoading(false);
  }, [contactId]);

  useEffect(() => {
    if (!contactId) return;

    let cancelled = false;
    async function init() {
      setLoading(true);
      setError(null);

      const {
        data: { session },
      } = await supabaseClient.auth.getSession();

      if (!session?.access_token) {
        router.replace("/login");
        return;
      }

      const res = await fetch(`/api/coach/contacts/${contactId}/session`, {
        headers: authHeaders(session.access_token, impersonatingCoachId),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        contact?: {
          id: string;
          full_name: string;
          email: string | null;
          business_name: string | null;
          pillar_session_notes?: unknown;
          playbook_session_notes?: unknown;
        };
        assessment?: Assessment | null;
        session?: WorkshopSessionScores | null;
      };

      if (cancelled) return;

      if (!res.ok) {
        setError(json.error ?? "Unable to load workshop.");
        setLoading(false);
        return;
      }

      if (!json.contact) {
        setError("Contact not found.");
        setLoading(false);
        return;
      }

      const rawNotes = json.contact.pillar_session_notes as
        | Record<string, unknown>
        | null
        | undefined;
      const notes: Partial<Record<string, string>> = {};
      if (rawNotes && typeof rawNotes === "object" && !Array.isArray(rawNotes)) {
        for (const [k, v] of Object.entries(rawNotes)) {
          if (typeof v === "string") notes[k] = v;
        }
      }

      setContact({
        id: json.contact.id,
        full_name: json.contact.full_name,
        email: json.contact.email ?? null,
        business_name: json.contact.business_name ?? null,
      });
      if (showPillarNotes) {
        setPillarNotes(notes);
      } else {
        setPillarNotes({});
      }

      const rawPlaybookNotes = json.contact.playbook_session_notes as
        | Record<string, unknown>
        | null
        | undefined;
      const playbookNotesLoaded: Record<string, string> = {};
      if (
        rawPlaybookNotes &&
        typeof rawPlaybookNotes === "object" &&
        !Array.isArray(rawPlaybookNotes)
      ) {
        for (const [k, v] of Object.entries(rawPlaybookNotes)) {
          if (typeof v === "string") playbookNotesLoaded[k] = v;
        }
      }
      setPlaybookNotes(playbookNotesLoaded);

      const loadedSession = json.session;
      if (loadedSession?.answers) {
        const ans = loadedSession.answers as Record<string, 0 | 1 | 2>;
        setAssessment(null);
        setMatrixAnswers(ans);
      } else {
        const latest = json.assessment;
        if (latest) {
          const ans = (latest.answers ?? {}) as Record<string, 0 | 1 | 2>;
          setAssessment({
            id: latest.id,
            total_score: latest.total_score,
            completed_at: latest.completed_at,
            answers: ans,
          });
          setMatrixAnswers(ans);
        } else {
          setAssessment(null);
          setMatrixAnswers({});
        }
      }

      setLoading(false);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [contactId, router, impersonatingCoachId, showPillarNotes]);

  const persistSession = useCallback(
    async (body: {
      answers?: Record<string, 0 | 1 | 2>;
      pillarNotes?: Partial<Record<string, string>>;
      playbookNotes?: Partial<Record<string, string>>;
    }) => {
      const savingScores = Boolean(body.answers);
      setSessionError(null);
      if (savingScores) setScoresSaveState("saving");
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setSessionError("Not signed in.");
        if (savingScores) setScoresSaveState("error");
        return;
      }

      let targetId = contactId ?? draftContactIdRef.current;
      if (!targetId) {
        if (!draftCoachId) {
          setSessionError("Select a contact to save.");
          if (savingScores) setScoresSaveState("error");
          return;
        }
        const fullName = pendingNewContact?.fullName?.trim();
        if (!fullName) {
          setSessionError("Enter a name above to save scores.");
          if (savingScores) setScoresSaveState("error");
          return;
        }
        const jobTitle = pendingNewContact?.jobTitle?.trim() || undefined;
        const businessName = pendingNewContact?.businessName?.trim() || undefined;
        try {
          const created = await createWorkshopDraftContact(
            token,
            impersonatingCoachId,
            { fullName, jobTitle, businessName }
          );
          draftContactIdRef.current = created;
          targetId = created;
          onDraftContactCreated?.({
            id: created,
            fullName,
            jobTitle: jobTitle ?? null,
            businessName: businessName ?? null,
          });
        } catch (e) {
          setSessionError(e instanceof Error ? e.message : "Could not create contact.");
          if (savingScores) setScoresSaveState("error");
          return;
        }
      }

      const headers: Record<string, string> = {
        ...authHeaders(token, impersonatingCoachId),
        "Content-Type": "application/json",
      };

      const res = await fetch(`/api/coach/contacts/${targetId}/session`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        assessment?: Assessment | null;
        session?: WorkshopSessionScores | null;
      };

      if (!res.ok) {
        setSessionError(json.error ?? "Could not save.");
        if (savingScores) setScoresSaveState("error");
        return;
      }

      if (json.session?.answers) {
        setAssessment(null);
        setMatrixAnswers(json.session.answers);
        if (savingScores) setScoresSaveState("saved");
      } else if (json.assessment) {
        setAssessment(json.assessment);
        setMatrixAnswers(json.assessment.answers ?? {});
        if (savingScores) setScoresSaveState("saved");
      } else if (savingScores) {
        setScoresSaveState("error");
        setSessionError("Scores could not be saved. Please try again.");
      }
    },
    [contactId, draftCoachId, impersonatingCoachId, onDraftContactCreated, pendingNewContact]
  );

  const flushPendingAnswers = useCallback(() => {
    const pending = pendingAnswersRef.current;
    pendingAnswersRef.current = null;
    if (pending) void persistSession({ answers: pending });
  }, [persistSession]);

  const flushPendingNotes = useCallback(() => {
    if (!showPillarNotes) return;
    const pending = pendingNotesRef.current;
    pendingNotesRef.current = null;
    if (pending && Object.keys(pending).length > 0) {
      void persistSession({ pillarNotes: pending });
    }
  }, [persistSession, showPillarNotes]);

  const flushPendingPlaybookNotes = useCallback(() => {
    const pending = pendingPlaybookNotesRef.current;
    pendingPlaybookNotesRef.current = null;
    if (pending && Object.keys(pending).length > 0) {
      void persistSession({ playbookNotes: pending });
    }
  }, [persistSession]);

  useEffect(() => {
    return () => {
      if (answersDebounceRef.current) clearTimeout(answersDebounceRef.current);
      if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current);
      if (playbookNotesDebounceRef.current) {
        clearTimeout(playbookNotesDebounceRef.current);
      }
      flushPendingAnswers();
      flushPendingNotes();
      flushPendingPlaybookNotes();
    };
  }, [flushPendingAnswers, flushPendingNotes, flushPendingPlaybookNotes]);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState !== "hidden") return;
      if (answersDebounceRef.current) {
        clearTimeout(answersDebounceRef.current);
        answersDebounceRef.current = null;
      }
      flushPendingAnswers();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [flushPendingAnswers]);

  const handleScoreChange = useCallback(
    (ref: string, score: 0 | 1 | 2 | null) => {
      setMatrixAnswers((prev) => {
        const next = { ...prev };
        if (score === null) {
          delete next[ref];
        } else {
          next[ref] = score;
        }
        pendingAnswersRef.current = next;
        return next;
      });
      if (answersDebounceRef.current) clearTimeout(answersDebounceRef.current);
      answersDebounceRef.current = setTimeout(() => {
        answersDebounceRef.current = null;
        flushPendingAnswers();
      }, ANSWERS_DEBOUNCE_MS);
    },
    [flushPendingAnswers]
  );

  const handlePillarNotesChange = useCallback(
    (patch: Partial<Record<string, string>>) => {
      if (!showPillarNotes) return;
      setPillarNotes((prev) => ({ ...prev, ...patch }));
      pendingNotesRef.current = {
        ...(pendingNotesRef.current ?? {}),
        ...patch,
      };
      if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current);
      notesDebounceRef.current = setTimeout(() => {
        notesDebounceRef.current = null;
        flushPendingNotes();
      }, NOTES_DEBOUNCE_MS);
    },
    [flushPendingNotes, showPillarNotes]
  );

  const handlePlaybookNotesChange = useCallback(
    (ref: string, notes: string) => {
      setPlaybookNotes((prev) => ({ ...prev, [ref]: notes }));
      pendingPlaybookNotesRef.current = {
        ...(pendingPlaybookNotesRef.current ?? {}),
        [ref]: notes,
      };
      if (playbookNotesDebounceRef.current) {
        clearTimeout(playbookNotesDebounceRef.current);
      }
      playbookNotesDebounceRef.current = setTimeout(() => {
        playbookNotesDebounceRef.current = null;
        flushPendingPlaybookNotes();
      }, NOTES_DEBOUNCE_MS);
    },
    [flushPendingPlaybookNotes]
  );

  const areaScores = computeAreaScores(matrixAnswers);
  const liveTotal = getTotalScore(matrixAnswers);
  const hasPremiumScores = Object.keys(matrixAnswers).length > 0;
  const displayPremiumTotal = hasPremiumScores ? liveTotal : null;
  const pillarDialStats = useMemo(() => computeBossPillarDialStats(matrixAnswers), [matrixAnswers]);
  const answerMix = useMemo(() => computeScoreBreakdown(matrixAnswers), [matrixAnswers]);
  const showCharts = !workshopMode && hasPremiumScores;

  const playbookBase = contactId
    ? `/coach/contacts/${contactId}/playbooks`
    : undefined;

  const scratchNoSave = !contactId && !pendingNewContact;
  const sessionGateActive = scratchNoSave;
  const canSavePlaybookNotes = Boolean(contactId || pendingNewContact);

  useEffect(() => {
    if (variant !== "page") return;
    const prev = document.title;
    document.title = contact
      ? `BOSS Score Premium — ${contact.full_name}`
      : "BOSS Score Premium";
    return () => {
      document.title = prev;
    };
  }, [variant, contact?.full_name]);

  useEffect(() => {
    if (scoresSaveState !== "saved") return;

    setShowSavedToast(true);
    setSavedToastVisible(false);

    const enterTimer = window.setTimeout(() => setSavedToastVisible(true), 20);
    const fadeOutTimer = window.setTimeout(() => setSavedToastVisible(false), 2200);
    const hideTimer = window.setTimeout(() => {
      setShowSavedToast(false);
      setScoresSaveState("idle");
    }, 2800);

    return () => {
      window.clearTimeout(enterTimer);
      window.clearTimeout(fadeOutTimer);
      window.clearTimeout(hideTimer);
    };
  }, [scoresSaveState]);

  const sessionGateMessage = editingNewPerson
    ? {
        title: "Add their details",
        body: "Fill in their name and click Start session in the panel above.",
      }
    : canAddNewPerson
      ? {
          title: "Start a session",
          body: "Choose someone from the list above, or select + Add new person to score someone new.",
        }
      : {
          title: "Select a contact",
          body: "Choose someone from the list above to start scoring.",
        };

  const inner = (
    <div className="flex w-full flex-col gap-6">
      {loading && <p className="text-sm text-slate-600">Loading…</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {sessionError && (
        <p className="text-sm text-rose-600" role="alert">
          {sessionError}
        </p>
      )}
      {assessment && !loading && !error && (
        <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Latest assessment</h2>
          <p className="text-sm text-slate-700">
            Completed {new Date(assessment.completed_at).toLocaleString()} • Score{" "}
            <span className="font-semibold text-emerald-600">
              {assessment.total_score} / 100
            </span>
          </p>
        </section>
      )}

      {showCharts && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-5 text-base font-semibold text-slate-900">Charts</h2>
          <div className="grid gap-8 md:grid-cols-3">
            <div className="flex justify-center">
              <BossWheel
                areaScores={areaScores}
                totalScore={displayPremiumTotal ?? liveTotal}
                answers={matrixAnswers}
                colorScheme={wheelColorScheme}
                viewMode={wheelViewMode}
              />
            </div>
            <div className="flex justify-center">
              <BossDoughnut scores={matrixAnswers} />
            </div>
            <div>
              <FocusAreas scores={matrixAnswers} variant="full" />
            </div>
          </div>
        </section>
      )}

      {!loading && !error && showPillarNotes && (
        <div id="boss-pillar-session-notes">
          <ContactPillarNotes pillarNotes={pillarNotes} onChange={handlePillarNotesChange} />
        </div>
      )}

      {!loading && !error && (
        <>
          <BossScoreDialStrip totalScore={displayPremiumTotal} pillarStats={pillarDialStats} />
          {showLiveScoringCheckbox ? (
            <div className="flex justify-end">
              <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  checked={workshopMode}
                  onChange={(e) => setWorkshopMode(e.target.checked)}
                />
                Score together
              </label>
            </div>
          ) : null}
          <section className="relative mt-3">
            {sessionGateActive ? (
              <>
                <div
                  className="absolute inset-0 z-10 rounded-xl bg-slate-300/50"
                  aria-hidden
                />
                <div
                  className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center bg-slate-900/10 p-4 sm:p-6"
                  aria-hidden={false}
                >
                  <div className="pointer-events-auto max-w-md rounded-xl border border-slate-200 bg-white px-7 py-8 text-center shadow-xl sm:max-w-lg sm:px-8 sm:py-9">
                    <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">
                      BOSS score
                    </p>
                    <h3 className="mt-3 text-xl font-semibold text-slate-900 sm:text-2xl">
                      {sessionGateMessage.title}
                    </h3>
                    <p className="mt-3 text-base leading-relaxed text-slate-600">
                      {sessionGateMessage.body}
                    </p>
                  </div>
                </div>
              </>
            ) : null}
            <div
              className={
                sessionGateActive ? "pointer-events-none select-none opacity-55" : undefined
              }
            >
              <BossGridTransposed
                answers={matrixAnswers}
                glass
                glassTheme="light"
                glassAlwaysShowPlaybookNames
                hideGlassScoreBar
                gridCornerLabel="Areas"
                interactive={workshopMode && !sessionGateActive}
                onScoreChange={handleScoreChange}
                playbookLinkBase={playbookBase}
                scoreBarLabels="neutral"
                playbookNotes={canSavePlaybookNotes ? playbookNotes : undefined}
                clientName={contact?.full_name}
                onPlaybookNotesChange={
                  workshopMode && canSavePlaybookNotes && !sessionGateActive
                    ? handlePlaybookNotesChange
                    : undefined
                }
              />
            </div>
          </section>
          <div className="mt-4">
            <BossAnswerMixBar
              onTrack={answerMix.green}
              building={answerMix.amber}
              needsAttention={answerMix.red}
              notAnswered={answerMix.unanswered}
            />
          </div>
        </>
      )}
    </div>
  );

  const scoresSavedToast =
    showSavedToast && !sessionError ? (
      <div
        role="status"
        aria-live="polite"
        className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg bg-emerald-500 px-3.5 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-900/15 transition-all duration-500 ease-out sm:bottom-6 sm:right-6 ${
          savedToastVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        }`}
      >
        <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
        Scores saved.
      </div>
    ) : null;

  if (variant === "embedded") {
    return (
      <>
        {inner}
        {scoresSavedToast}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader
        leading={headerLeading}
        title="BOSS Score Premium"
        descriptionPlacement="below"
        description={
          contact ? (
            <div className="flex flex-col gap-0.5 text-slate-700">
              <span className="text-base font-semibold text-slate-900">{contact.full_name}</span>
              <span className="text-sm">
                {contact.business_name ?? "No business name"}
                {contact.email ? ` • ${contact.email}` : null}
              </span>
            </div>
          ) : null
        }
      />
      {inner}
      {scoresSavedToast}
    </div>
  );
}
