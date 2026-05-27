"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, RefreshCw } from "lucide-react";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { BossGridTransposed, WorkshopProspectMatrix } from "@/components/BossGrid";
import { BossWheel, BossDoughnut, FocusAreas } from "@/components/BossCharts";
import { BossScoreDialStrip, BossAnswerMixBar } from "@/components/coach/BossScoreDialStrip";
import { WorkshopOwnerLevelBars } from "@/components/coach/WorkshopOwnerLevelBars";
import { WorkshopInsightReader } from "@/components/coach/WorkshopInsightReader";
import type { StoredInsights } from "@/lib/insightGenerator";
import {
  computeAreaScores,
  computeBossPillarDialStats,
  computeScoreBreakdown,
  computeWorkshopScoreMixCategories,
  getTotalScore,
} from "@/lib/bossScores";
import { computeProspectDimensionBreakdown } from "@/lib/playbookSessionNotes";
import { useWheelColorScheme } from "@/lib/useWheelColorScheme";
import { useWheelViewMode } from "@/lib/useWheelViewMode";

type Contact = {
  id: string;
  full_name: string;
  email: string | null;
  business_name: string | null;
};

type WorkshopSessionScores = {
  answers: Record<string, 0 | 1 | 2>;
  total_score: number;
};

const ANSWERS_DEBOUNCE_MS = 500;
const NOTES_DEBOUNCE_MS = 800;
const INSIGHTS_DEBOUNCE_MS = 3 * 60 * 1000;
const INSIGHTS_STALE_MS = 2 * 60 * 60 * 1000;

const WORKSHOP_CARD_SHELL =
  "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02),0_4px_12px_rgba(0,0,0,0.015)]";

const WORKSHOP_CARD_HEADER =
  "border-b border-slate-600/40 bg-slate-700 px-4 py-2.5 text-sm font-semibold tracking-wide text-white";

function readStoredInsights(value: unknown): StoredInsights | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (!record.overallShort || typeof record.overallShort !== "object") return null;
  return value as StoredInsights;
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
  /** App path for playbook detail back links (e.g. BOSS score hub). */
  playbookReturnTo?: string;
  /** Admin-only WIP: prospect priority matrix at the bottom of Boss Pro. */
  showProspectMatrix?: boolean;
};

export function ContactBossWorkshopBody({
  contactId,
  draftCoachId = null,
  pendingNewContact = null,
  onDraftContactCreated,
  workshopMode: workshopModeProp,
  onWorkshopModeChange,
  showLiveScoringCheckbox = true,
  canAddNewPerson = false,
  editingNewPerson = false,
  playbookReturnTo,
  showProspectMatrix = false,
}: ContactBossWorkshopBodyProps) {
  const router = useRouter();
  const { impersonatingCoachId, setImpersonatingContactId } = useImpersonation();
  const [wheelColorScheme] = useWheelColorScheme();
  const [wheelViewMode] = useWheelViewMode();

  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(Boolean(contactId));
  const [error, setError] = useState<string | null>(null);
  const [matrixAnswers, setMatrixAnswers] = useState<Record<string, 0 | 1 | 2>>({});
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
  const [sessionInsights, setSessionInsights] = useState<StoredInsights | null>(null);
  const [insightsGenerating, setInsightsGenerating] = useState(false);
  const [insightsGenerationReady, setInsightsGenerationReady] = useState(false);
  const [insightsGenerationError, setInsightsGenerationError] = useState<string | null>(
    null
  );

  const draftContactIdRef = useRef<string | null>(null);
  const insightsGenerationStartedAtRef = useRef<string | null>(null);
  const insightsPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const insightsGenerationReadyRef = useRef(false);

  const answersDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playbookNotesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insightsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAnswersRef = useRef<Record<string, 0 | 1 | 2> | null>(null);
  const pendingPlaybookNotesRef = useRef<Partial<Record<string, string>> | null>(null);
  const openPlaybookSheetRef = useRef<((ref: string) => void) | null>(null);
  const ownerLevelsCardRef = useRef<HTMLElement>(null);
  const [ownerLevelsCardHeight, setOwnerLevelsCardHeight] = useState<number | null>(null);

  useEffect(() => {
    if (contactId) {
      draftContactIdRef.current = null;
      return;
    }
    draftContactIdRef.current = null;
    setContact(null);
    setMatrixAnswers({});
    setPlaybookNotes({});
    setSessionInsights(null);
    setError(null);
    setLoading(false);
  }, [contactId]);

  useEffect(() => {
    insightsGenerationReadyRef.current = insightsGenerationReady;
  }, [insightsGenerationReady]);

  const stopInsightsPolling = useCallback(() => {
    if (insightsPollIntervalRef.current) {
      clearInterval(insightsPollIntervalRef.current);
      insightsPollIntervalRef.current = null;
    }
  }, []);

  const pollSessionForInsights = useCallback(
    async (targetContactId: string, startedAtIso: string) => {
      if (insightsGenerationReadyRef.current) return;

      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) return;

      try {
        const res = await fetch(
          `/api/coach/contacts/${encodeURIComponent(targetContactId)}/session`,
          { headers: authHeaders(accessToken, impersonatingCoachId) }
        );
        const json = (await res.json().catch(() => ({}))) as {
          contact?: {
            session_insights?: unknown;
            session_insights_generated_at?: string | null;
          };
        };
        const generatedAt = json.contact?.session_insights_generated_at;
        const polledInsights = readStoredInsights(json.contact?.session_insights);
        if (
          generatedAt &&
          generatedAt > startedAtIso &&
          polledInsights
        ) {
          setSessionInsights(polledInsights);
          setInsightsGenerationReady(true);
          stopInsightsPolling();
        }
      } catch {
        // ignore poll errors — generate request is the primary path
      }
    },
    [impersonatingCoachId, stopInsightsPolling]
  );

  const generateSessionInsights = useCallback(
    async (
      targetContactId: string,
      answers: Record<string, 0 | 1 | 2>,
      token?: string,
      options?: { background?: boolean }
    ) => {
      if (Object.keys(answers).length === 0) return;

      const foreground = !options?.background;

      if (foreground) {
        setInsightsGenerating(true);
        setInsightsGenerationReady(false);
        setInsightsGenerationError(null);
      }

      try {
        const accessToken =
          token ??
          (await supabaseClient.auth.getSession()).data.session?.access_token;
        if (!accessToken) {
          if (foreground) {
            setInsightsGenerationError("Not signed in.");
            stopInsightsPolling();
          }
          return;
        }

        const res = await fetch(
          `/api/coach/contacts/${encodeURIComponent(targetContactId)}/insights/generate`,
          {
            method: "POST",
            headers: {
              ...authHeaders(accessToken, impersonatingCoachId),
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ answers }),
          }
        );
        const json = (await res.json().catch(() => ({}))) as {
          insights?: StoredInsights;
          error?: string;
        };
        if (res.ok && json.insights) {
          setSessionInsights(json.insights);
          if (foreground) {
            setInsightsGenerationReady(true);
            stopInsightsPolling();
          }
        } else if (foreground) {
          setInsightsGenerationError(json.error ?? "Failed to generate insights.");
          stopInsightsPolling();
        }
      } catch {
        if (foreground) {
          setInsightsGenerationError("Something went wrong while generating insights.");
          stopInsightsPolling();
        }
      }
    },
    [impersonatingCoachId, stopInsightsPolling]
  );

  const scheduleInsightsRegenerate = useCallback(
    (answers: Record<string, 0 | 1 | 2>) => {
      const targetId = contactId ?? draftContactIdRef.current;
      if (!targetId || Object.keys(answers).length === 0) return;

      if (insightsDebounceRef.current) {
        clearTimeout(insightsDebounceRef.current);
      }
      insightsDebounceRef.current = setTimeout(() => {
        insightsDebounceRef.current = null;
        void generateSessionInsights(targetId, answers, undefined, { background: true });
      }, INSIGHTS_DEBOUNCE_MS);
    },
    [contactId, generateSessionInsights]
  );

  const handleInsightsGenerationFinished = useCallback(() => {
    stopInsightsPolling();
    setInsightsGenerating(false);
    setInsightsGenerationReady(false);
    setInsightsGenerationError(null);
    insightsGenerationStartedAtRef.current = null;
  }, [stopInsightsPolling]);

  const handleRefreshInsights = useCallback(() => {
    const targetId = contactId ?? draftContactIdRef.current;
    if (!targetId || Object.keys(matrixAnswers).length === 0) return;

    const startedAt = new Date().toISOString();
    insightsGenerationStartedAtRef.current = startedAt;
    stopInsightsPolling();

    insightsPollIntervalRef.current = setInterval(() => {
      void pollSessionForInsights(targetId, startedAt);
    }, 5000);

    void generateSessionInsights(targetId, matrixAnswers);
  }, [
    contactId,
    matrixAnswers,
    generateSessionInsights,
    pollSessionForInsights,
    stopInsightsPolling,
  ]);

  useEffect(() => {
    return () => {
      stopInsightsPolling();
    };
  }, [stopInsightsPolling]);

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
          session_insights?: unknown;
          session_insights_generated_at?: string | null;
        };
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

      setContact({
        id: json.contact.id,
        full_name: json.contact.full_name,
        email: json.contact.email ?? null,
        business_name: json.contact.business_name ?? null,
      });

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
      setSessionInsights(readStoredInsights(json.contact.session_insights));

      const loadedSession = json.session;
      const loadedAnswers = loadedSession?.answers
        ? (loadedSession.answers as Record<string, 0 | 1 | 2>)
        : {};
      if (loadedSession?.answers) {
        setMatrixAnswers(loadedAnswers);
      } else {
        setMatrixAnswers({});
      }

      const hasAnswers = Object.keys(loadedAnswers).length > 0;
      const loadedInsights = readStoredInsights(json.contact.session_insights);
      const generatedAt = json.contact.session_insights_generated_at
        ? new Date(json.contact.session_insights_generated_at).getTime()
        : 0;
      const insightsStale = Date.now() - generatedAt > INSIGHTS_STALE_MS;

      if (hasAnswers && contactId && (!loadedInsights || insightsStale)) {
        void generateSessionInsights(contactId, loadedAnswers, session.access_token, {
          background: true,
        });
      }

      setLoading(false);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [contactId, router, impersonatingCoachId, generateSessionInsights]);

  const persistSession = useCallback(
    async (body: {
      answers?: Record<string, 0 | 1 | 2>;
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
        session?: WorkshopSessionScores | null;
      };

      if (!res.ok) {
        setSessionError(json.error ?? "Could not save.");
        if (savingScores) setScoresSaveState("error");
        return;
      }

      if (json.session?.answers) {
        setMatrixAnswers(json.session.answers);
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
      if (playbookNotesDebounceRef.current) {
        clearTimeout(playbookNotesDebounceRef.current);
      }
      if (insightsDebounceRef.current) {
        clearTimeout(insightsDebounceRef.current);
      }
      flushPendingAnswers();
      flushPendingPlaybookNotes();
    };
  }, [flushPendingAnswers, flushPendingPlaybookNotes]);

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
        scheduleInsightsRegenerate(next);
        return next;
      });
      if (answersDebounceRef.current) clearTimeout(answersDebounceRef.current);
      answersDebounceRef.current = setTimeout(() => {
        answersDebounceRef.current = null;
        flushPendingAnswers();
      }, ANSWERS_DEBOUNCE_MS);
    },
    [flushPendingAnswers, scheduleInsightsRegenerate]
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

  const handleProspectMatrixPlaybookClick = useCallback((ref: string) => {
    openPlaybookSheetRef.current?.(ref);
  }, []);

  const areaScores = computeAreaScores(matrixAnswers);
  const liveTotal = getTotalScore(matrixAnswers);
  const hasPremiumScores = Object.keys(matrixAnswers).length > 0;
  const displayPremiumTotal = hasPremiumScores ? liveTotal : null;
  const pillarDialStats = useMemo(() => computeBossPillarDialStats(matrixAnswers), [matrixAnswers]);
  const answerMix = useMemo(() => computeScoreBreakdown(matrixAnswers), [matrixAnswers]);
  const scoreMixCategories = useMemo(
    () => computeWorkshopScoreMixCategories(matrixAnswers),
    [matrixAnswers]
  );
  const prospectBreakdown = useMemo(
    () => computeProspectDimensionBreakdown(playbookNotes),
    [playbookNotes]
  );
  const showCharts = !workshopMode && hasPremiumScores;

  const playbookBase = contactId
    ? `/coach/contacts/${contactId}/playbooks`
    : undefined;

  const scratchNoSave = !contactId && !pendingNewContact;
  const sessionGateActive = scratchNoSave;
  const canSavePlaybookNotes = Boolean(contactId || pendingNewContact);

  useEffect(() => {
    const el = ownerLevelsCardRef.current;
    if (!el) return;

    const syncWheelCardHeight = () => {
      const isSideBySide = window.matchMedia("(min-width: 1024px)").matches;
      setOwnerLevelsCardHeight(isSideBySide ? el.offsetHeight : null);
    };

    syncWheelCardHeight();
    const observer = new ResizeObserver(syncWheelCardHeight);
    observer.observe(el);
    window.addEventListener("resize", syncWheelCardHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncWheelCardHeight);
    };
  }, [matrixAnswers, loading, error]);

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

      {!loading && !error && (
        <>
          <BossScoreDialStrip totalScore={displayPremiumTotal} pillarStats={pillarDialStats} />

          {showCharts && (
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
              <h2 className="mb-5 text-base font-semibold text-slate-900">Charts</h2>
              <div className="grid gap-8 md:grid-cols-2">
                <div className="flex justify-center">
                  <BossDoughnut scores={matrixAnswers} />
                </div>
                <div>
                  <FocusAreas scores={matrixAnswers} variant="full" />
                </div>
              </div>
            </section>
          )}

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
                playbookReturnTo={playbookReturnTo}
                scoreBarLabels="neutral"
                playbookNotes={canSavePlaybookNotes ? playbookNotes : undefined}
                clientName={contact?.full_name}
                onPlaybookNotesChange={
                  workshopMode && canSavePlaybookNotes && !sessionGateActive
                    ? handlePlaybookNotesChange
                    : undefined
                }
                onRegisterOpenPlaybookSheet={(open) => {
                  openPlaybookSheetRef.current = open;
                }}
              />
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            <section
              ref={ownerLevelsCardRef}
              className={`${WORKSHOP_CARD_SHELL} flex flex-col`}
            >
              <div className={WORKSHOP_CARD_HEADER}>Owner level completeness</div>
              <div className="px-6 py-8 sm:px-8 sm:py-9">
                <WorkshopOwnerLevelBars answers={matrixAnswers} />
              </div>
            </section>

            <section
              className={`${WORKSHOP_CARD_SHELL} flex min-h-0 flex-col overflow-hidden max-lg:h-auto`}
              style={
                ownerLevelsCardHeight != null ? { height: ownerLevelsCardHeight } : undefined
              }
            >
              <div className={WORKSHOP_CARD_HEADER}>BOSS wheel</div>
              <div className="flex min-h-0 flex-1 items-center justify-center p-4 sm:p-5">
                <div className="aspect-square h-auto max-h-full w-full max-w-full">
                  <BossWheel
                    size="workshop"
                    areaScores={areaScores}
                    totalScore={displayPremiumTotal ?? undefined}
                    answers={matrixAnswers}
                    colorScheme={wheelColorScheme}
                    viewMode={wheelViewMode}
                    showLegend={false}
                    scorePlacement="wheel-lower-left"
                    aria-label="BOSS area scores wheel"
                  />
                </div>
              </div>
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            <BossAnswerMixBar
              className="mx-0 max-w-none w-full"
              onTrack={answerMix.green}
              building={answerMix.amber}
              needsAttention={answerMix.red}
              notAnswered={answerMix.unanswered}
              scoreMixCategories={scoreMixCategories}
              prospectBreakdown={prospectBreakdown}
              onPlaybookClick={
                !sessionGateActive ? handleProspectMatrixPlaybookClick : undefined
              }
            />

            {contactId ? (
              <section className={WORKSHOP_CARD_SHELL}>
                <div className={`${WORKSHOP_CARD_HEADER} flex items-center justify-between gap-3`}>
                  <span>Insights</span>
                  <button
                    type="button"
                    onClick={handleRefreshInsights}
                    disabled={insightsGenerating}
                    aria-label={insightsGenerating ? "Refreshing insights" : "Refresh insights"}
                    title={insightsGenerating ? "Refreshing…" : "Refresh insights"}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/75 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${insightsGenerating ? "animate-spin" : ""}`}
                      strokeWidth={2.25}
                      aria-hidden
                    />
                  </button>
                </div>
                <div className="px-6 pb-8 pt-3.5 sm:px-8 sm:pb-9 sm:pt-4">
                  <WorkshopInsightReader
                    answers={matrixAnswers}
                    totalScore={displayPremiumTotal ?? liveTotal}
                    insights={sessionInsights}
                    insightsGenerating={insightsGenerating}
                    insightsGenerationReady={insightsGenerationReady}
                    insightsGenerationError={insightsGenerationError}
                    onInsightsGenerationFinished={handleInsightsGenerationFinished}
                    playbookNotes={playbookNotes}
                    onPlaybookClick={
                      !sessionGateActive ? handleProspectMatrixPlaybookClick : undefined
                    }
                  />
                </div>
              </section>
            ) : null}
          </div>

          {showProspectMatrix ? (
            <WorkshopProspectMatrix
              playbookNotes={playbookNotes}
              clientName={contact?.full_name}
              onPlaybookClick={
                workshopMode && !sessionGateActive ? handleProspectMatrixPlaybookClick : undefined
              }
            />
          ) : null}
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

  return (
    <>
      {inner}
      {scoresSavedToast}
    </>
  );
}
