"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { buildOrder, type FieldSpec } from "@/lib/practiceKnowledge/blueprint";
import type { BuildJob } from "@/lib/practiceKnowledge/buildJobs";
import { readyForRecommendation } from "@/lib/practiceKnowledge/brief";
import { emptyPracticePayload, mergePracticePayload, sourced } from "@/lib/practiceKnowledge/sourced";
import {
  cancelPracticeBuild,
  loadPracticeBuild,
  saveBuiltBlocks,
  sendBlueprintCampaign,
  generatePracticeReport,
  loadInterview,
  loadPractice,
  practiceHeaders,
  savePractice,
  seedPracticeLinkedIn,
  sendInterviewTurn,
  speakInterviewText,
  startPracticeBuild,
  ttsAvailable,
  uploadPracticeAsset,
} from "@/lib/practiceKnowledge/practiceApi";
import type {
  BlueprintBlock,
  DecisionRecordPayload,
  DecisionRecordRow,
  IntakeAssetRow,
  IntakeSessionRow,
  PracticeKnowledgePayload,
  PracticeKnowledgeRow,
} from "@/lib/practiceKnowledge/types";

type PracticeContextValue = {
  loading: boolean;
  busy: boolean;
  error: string | null;
  ttsOn: boolean;
  knowledge: PracticeKnowledgeRow | null;
  payload: PracticeKnowledgePayload | null;
  assets: Array<IntakeAssetRow & { signed_url?: string | null }>;
  session: IntakeSessionRow | null;
  patch: (patch: Partial<PracticeKnowledgePayload>) => void;
  setComments: (value: string) => void;
  commit: () => void;
  start: () => void;
  reply: (text: string) => void;
  speak: (text: string) => void;
  transcribe: (blob: Blob) => Promise<string | null>;
  pullLinkedIn: () => void;
  upload: (file: File) => void;
  approvePage: (slug: string) => void;
  approveSection: (key: string) => void;
  addNote: (body: string, page: string) => void;
  /** Maps a /coach/practice href onto wherever these pages are mounted. */
  href: (path: string) => string;
  /** Keep the window where it is when moving between blueprint pages. */
  stayOnPage: boolean;
  coachName: string;
  /** Sections being written right now, and progress for "write everything". */
  building: BuildState;
  build: (key: string) => void;
  buildAll: (opts?: { onlyMissing?: boolean }) => void;
  stopBuild: () => void;
  saveField: (field: FieldSpec, value: unknown) => void;
  sendCampaign: (variant: "connector" | "conversation") => Promise<{ campaignId?: string; error?: string }>;
  /** Replace the body of one message block in a written section. */
  editMessage: (key: string, index: number, body: string) => Promise<boolean>;
  /** Replace every block of a written section with an edited copy. */
  saveBlocks: (key: string, blocks: BlueprintBlock[]) => Promise<boolean>;
  /** The Decision Record from the Decision Call, once one is saved. */
  decision: DecisionRecordRow | null;
  /** Admins can fill in and lock the Decision Record on the page. */
  canEditDecision: boolean;
  saveDecision: (payload: DecisionRecordPayload, lock: boolean) => Promise<boolean>;
  /** An empty blueprint to look at. Nothing is saved or written. */
  sample: boolean;
  /** Right-hand assistant panel. */
  assistantOpen: boolean;
  setAssistantOpen: (open: boolean) => void;
};

export type BuildState = {
  active: string[];
  queue: string[];
  done: number;
  total: number;
  failed: string[];
};

const IDLE_BUILD: BuildState = { active: [], queue: [], done: 0, total: 0, failed: [] };
/** How often the page checks on a blueprint being written on the server. */
const BUILD_POLL_MS = 4000;

function jobOpen(job: BuildJob | null): boolean {
  return Boolean(job && (job.status === "queued" || job.status === "running"));
}

/** The server job as the page shows it. */
function buildStateFromJob(job: BuildJob): BuildState {
  const failed = job.failed.map((f) => f.key);
  const finished = new Set([...job.done, ...failed]);
  const left = job.keys.filter((key) => !finished.has(key));
  const open = jobOpen(job);
  const active = open ? [job.current_key ?? left[0]].filter((k): k is string => Boolean(k)) : [];
  return {
    active,
    queue: open ? left.filter((key) => !active.includes(key)) : [],
    done: job.done.length + failed.length,
    total: job.keys.length,
    failed,
  };
}
const ASSISTANT_KEY = "practice-assistant-open";

export const PRACTICE_BASE = "/coach/practice";

const PracticeContext = createContext<PracticeContextValue | null>(null);

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** A blank practice record for the empty preview. */
function emptyRow(): PracticeKnowledgeRow {
  const now = new Date().toISOString();
  return {
    coach_id: "sample",
    status: "capturing",
    payload: emptyPracticePayload(),
    linkedin_seeded_at: null,
    form_completed_at: null,
    interview_completed_at: null,
    coach_reviewed_at: null,
    admin_reviewed_at: null,
    completeness_score: 0,
    missing_fields: [],
    report_payload: null,
    report_generated_at: null,
    built_sections: {},
    created_at: now,
    updated_at: now,
  };
}

function isPracticePath(path: string) {
  return (
    path === PRACTICE_BASE ||
    path.startsWith(`${PRACTICE_BASE}/`) ||
    path.startsWith(`${PRACTICE_BASE}#`)
  );
}

export function PracticeProvider({
  children,
  coachId = null,
  basePath = PRACTICE_BASE,
  toHref,
  stayOnPage = false,
  sample = false,
}: {
  children: ReactNode;
  /** Admin preview: act as this coach instead of the signed-in one. */
  coachId?: string | null;
  basePath?: string;
  /** Replace the default basePath rewrite for practice links. */
  toHref?: (practicePath: string) => string;
  /** Profile embed: blueprint links stay on this page. */
  stayOnPage?: boolean;
  /** Show an empty blueprint. Edits stay on screen and nothing is saved or written. */
  sample?: boolean;
}) {
  const [knowledge, setKnowledge] = useState<PracticeKnowledgeRow | null>(null);
  const [draft, setDraft] = useState<PracticeKnowledgePayload | null>(null);
  const [assets, setAssets] = useState<Array<IntakeAssetRow & { signed_url?: string | null }>>([]);
  const [session, setSession] = useState<IntakeSessionRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ttsOn, setTtsOn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [coachName, setCoachName] = useState("");
  const [decision, setDecision] = useState<DecisionRecordRow | null>(null);
  const [building, setBuilding] = useState<BuildState>(IDLE_BUILD);
  /** The server job this page is following, while it is open. */
  const [jobId, setJobId] = useState<string | null>(null);
  const seenDone = useRef(0);
  const [assistantOpen, setAssistantOpenState] = useState(false);
  const reportAttempted = useRef(false);
  const draftRef = useRef<PracticeKnowledgePayload | null>(null);
  const persistGen = useRef(0);

  const payload = draft ?? knowledge?.payload ?? null;
  draftRef.current = payload;

  const load = useCallback(async () => {
    setError(null);
    if (sample) {
      const row = emptyRow();
      setKnowledge(row);
      setDraft(row.payload);
      setCoachName("New coach");
      setLoading(false);
      return;
    }
    const res = await loadPractice(coachId);
    if (!res.ok || !res.data) {
      setError(res.error || "Could not load your practice blueprint.");
      setLoading(false);
      return;
    }
    setKnowledge(res.data.knowledge);
    setDraft(res.data.knowledge.payload);
    setAssets(res.data.assets);
    setCoachName(res.data.coach_name ?? "");
    setDecision(res.data.decision ?? null);
    const interview = await loadInterview(coachId);
    if (interview.ok && interview.data?.session) setSession(interview.data.session);
    setLoading(false);
  }, [coachId, sample]);

  useEffect(() => {
    void load();
    if (!sample) void ttsAvailable(coachId).then(setTtsOn);
  }, [load, coachId, sample]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(ASSISTANT_KEY);
      // Open by default on wide screens the first time.
      setAssistantOpenState(stored ? stored === "1" : window.innerWidth >= 1280);
    } catch {
      setAssistantOpenState(false);
    }
  }, []);

  function setAssistantOpen(open: boolean) {
    setAssistantOpenState(open);
    try {
      window.localStorage.setItem(ASSISTANT_KEY, open ? "1" : "0");
    } catch {
      // Remembering the panel is a convenience only.
    }
  }

  async function runBuilds(keys: string[]) {
    if (!keys.length) return;
    if (sample) {
      setError("This is an empty preview. Choose a coach to write sections.");
      return;
    }
    // Written on the server: the page can close and the writing carries on.
    const res = await startPracticeBuild(keys, coachId);
    if (!res.ok || !res.data?.job) {
      setError(res.error || "Could not start writing. Try again.");
      return;
    }
    seenDone.current = 0;
    setBuilding(buildStateFromJob(res.data.job));
    setJobId(res.data.job.id);
  }

  const refreshKnowledge = useCallback(async () => {
    const res = await loadPractice(coachId);
    if (res.ok && res.data) setKnowledge(res.data.knowledge);
  }, [coachId]);

  // Follow a job started here, or one already running when the page opened.
  useEffect(() => {
    if (sample || !jobId) return;
    let cancelled = false;
    const tick = async () => {
      const res = await loadPracticeBuild(coachId);
      if (cancelled || !res.ok) return;
      const job = res.data?.job ?? null;
      if (!job || job.id !== jobId) {
        setJobId(null);
        setBuilding(IDLE_BUILD);
        return;
      }
      setBuilding(buildStateFromJob(job));
      if (job.done.length !== seenDone.current) {
        seenDone.current = job.done.length;
        await refreshKnowledge();
      }
      if (!jobOpen(job)) {
        setJobId(null);
        if (job.failed.length) setError("Some sections could not be written. Try them again.");
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), BUILD_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [jobId, coachId, sample, refreshKnowledge]);

  useEffect(() => {
    if (sample) return;
    let cancelled = false;
    void loadPracticeBuild(coachId).then((res) => {
      const job = res.ok ? (res.data?.job ?? null) : null;
      if (cancelled || !job || !jobOpen(job)) return;
      seenDone.current = job.done.length;
      setBuilding(buildStateFromJob(job));
      setJobId(job.id);
    });
    return () => {
      cancelled = true;
    };
  }, [coachId, sample]);

  const persist = useCallback(async (next: PracticeKnowledgePayload) => {
    // The empty preview keeps edits on screen only.
    if (sample) return;
    const gen = ++persistGen.current;
    const res = await savePractice({ payload: next }, coachId);
    if (gen !== persistGen.current) return;
    if (!res.ok || !res.data) {
      setError(res.error || "Could not save.");
      return;
    }
    setKnowledge(res.data.knowledge);
    setDraft(res.data.knowledge.payload);
    draftRef.current = res.data.knowledge.payload;
  }, [coachId, sample]);

  useEffect(() => {
    if (sample || !payload || !knowledge || knowledge.report_payload || reportAttempted.current) return;
    if (!readyForRecommendation(payload)) return;
    reportAttempted.current = true;
    void (async () => {
      setBusy(true);
      const res = await generatePracticeReport(coachId);
      setBusy(false);
      if (res.ok && res.data) {
        setKnowledge(res.data.knowledge);
        setDraft(res.data.knowledge.payload);
      }
    })();
  }, [payload, knowledge, coachId, sample]);

  async function handleInterview(start: boolean, message?: string) {
    if (sample) {
      setError("This is an empty preview. Choose a coach to try the conversation.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await sendInterviewTurn(start ? { start: true } : { message }, coachId);
    setBusy(false);
    if (!res.ok || !res.data) {
      setError(res.error || "The conversation could not continue.");
      return;
    }
    setKnowledge(res.data.knowledge);
    setDraft(res.data.knowledge.payload);
    setSession(res.data.session);
    if (ttsOn && res.data.assistant_message) {
      void speakInterviewText(res.data.assistant_message, coachId).then(async (blob) => {
        if (!blob) return;
        void new Audio(URL.createObjectURL(blob)).play().catch(() => {});
      });
    }
  }

  async function transcribe(blob: Blob): Promise<string | null> {
    const headers = await practiceHeaders(coachId);
    if (!headers) return null;
    const audio_base64 = bufferToBase64(await blob.arrayBuffer());
    const res = await fetch("/api/coach/profit-coach-ai/transcribe", {
      method: "POST",
      headers,
      body: JSON.stringify({ audio_base64 }),
    });
    const data = (await res.json().catch(() => null)) as { text?: string } | null;
    return data?.text?.trim() || null;
  }

  async function saveBlocks(key: string, blocks: BlueprintBlock[]): Promise<boolean> {
    const built = knowledge?.built_sections[key];
    if (!built || !knowledge) return false;
    if (sample) {
      const at = new Date().toISOString();
      setKnowledge({ ...knowledge, built_sections: { ...knowledge.built_sections, [key]: { ...built, blocks, edited_at: at } } });
      return true;
    }
    const res = await saveBuiltBlocks(key, blocks, coachId);
    if (!res.ok || !res.data) {
      setError(res.error || "Could not save your edit.");
      return false;
    }
    setKnowledge(res.data.knowledge);
    return true;
  }

  const value: PracticeContextValue = {
    loading,
    busy,
    error,
    ttsOn,
    knowledge,
    payload,
    assets,
    session,
    patch: (patch) => {
      if (!payload) return;
      const next = mergePracticePayload(draftRef.current ?? payload, patch);
      draftRef.current = next;
      setDraft(next);
    },
    setComments: (comments) => {
      const base = draftRef.current;
      if (!base) return;
      const next = mergePracticePayload(base, {
        review: { ...base.review, report_comments: sourced(comments, "coach_edit") },
      });
      draftRef.current = next;
      setDraft(next);
    },
    approvePage: (slug) => {
      const base = draftRef.current;
      if (!base || !slug) return;
      const current = { ...(base.review.approved_pages?.value ?? {}) };
      if (current[slug]) delete current[slug];
      else current[slug] = new Date().toISOString();
      const next = mergePracticePayload(base, {
        review: { ...base.review, approved_pages: sourced(current, "coach_edit") },
      });
      draftRef.current = next;
      setDraft(next);
      void persist(next);
    },
    approveSection: (key) => {
      const base = draftRef.current;
      if (!base || !key) return;
      const current = { ...(base.review.approved_sections?.value ?? {}) };
      if (current[key]) delete current[key];
      else current[key] = new Date().toISOString();
      const next = mergePracticePayload(base, {
        review: { ...base.review, approved_sections: sourced(current, "coach_edit") },
      });
      draftRef.current = next;
      setDraft(next);
      void persist(next);
    },
    addNote: (body, page) => {
      const base = draftRef.current;
      const text = body.trim();
      if (!base || !text || !page) return;
      const notes = [...(base.review.notes?.value ?? [])];
      notes.push({
        id: crypto.randomUUID(),
        body: text,
        at: new Date().toISOString(),
        page,
      });
      const next = mergePracticePayload(base, {
        review: { ...base.review, notes: sourced(notes, "coach_edit") },
      });
      draftRef.current = next;
      setDraft(next);
      void persist(next);
    },
    commit: () => {
      if (draftRef.current) void persist(draftRef.current);
    },
    start: () => void handleInterview(true),
    reply: (text) => void handleInterview(false, text),
    speak: (text) => {
      void speakInterviewText(text, coachId).then(async (blob) => {
        if (!blob) return;
        void new Audio(URL.createObjectURL(blob)).play().catch(() => {});
      });
    },
    transcribe,
    coachName,
    building,
    build: (key) => {
      if (building.active.length) return;
      void runBuilds([key]);
    },
    buildAll: (opts) => {
      if (building.active.length) return;
      const built = knowledge?.built_sections ?? {};
      // "Rewrite everything" never overwrites a section the coach edited by hand.
      const keys = buildOrder().filter((k) => (opts?.onlyMissing ? !built[k] : !built[k]?.edited_at));
      void runBuilds(keys);
    },
    stopBuild: () => {
      void cancelPracticeBuild(coachId).then(() => {
        setJobId(null);
        setBuilding(IDLE_BUILD);
      });
    },
    saveField: (field, value) => {
      const base = draftRef.current;
      if (!base) return;
      const [group, key] = field.path.split(".") as [keyof PracticeKnowledgePayload, string];
      const next = mergePracticePayload(base, {
        [group]: { [key]: sourced(value, "coach_edit") },
      } as Partial<PracticeKnowledgePayload>);
      draftRef.current = next;
      setDraft(next);
      void persist(next);
    },
    editMessage: async (key, index, body) => {
      const built = knowledge?.built_sections[key];
      const block = built?.blocks[index];
      if (!built || !block || block.type !== "message") return false;
      return saveBlocks(
        key,
        built.blocks.map((b, i) => (i === index && b.type === "message" ? { ...b, body } : b))
      );
    },
    saveBlocks: (key, blocks) => saveBlocks(key, blocks),
    decision,
    canEditDecision: Boolean(coachId) && !sample,
    saveDecision: async (next, lock) => {
      const headers = await practiceHeaders(coachId);
      if (!headers || !coachId) return false;
      const res = await fetch(`/api/admin/practice/${coachId}/decision`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ payload: next, lock }),
      });
      const body = (await res.json().catch(() => null)) as { decision?: DecisionRecordRow; error?: string } | null;
      if (!res.ok || !body?.decision) {
        setError(body?.error || "Could not save the Decision Record.");
        return false;
      }
      setDecision(body.decision);
      return true;
    },
    sample,
    sendCampaign: async (variant) => {
      if (sample) return { error: "This is an empty preview." };
      const res = await sendBlueprintCampaign(variant, coachId);
      return res.ok && res.data ? { campaignId: res.data.campaign_id } : { error: res.error || "Could not create the campaign." };
    },
    assistantOpen,
    setAssistantOpen,
    stayOnPage,
    href: (path) => {
      if (!isPracticePath(path)) return path;
      if (toHref) return toHref(path);
      return `${basePath}${path.slice(PRACTICE_BASE.length)}`;
    },
    pullLinkedIn: () => {
      if (sample) return;
      setBusy(true);
      setError(null);
      void seedPracticeLinkedIn(coachId).then((res) => {
        setBusy(false);
        if (!res.ok || !res.data) {
          setError(res.error || "Could not pull LinkedIn.");
          return;
        }
        setKnowledge(res.data.knowledge);
        setDraft(res.data.knowledge.payload);
      });
    },
    upload: (file) => {
      if (sample) return;
      void uploadPracticeAsset(file, "other", coachId).then((res) => {
        if (!res.ok || !res.data) {
          setError(res.error || "Upload failed.");
          return;
        }
        setAssets((prev) => [res.data!.asset, ...prev]);
      });
    },
  };

  return <PracticeContext.Provider value={value}>{children}</PracticeContext.Provider>;
}

export function usePractice(): PracticeContextValue {
  const value = useContext(PracticeContext);
  if (!value) throw new Error("usePractice must be used inside PracticeProvider");
  return value;
}
