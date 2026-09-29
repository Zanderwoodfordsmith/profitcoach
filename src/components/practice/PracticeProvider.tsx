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

import { readyForRecommendation } from "@/lib/practiceKnowledge/brief";
import { mergePracticePayload, sourced } from "@/lib/practiceKnowledge/sourced";
import {
  generatePracticeReport,
  loadInterview,
  loadPractice,
  practiceHeaders,
  savePractice,
  seedPracticeLinkedIn,
  sendInterviewTurn,
  speakInterviewText,
  ttsAvailable,
  uploadPracticeAsset,
} from "@/lib/practiceKnowledge/practiceApi";
import type {
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
};

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

export function PracticeProvider({
  children,
  coachId = null,
  basePath = PRACTICE_BASE,
}: {
  children: ReactNode;
  /** Admin preview: act as this coach instead of the signed-in one. */
  coachId?: string | null;
  basePath?: string;
}) {
  const [knowledge, setKnowledge] = useState<PracticeKnowledgeRow | null>(null);
  const [draft, setDraft] = useState<PracticeKnowledgePayload | null>(null);
  const [assets, setAssets] = useState<Array<IntakeAssetRow & { signed_url?: string | null }>>([]);
  const [session, setSession] = useState<IntakeSessionRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ttsOn, setTtsOn] = useState(false);
  const [loading, setLoading] = useState(true);
  const reportAttempted = useRef(false);
  const draftRef = useRef<PracticeKnowledgePayload | null>(null);
  const persistGen = useRef(0);

  const payload = draft ?? knowledge?.payload ?? null;
  draftRef.current = payload;

  const load = useCallback(async () => {
    setError(null);
    const res = await loadPractice(coachId);
    if (!res.ok || !res.data) {
      setError(res.error || "Could not load your practice blueprint.");
      setLoading(false);
      return;
    }
    setKnowledge(res.data.knowledge);
    setDraft(res.data.knowledge.payload);
    setAssets(res.data.assets);
    const interview = await loadInterview(coachId);
    if (interview.ok && interview.data?.session) setSession(interview.data.session);
    setLoading(false);
  }, [coachId]);

  useEffect(() => {
    void load();
    void ttsAvailable(coachId).then(setTtsOn);
  }, [load, coachId]);

  const persist = useCallback(async (next: PracticeKnowledgePayload) => {
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
  }, [coachId]);

  useEffect(() => {
    if (!payload || !knowledge || knowledge.report_payload || reportAttempted.current) return;
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
  }, [payload, knowledge, coachId]);

  async function handleInterview(start: boolean, message?: string) {
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
    href: (path) =>
      path === PRACTICE_BASE || path.startsWith(`${PRACTICE_BASE}/`) || path.startsWith(`${PRACTICE_BASE}#`)
        ? `${basePath}${path.slice(PRACTICE_BASE.length)}`
        : path,
    pullLinkedIn: () => {
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
