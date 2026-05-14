"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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

async function createWorkshopDraftContact(
  token: string,
  impersonatingCoachId: string | null
): Promise<string> {
  const headers: Record<string, string> = {
    ...authHeaders(token, impersonatingCoachId),
    "Content-Type": "application/json",
  };
  const res = await fetch("/api/coach/contacts", {
    method: "POST",
    headers,
    body: JSON.stringify({
      fullName: `Workshop — ${new Date().toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })}`,
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
  /** Called after a draft workshop contact is created so the parent can sync selection / URL. */
  onDraftContactCreated?: (id: string) => void;
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
  /** When false, omits the inline “Live scoring session” checkbox (parent renders it). Default true. */
  showLiveScoringCheckbox?: boolean;
};

export function ContactBossWorkshopBody({
  contactId,
  draftCoachId = null,
  onDraftContactCreated,
  variant = "page",
  headerLeading,
  showPillarNotes = true,
  workshopMode: workshopModeProp,
  onWorkshopModeChange,
  showLiveScoringCheckbox = true,
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
  const [internalWorkshopMode, setInternalWorkshopMode] = useState(true);
  const workshopModeControlled =
    typeof workshopModeProp === "boolean" && typeof onWorkshopModeChange === "function";
  const workshopMode = workshopModeControlled ? workshopModeProp : internalWorkshopMode;
  const setWorkshopMode = workshopModeControlled ? onWorkshopModeChange! : setInternalWorkshopMode;
  const [sessionError, setSessionError] = useState<string | null>(null);

  const draftContactIdRef = useRef<string | null>(null);

  const answersDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAnswersRef = useRef<Record<string, 0 | 1 | 2> | null>(null);
  const pendingNotesRef = useRef<Partial<Record<string, string>> | null>(null);

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
        };
        assessment?: Assessment | null;
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
    }) => {
      setSessionError(null);
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setSessionError("Not signed in.");
        return;
      }

      let targetId = contactId ?? draftContactIdRef.current;
      if (!targetId) {
        if (!draftCoachId) {
          setSessionError("Select a contact to save.");
          return;
        }
        try {
          const created = await createWorkshopDraftContact(
            token,
            impersonatingCoachId
          );
          draftContactIdRef.current = created;
          targetId = created;
          onDraftContactCreated?.(created);
        } catch (e) {
          setSessionError(e instanceof Error ? e.message : "Could not create contact.");
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
      };

      if (!res.ok) {
        setSessionError(json.error ?? "Could not save.");
        return;
      }

      if (json.assessment) {
        setAssessment(json.assessment);
        setMatrixAnswers(json.assessment.answers ?? {});
      }
    },
    [contactId, draftCoachId, impersonatingCoachId, onDraftContactCreated]
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

  useEffect(() => {
    return () => {
      if (answersDebounceRef.current) clearTimeout(answersDebounceRef.current);
      if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current);
      flushPendingAnswers();
      flushPendingNotes();
    };
  }, [flushPendingAnswers, flushPendingNotes]);

  const handleScoreChange = useCallback(
    (ref: string, score: 0 | 1 | 2) => {
      setMatrixAnswers((prev) => {
        const next = { ...prev, [ref]: score };
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

  const areaScores = computeAreaScores(matrixAnswers);
  const liveTotal = getTotalScore(matrixAnswers);
  const pillarDialStats = useMemo(() => computeBossPillarDialStats(matrixAnswers), [matrixAnswers]);
  const answerMix = useMemo(() => computeScoreBreakdown(matrixAnswers), [matrixAnswers]);
  const showCharts = !workshopMode && (assessment != null || liveTotal > 0);

  const playbookBase = contactId
    ? `/coach/contacts/${contactId}/playbooks`
    : undefined;

  const scratchNoSave = !contactId && !draftCoachId;

  useEffect(() => {
    if (variant !== "page") return;
    const prev = document.title;
    document.title = contact ? `BOSS score — ${contact.full_name}` : "BOSS score";
    return () => {
      document.title = prev;
    };
  }, [variant, contact?.full_name]);

  const noAssessmentBanner =
    !loading && !error && !assessment ? (
      !contactId && draftCoachId ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
          {showPillarNotes ? (
            <>
              No contact selected yet — the matrix is ready. When you change a cell or pillar notes,
              we create a prospect for this coach and save there.
            </>
          ) : (
            <>
              No contact selected yet — the matrix is ready. When you change a cell, we create a
              prospect for this coach and save there.
            </>
          )}
        </p>
      ) : contactId ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
          No assessment row yet. Start scoring in <strong>Live scoring session</strong> — we will
          create one when you first mark a cell.
        </p>
      ) : null
    ) : null;

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

      {!loading && !error && noAssessmentBanner}

      {showCharts && (
        <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-base font-semibold text-slate-900">Charts</h2>
          <div className="grid gap-8 md:grid-cols-3">
            <div className="flex justify-center">
              <BossWheel
                areaScores={areaScores}
                totalScore={assessment?.total_score ?? liveTotal}
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
        <section className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50/80 p-5 shadow-sm sm:p-6">
          <BossScoreDialStrip totalScore={liveTotal} pillarStats={pillarDialStats} className="mb-6" />
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
            <div className="min-w-0 flex-1">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Answer mix</h3>
              <BossAnswerMixBar
                onTrack={answerMix.green}
                building={answerMix.amber}
                needsAttention={answerMix.red}
                notAnswered={answerMix.unanswered}
              />
            </div>
            {showLiveScoringCheckbox ? (
              <label className="flex shrink-0 cursor-pointer items-center gap-2 self-start text-sm font-medium text-slate-700 sm:self-end">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  checked={workshopMode}
                  onChange={(e) => setWorkshopMode(e.target.checked)}
                />
                Live scoring session
              </label>
            ) : null}
          </div>
          <BossGridTransposed
            answers={matrixAnswers}
            glass
            glassTheme="light"
            glassAlwaysShowPlaybookNames
            hideGlassScoreBar
            interactive={workshopMode && !scratchNoSave}
            onScoreChange={handleScoreChange}
            playbookLinkBase={playbookBase}
            scoreBarLabels="neutral"
            onTooltipAddNotes={
              showPillarNotes
                ? (_ref: string) => {
                    document
                      .getElementById("boss-pillar-session-notes")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                : undefined
            }
          />
        </section>
      )}
    </div>
  );

  if (variant === "embedded") {
    return inner;
  }

  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader
        leading={headerLeading}
        title="BOSS score"
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
    </div>
  );
}
