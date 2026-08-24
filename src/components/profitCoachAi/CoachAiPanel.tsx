"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUp,
  Brain,
  Check,
  History,
  Loader2,
  Maximize2,
  Mic,
  Minimize2,
  Plus,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";

import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import {
  getDefaultOutputId,
  getOutputById,
  PROFIT_COACH_OUTPUTS,
} from "@/lib/profitCoachAi/registry";
import {
  deriveAiScreenContext,
  screenContextForApi,
} from "@/lib/profitCoachAi/screenContext";
import type { CoachAiContext } from "@/lib/profitCoachAi/types";
import {
  PageHeaderUnderlineTabs,
  StickyPageHeader,
} from "@/components/layout";
import { ProfitCoachAiBrainForm } from "./ProfitCoachAiBrainForm";
import { ProfitCoachAiMarkdown } from "./ProfitCoachAiMarkdown";
import { StudioHubOverview } from "./StudioHubOverview";

export { COACH_AI_PANEL_WIDTH_REM } from "@/lib/profitCoachAi/panelLayout";

type PanelMessage = { role: "user" | "assistant"; content: string };

type ChatListRow = {
  id: string;
  title: string | null;
  last_output_id: string | null;
  updated_at: string;
};

function formatChatRelativeTime(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** Chunked to avoid blowing the call stack on multi-MB recordings. */
function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Hard stop so a forgotten open mic can't record forever. */
const MAX_RECORDING_MS = 180_000;

/** Live level meter: how many bars, sampled how often (~6s of history). */
const LEVEL_BARS = 48;
const LEVEL_SAMPLE_MS = 120;

/** Composer grows with content (ClickUp-style) before scrolling inside the box. */
const COMPOSER_MIN_PX = 40;
const COMPOSER_MAX_DOCKED_PX = 448; // 28rem
const COMPOSER_MAX_FULLSCREEN_PX = 576; // 36rem

/** Popular skills for the fullscreen empty-state chip row. */
const CHAT_STARTER_SKILL_IDS = [
  "linkedin_connector",
  "linkedin_newsletter",
  "vip_nurture",
  "content_planning",
] as const;

function formatRecordingClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function fitComposerTextarea(
  el: HTMLTextAreaElement | null,
  fullscreen: boolean
) {
  if (!el) return;
  const maxPx = Math.min(
    fullscreen ? COMPOSER_MAX_FULLSCREEN_PX : COMPOSER_MAX_DOCKED_PX,
    fullscreen
      ? window.innerHeight * 0.65
      : window.innerHeight * 0.55
  );
  el.style.height = "0px";
  const next = Math.max(COMPOSER_MIN_PX, Math.min(el.scrollHeight, maxPx));
  el.style.height = `${next}px`;
  el.style.overflowY = el.scrollHeight > maxPx ? "auto" : "hidden";
}

type CoachAiPanelProps = {
  onClose: () => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  createHubHref: string;
  /** When expanded, panel fills the main column — sidebar stays visible. */
  sidebarVisible?: boolean;
};

export function CoachAiPanel({
  onClose,
  fullscreen,
  onToggleFullscreen,
  createHubHref,
  sidebarVisible = true,
}: CoachAiPanelProps) {
  const pathname = usePathname();
  const { impersonatingCoachId } = useImpersonation();
  const screen = useMemo(() => deriveAiScreenContext(pathname), [pathname]);

  const [messages, setMessages] = useState<PanelMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [outputId, setOutputId] = useState<string>(
    () => screen.suggestedOutputId ?? getDefaultOutputId()
  );
  /** True until the coach manually picks a skill or sends a message. */
  const followRouteRef = useRef(true);

  /** "brain" = editable what-the-AI-knows view; "history" = saved chats. */
  const [view, setView] = useState<"chat" | "brain" | "history" | "create">(
    "chat"
  );
  const [brainContext, setBrainContext] = useState<CoachAiContext | null>(null);
  const [brainLoading, setBrainLoading] = useState(false);
  const [brainLoadError, setBrainLoadError] = useState<string | null>(null);
  const [brainSaving, setBrainSaving] = useState(false);
  const [brainSaveError, setBrainSaveError] = useState<string | null>(null);
  const [brainSavedOk, setBrainSavedOk] = useState(false);

  const [chats, setChats] = useState<ChatListRow[] | null>(null);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [chatsError, setChatsError] = useState<string | null>(null);
  const [openingChatId, setOpeningChatId] = useState<string | null>(null);

  const compassHref = pathname?.startsWith("/admin")
    ? "/admin/signature"
    : "/coach/signature";
  const isAdminSurface = pathname.startsWith("/admin");
  const aiSkillsAdminHref = "/admin/brand?tab=brain&brainTab=skills";

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Follow the route's suggested skill until the conversation starts.
  useEffect(() => {
    if (!followRouteRef.current) return;
    if (messages.length > 0) return;
    setOutputId(screen.suggestedOutputId ?? getDefaultOutputId());
  }, [screen.suggestedOutputId, screen.label, messages.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  // Escape: brain/history -> chat, fullscreen -> dock, docked -> close.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (view !== "chat") setView("chat");
      else if (fullscreen) onToggleFullscreen();
      else onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fullscreen, onClose, onToggleFullscreen, view]);

  const authHeaders = useCallback(async (): Promise<Record<
    string,
    string
  > | null> => {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) return null;
    const h: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    };
    if (impersonatingCoachId) {
      h["x-impersonate-coach-id"] = impersonatingCoachId;
    }
    return h;
  }, [impersonatingCoachId]);

  /**
   * Voice input: record with MediaRecorder, transcribe server-side (Whisper).
   * Works in every browser incl. Arc/Brave/Firefox — the built-in Web Speech
   * API is Chrome/Safari-only, so it isn't used at all.
   */
  const [micState, setMicState] = useState<
    "idle" | "requesting" | "recording" | "transcribing"
  >("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micChunksRef = useRef<Blob[]>([]);
  const micTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** When true, the next recorder stop throws the audio away (send/close). */
  const micDiscardRef = useRef(false);

  /** ClickUp-style feedback while recording: elapsed clock + live level bars. */
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const meterTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopMeters = useCallback(() => {
    if (meterTimerRef.current) {
      clearInterval(meterTimerRef.current);
      meterTimerRef.current = null;
    }
    if (clockTimerRef.current) {
      clearInterval(clockTimerRef.current);
      clockTimerRef.current = null;
    }
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      micDiscardRef.current = true;
      mediaRecorderRef.current?.stop();
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      stopMeters();
    };
  }, [stopMeters]);

  const transcribeRecording = useCallback(
    async (blob: Blob) => {
      setMicState("transcribing");
      try {
        const base64 = arrayBufferToBase64(await blob.arrayBuffer());
        const headers = await authHeaders();
        if (!headers) {
          setError("Please sign in again.");
          return;
        }
        const res = await fetch("/api/coach/profit-coach-ai/transcribe", {
          method: "POST",
          headers,
          body: JSON.stringify({ audio_base64: base64 }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          text?: string;
          error?: string;
        };
        if (!res.ok || typeof data.text !== "string") {
          setError(data.error || "Transcription failed. Try again.");
          return;
        }
        if (data.text) {
          const spoken = data.text;
          setInput((prev) => {
            const base = prev.trim();
            return base ? `${base} ${spoken}` : spoken;
          });
        }
        textareaRef.current?.focus();
      } catch {
        setError("Transcription failed. Try again.");
      } finally {
        setMicState("idle");
      }
    },
    [authHeaders]
  );

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  const startRecording = useCallback(async () => {
    if (micState !== "idle" || mediaRecorderRef.current) return;
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices) {
      setError("Voice recording isn't supported in this browser.");
      return;
    }
    let stream: MediaStream;
    setMicState("requesting");
    // Some browsers (Arc on localhost) leave the permission request pending
    // forever without ever rendering a prompt — surface a way out.
    const hintTimer = setTimeout(() => {
      setError(
        "Still waiting for microphone permission. If no prompt appeared, allow this site manually: paste arc://settings/content/microphone (or chrome://…) in the address bar and add this site under Allowed."
      );
    }, 8000);
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      clearTimeout(hintTimer);
      setError(null);
    } catch {
      clearTimeout(hintTimer);
      setMicState("idle");
      setError(
        "Microphone access was blocked. Enable the mic for this site in your browser's site settings (arc://settings/content/microphone in Arc), then try again."
      );
      return;
    }
    const mime = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
    ].find((m) => MediaRecorder.isTypeSupported(m));
    const rec = mime
      ? new MediaRecorder(stream, { mimeType: mime })
      : new MediaRecorder(stream);
    mediaRecorderRef.current = rec;
    micStreamRef.current = stream;
    micChunksRef.current = [];
    micDiscardRef.current = false;
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) micChunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
      mediaRecorderRef.current = null;
      stopMeters();
      if (micTimerRef.current) {
        clearTimeout(micTimerRef.current);
        micTimerRef.current = null;
      }
      const chunks = micChunksRef.current;
      micChunksRef.current = [];
      if (micDiscardRef.current || chunks.length === 0) {
        setMicState("idle");
        return;
      }
      void transcribeRecording(
        new Blob(chunks, { type: rec.mimeType || "audio/webm" })
      );
    };
    rec.start();
    setError(null);
    setMicState("recording");
    micTimerRef.current = setTimeout(() => {
      mediaRecorderRef.current?.stop();
    }, MAX_RECORDING_MS);

    // Live feedback: elapsed clock + a level meter fed by an analyser node.
    // Both are cosmetic — recording works even if the AudioContext fails.
    setRecordSeconds(0);
    setLevels([]);
    const startedAt = Date.now();
    clockTimerRef.current = setInterval(() => {
      setRecordSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      void ctx.resume().catch(() => {});
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      meterTimerRef.current = setInterval(() => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = ((data[i] ?? 128) - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        setLevels((prev) => [...prev.slice(-(LEVEL_BARS - 1)), rms]);
      }, LEVEL_SAMPLE_MS);
    } catch {
      /* no meter — recording continues */
    }
  }, [micState, stopMeters, transcribeRecording]);

  /** X on the recording strip: throw the take away, back to typing. */
  const cancelRecording = useCallback(() => {
    micDiscardRef.current = true;
    mediaRecorderRef.current?.stop();
  }, []);

  // Leaving the chat view discards any in-progress recording.
  useEffect(() => {
    if (view !== "chat" && mediaRecorderRef.current) {
      micDiscardRef.current = true;
      mediaRecorderRef.current.stop();
    }
  }, [view]);

  // Grow the composer with typed / dictated text; cap then scroll inside the box.
  useEffect(() => {
    if (micState === "recording") return;
    fitComposerTextarea(textareaRef.current, fullscreen);
  }, [input, fullscreen, micState]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;
      // Sending mid-recording discards the recording rather than racing it.
      if (mediaRecorderRef.current) {
        micDiscardRef.current = true;
        mediaRecorderRef.current.stop();
      }
      setError(null);
      followRouteRef.current = false;

      const nextMessages: PanelMessage[] = [
        ...messages,
        { role: "user", content: trimmed },
      ];
      setMessages([...nextMessages, { role: "assistant", content: "" }]);
      setInput("");
      setStreaming(true);

      try {
        const headers = await authHeaders();
        if (!headers) {
          setError("Please sign in again.");
          setMessages(nextMessages);
          return;
        }
        const res = await fetch("/api/coach/profit-coach-ai", {
          method: "POST",
          headers,
          body: JSON.stringify({
            messages: nextMessages,
            chatId,
            outputId,
            screenContext: screenContextForApi(screen),
            screenPath: pathname,
          }),
        });
        if (!res.ok || !res.body) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          setError(body.error || "Something went wrong. Try again.");
          setMessages(nextMessages);
          return;
        }
        const newChatId =
          res.headers.get("X-New-Chat-Id") || res.headers.get("X-Chat-Id");
        if (newChatId) setChatId(newChatId);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let assistant = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          assistant += decoder.decode(value, { stream: true });
          const snapshot = assistant;
          setMessages([
            ...nextMessages,
            { role: "assistant", content: snapshot },
          ]);
        }
      } catch {
        setError("Connection dropped. Try again.");
        setMessages(nextMessages);
      } finally {
        setStreaming(false);
      }
    },
    [authHeaders, chatId, messages, outputId, screen, streaming]
  );

  function startNewChat() {
    setView("chat");
    setMessages([]);
    setChatId(null);
    setError(null);
    followRouteRef.current = true;
    if (screen.suggestedOutputId) setOutputId(screen.suggestedOutputId);
    textareaRef.current?.focus();
  }

  const openBrain = useCallback(async () => {
    setView("brain");
    setBrainSavedOk(false);
    setBrainSaveError(null);
    if (brainContext) return;
    setBrainLoading(true);
    setBrainLoadError(null);
    try {
      const headers = await authHeaders();
      if (!headers) {
        setBrainLoadError("Please sign in again.");
        return;
      }
      const res = await fetch("/api/coach/profile", { headers });
      if (!res.ok) {
        setBrainLoadError("Couldn't load your brain. Try again.");
        return;
      }
      const data = (await res.json()) as { ai_context?: CoachAiContext };
      setBrainContext(data.ai_context ?? {});
    } catch {
      setBrainLoadError("Couldn't load your brain. Try again.");
    } finally {
      setBrainLoading(false);
    }
  }, [authHeaders, brainContext]);

  const openHistory = useCallback(async () => {
    setView("history");
    setChatsError(null);
    setChatsLoading(true);
    try {
      const headers = await authHeaders();
      if (!headers) {
        setChatsError("Please sign in again.");
        return;
      }
      const res = await fetch("/api/coach/profit-coach-ai/chats", { headers });
      if (!res.ok) {
        setChatsError("Couldn't load your chats. Try again.");
        return;
      }
      const data = (await res.json()) as { chats?: ChatListRow[] };
      setChats(data.chats ?? []);
    } catch {
      setChatsError("Couldn't load your chats. Try again.");
    } finally {
      setChatsLoading(false);
    }
  }, [authHeaders]);

  const pickSkill = useCallback((skillId: string, prefill = false) => {
    followRouteRef.current = false;
    setOutputId(skillId);
    setView("chat");
    if (prefill) {
      const out = getOutputById(skillId);
      if (out?.placeholder) {
        setInput(out.placeholder.replace(/^e\.g\.\s*/i, ""));
      }
    }
    textareaRef.current?.focus();
  }, []);

  async function openChat(id: string) {
    if (openingChatId) return;
    setOpeningChatId(id);
    setChatsError(null);
    try {
      const headers = await authHeaders();
      if (!headers) {
        setChatsError("Please sign in again.");
        return;
      }
      const res = await fetch(`/api/coach/profit-coach-ai/chats/${id}`, {
        headers,
      });
      if (!res.ok) {
        setChatsError("Couldn't open that chat. Try again.");
        return;
      }
      const data = (await res.json()) as {
        chat?: { last_output_id?: string | null };
        messages?: PanelMessage[];
      };
      setMessages(
        (data.messages ?? []).map((m) => ({ role: m.role, content: m.content }))
      );
      setChatId(id);
      setError(null);
      followRouteRef.current = false;
      const lastOutput = data.chat?.last_output_id;
      if (lastOutput && getOutputById(lastOutput)) setOutputId(lastOutput);
      setView("chat");
    } catch {
      setChatsError("Couldn't open that chat. Try again.");
    } finally {
      setOpeningChatId(null);
    }
  }

  async function saveBrain(next: CoachAiContext) {
    setBrainSaving(true);
    setBrainSaveError(null);
    setBrainSavedOk(false);
    try {
      const headers = await authHeaders();
      if (!headers) {
        setBrainSaveError("Please sign in again.");
        return;
      }
      const res = await fetch("/api/coach/profile", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ ai_context: next }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        setBrainSaveError(b.error || "Could not save. Try again.");
        return;
      }
      setBrainContext(next);
      setBrainSavedOk(true);
    } catch {
      setBrainSaveError("Could not save. Try again.");
    } finally {
      setBrainSaving(false);
    }
  }

  const activeOutput = getOutputById(outputId);
  const emptyState = messages.length === 0;
  const showFullscreenEmpty = fullscreen && emptyState;
  const screenContextLine = activeOutput
    ? `On ${screen.label} · ${activeOutput.label}`
    : `On ${screen.label}`;

  const emptyStateChips = useMemo(() => {
    const ids: string[] = [];
    if (screen.suggestedOutputId && getOutputById(screen.suggestedOutputId)) {
      ids.push(screen.suggestedOutputId);
    }
    for (const id of CHAT_STARTER_SKILL_IDS) {
      if (!ids.includes(id)) ids.push(id);
      if (ids.length >= 4) break;
    }
    return ids;
  }, [screen.suggestedOutputId]);

  const mainContentPad = fullscreen ? "px-4 md:px-[60px]" : "px-4";

  const panelPositionClass = fullscreen
    ? `fixed z-[95] flex flex-col bg-white inset-y-0 right-0 left-0 max-md:top-14 ${
        sidebarVisible ? "md:left-56" : ""
      }`
    : `fixed z-[95] flex flex-col border-slate-200 bg-white inset-y-0 right-0 w-full border-l shadow-[-8px_0_24px_-16px_rgba(15,23,42,0.25)] md:top-16 md:w-[28rem] md:rounded-tl-2xl md:border-t`;

  return (
    <aside
      aria-label="Profit Coach AI panel"
      className={panelPositionClass}
    >
      {fullscreen ? (
        <div
          className="fixed right-3 top-[4.5rem] z-[96] flex flex-col gap-2 sm:right-6 md:top-[3.5rem]"
        >
          <button
            type="button"
            onClick={onToggleFullscreen}
            aria-label="Dock to side"
            title="Dock to side"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            <Minimize2 className="h-4 w-4" aria-hidden />
          </button>
          {isAdminSurface ? (
            <Link
              href={aiSkillsAdminHref}
              aria-label="AI skills and prompts (admin)"
              title="AI skills & prompts"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
            >
              <Wrench className="h-4 w-4" aria-hidden />
            </Link>
          ) : null}
        </div>
      ) : null}
      {fullscreen ? (
        <StickyPageHeader
          title="Profit Coach AI"
          description={view === "chat" ? screenContextLine : undefined}
          descriptionPlacement="below"
          bleedInset="px-4 md:px-[60px]"
          tabs={
            <PageHeaderUnderlineTabs
              ariaLabel="Profit Coach AI sections"
              items={[
                {
                  kind: "button",
                  id: "chat",
                  label: "Chat",
                  active: view === "chat",
                  onClick: () => setView("chat"),
                },
                {
                  kind: "button",
                  id: "history",
                  label: "Chat history",
                  active: view === "history",
                  onClick: () => void openHistory(),
                },
                {
                  kind: "button",
                  id: "brain",
                  label: "Your brain",
                  active: view === "brain",
                  onClick: () => void openBrain(),
                },
                {
                  kind: "button",
                  id: "create",
                  label: "Create",
                  active: view === "create",
                  onClick: () => setView("create"),
                },
              ]}
            />
          }
        />
      ) : (
        /* Docked: compact icon header for the narrow side panel */
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sky-700">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">
              Profit Coach AI
            </p>
            <p className="truncate text-xs text-slate-500">
              {view === "brain"
                ? "Your brain — what I know about you"
                : view === "history"
                  ? "Chat history"
                  : view === "create"
                    ? "Create tools"
                    : screenContextLine}
            </p>
          </div>
          {isAdminSurface ? (
            <Link
              href={aiSkillsAdminHref}
              aria-label="AI skills and prompts (admin)"
              title="AI skills & prompts"
              className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              <Wrench className="h-4 w-4" />
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => {
              if (view === "brain") setView("chat");
              else void openBrain();
            }}
            aria-label={
              view === "brain"
                ? "Back to chat"
                : "Open your brain — what the AI knows about you"
            }
            title={view === "brain" ? "Back to chat" : "Your brain"}
            className={`rounded-full p-2 transition ${
              view === "brain"
                ? "bg-sky-100 text-sky-700 hover:bg-sky-200"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            }`}
          >
            <Brain className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (view === "history") setView("chat");
              else void openHistory();
            }}
            aria-label={view === "history" ? "Back to chat" : "Chat history"}
            title={view === "history" ? "Back to chat" : "Chat history"}
            className={`rounded-full p-2 transition ${
              view === "history"
                ? "bg-sky-100 text-sky-700 hover:bg-sky-200"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            }`}
          >
            <History className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={startNewChat}
            aria-label="New chat"
            title="New chat"
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onToggleFullscreen}
            aria-label="Expand to full screen"
            title="Expand"
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close AI panel"
            title="Close"
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
      {view === "brain" ? (
        /* Brain — what the AI knows about you; saved to profiles.ai_context */
        <div
          className={`flex min-h-0 flex-1 flex-col overflow-y-auto py-4 ${
            fullscreen ? "" : mainContentPad
          } ${fullscreen ? "px-0" : ""}`}
        >
          {brainSavedOk ? (
            <p className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              Saved. I&apos;ll use this from your next message.
            </p>
          ) : null}
          {brainLoading ? (
            <p className="flex items-center gap-2 py-8 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading your brain…
            </p>
          ) : brainLoadError ? (
            <div className="flex flex-col items-start gap-2 py-8">
              <p className="text-sm font-medium text-rose-600">
                {brainLoadError}
              </p>
              <button
                type="button"
                onClick={() => void openBrain()}
                className="text-sm font-medium text-sky-700 hover:text-sky-800"
              >
                Try again
              </button>
            </div>
          ) : brainContext ? (
            <ProfitCoachAiBrainForm
              compassHref={compassHref}
              initialContext={brainContext}
              saving={brainSaving}
              saveError={brainSaveError}
              onSave={(next) => void saveBrain(next)}
              onCancel={() => setView("chat")}
              variant={fullscreen ? "page" : "modal"}
            />
          ) : null}
        </div>
      ) : view === "history" ? (
        /* Saved chats — every panel conversation is stored automatically. */
        <div
          className={`flex-1 overflow-y-auto py-4 ${mainContentPad}`}
        >
          {!fullscreen ? (
            <button
              type="button"
              onClick={startNewChat}
              className="mb-3 flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-900"
            >
              <Plus className="h-4 w-4" aria-hidden /> New chat
            </button>
          ) : null}
          {chatsError ? (
            <div className="mb-3 flex flex-col items-start gap-1">
              <p className="text-sm font-medium text-rose-600">{chatsError}</p>
              <button
                type="button"
                onClick={() => void openHistory()}
                className="text-sm font-medium text-sky-700 hover:text-sky-800"
              >
                Try again
              </button>
            </div>
          ) : null}
          {chatsLoading && !chats ? (
            <p className="flex items-center gap-2 py-4 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading your chats…
            </p>
          ) : chats && chats.length === 0 ? (
            <p className="py-4 text-sm leading-relaxed text-slate-500">
              No saved chats yet. Every conversation here is saved
              automatically — start one and it&apos;ll show up in this list.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {(chats ?? []).map((c) => {
                const isCurrent = c.id === chatId;
                const isOpening = openingChatId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => void openChat(c.id)}
                    disabled={Boolean(openingChatId)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition disabled:opacity-60 ${
                      isCurrent ? "bg-sky-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <span className="min-w-0">
                      <span
                        className={`block truncate text-sm ${
                          isCurrent
                            ? "font-semibold text-sky-900"
                            : "font-medium text-slate-800"
                        }`}
                      >
                        {c.title || "Untitled"}
                      </span>
                      <span
                        className={`mt-0.5 block text-xs ${
                          isCurrent ? "text-sky-700" : "text-slate-500"
                        }`}
                      >
                        {formatChatRelativeTime(c.updated_at)}
                      </span>
                    </span>
                    {isOpening ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : view === "create" ? (
        <div className="flex-1 overflow-y-auto py-4">
          <StudioHubOverview
            basePath={createHubHref}
            onPickSkill={(id) => pickSkill(id, true)}
            onOpenBrain={() => void openBrain()}
          />
        </div>
      ) : (
        <>
          {showFullscreenEmpty ? (
            <div
              className={`flex flex-1 flex-col items-center justify-center pb-8 ${mainContentPad}`}
            >
              <div className="w-full max-w-2xl text-center">
                <p className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                  What can I help with?
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  I know your brain — ideal client, pain language, and client
                  results — and I can see you&apos;re on{" "}
                  <span className="font-medium text-slate-700">
                    {screen.label}
                  </span>
                  .
                </p>
              </div>

              <div className="mt-8 w-full max-w-2xl">
                {error ? (
                  <p className="mb-2 text-xs font-medium text-rose-600">
                    {error}
                  </p>
                ) : null}
                {micState === "recording" ? (
                  <div className="flex items-center gap-2.5 rounded-3xl border border-slate-300 bg-white px-3 py-2.5 shadow-sm">
                    <button
                      type="button"
                      onClick={cancelRecording}
                      aria-label="Discard recording"
                      title="Discard"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <span className="shrink-0 text-sm font-medium tabular-nums text-slate-700">
                      {formatRecordingClock(recordSeconds)}
                    </span>
                    <div
                      aria-hidden
                      className="flex h-9 min-w-0 flex-1 items-center gap-[2px] overflow-hidden px-1"
                    >
                      {Array.from({ length: LEVEL_BARS }).map((_, i) => {
                        const offset = Math.max(0, levels.length - LEVEL_BARS);
                        const level =
                          i < levels.length - offset
                            ? levels[offset + i]!
                            : null;
                        const h =
                          level === null ? 3 : Math.min(26, 3 + level * 110);
                        return (
                          <span
                            key={i}
                            className={`w-[2px] shrink-0 rounded-full ${
                              level === null ? "bg-slate-200" : "bg-slate-700"
                            }`}
                            style={{ height: `${h}px` }}
                          />
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={stopRecording}
                      aria-label="Stop and transcribe"
                      title="Done — turn into text"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white transition hover:bg-sky-700"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    className="rounded-3xl border border-slate-200 bg-white px-4 py-3 shadow-sm focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100"
                  >
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void send(input);
                        }
                      }}
                      rows={2}
                      placeholder={
                        micState === "transcribing"
                          ? "Transcribing…"
                          : micState === "requesting"
                            ? "Waiting for mic permission…"
                            : "How can I help you today?"
                      }
                      className="min-h-[3.5rem] w-full resize-none overflow-y-hidden bg-transparent text-[16px] leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none"
                    />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <label className="sr-only" htmlFor="coach-ai-skill-fs">
                        Skill
                      </label>
                      <select
                        id="coach-ai-skill-fs"
                        value={outputId}
                        onChange={(e) => {
                          followRouteRef.current = false;
                          setOutputId(e.target.value);
                        }}
                        className="max-w-[14rem] rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 focus:border-sky-400 focus:outline-none"
                      >
                        {PROFIT_COACH_OUTPUTS.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void startRecording()}
                          disabled={micState !== "idle"}
                          aria-label="Record a voice note"
                          title="Speak instead of typing"
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-60"
                        >
                          {micState === "transcribing" ||
                          micState === "requesting" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Mic className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => void send(input)}
                          disabled={streaming || !input.trim()}
                          aria-label="Send"
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white transition hover:bg-sky-700 disabled:opacity-40"
                        >
                          {streaming ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ArrowUp className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap justify-center gap-2 w-full max-w-2xl">
                {emptyStateChips.map((id) => {
                  const out = getOutputById(id);
                  if (!out) return null;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => pickSkill(id, true)}
                      className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm text-slate-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-900"
                    >
                      {out.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
                <button
                  type="button"
                  onClick={() => void openBrain()}
                  className="font-medium text-sky-700 hover:text-sky-800"
                >
                  See what I know about you →
                </button>
                <button
                  type="button"
                  onClick={() => setView("create")}
                  className="font-medium text-sky-700 hover:text-sky-800"
                >
                  Browse all Create tools →
                </button>
              </div>
            </div>
          ) : (
            <>
              <div
                ref={scrollRef}
                className={`flex-1 overflow-y-auto py-4 ${mainContentPad} ${
                  fullscreen ? "flex flex-col" : ""
                }`}
              >
                <div
                  className={
                    fullscreen ? "mx-auto w-full max-w-3xl flex-1" : ""
                  }
                >
                  {emptyState ? (
                    <div className="flex h-full flex-col justify-center gap-3">
                      <p className="text-base font-semibold text-slate-800">
                        What can I help with?
                      </p>
                      <p className="text-sm leading-relaxed text-slate-500">
                        I know your brain — your ideal client, pain language,
                        and client results — and I can see you&apos;re on{" "}
                        <span className="font-medium text-slate-700">
                          {screen.label}
                        </span>
                        .
                      </p>
                      {activeOutput?.placeholder ? (
                        <button
                          type="button"
                          onClick={() => {
                            setInput(
                              activeOutput.placeholder.replace(
                                /^e\.g\.\s*/i,
                                ""
                              )
                            );
                            textareaRef.current?.focus();
                          }}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-sm text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-900"
                        >
                          {activeOutput.placeholder}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void openBrain()}
                        className="text-left text-sm font-medium text-sky-700 hover:text-sky-800"
                      >
                        See what I know about you →
                      </button>
                      <Link
                        href={createHubHref}
                        className="text-sm font-medium text-sky-700 hover:text-sky-800"
                      >
                        Open the full Create hub →
                      </Link>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {messages.map((m, i) =>
                        m.role === "user" ? (
                          <div key={i} className="flex justify-end">
                            <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-sky-600 px-3.5 py-2.5 text-[15px] leading-relaxed text-white">
                              {m.content}
                            </p>
                          </div>
                        ) : (
                          <div key={i} className="flex min-w-0 max-w-full">
                            {m.content ? (
                              <ProfitCoachAiMarkdown
                                content={m.content}
                                className="min-w-0 max-w-full text-[15px] leading-relaxed text-slate-800"
                              />
                            ) : streaming && i === messages.length - 1 ? (
                              <p className="text-[15px] text-slate-800">…</p>
                            ) : null}
                          </div>
                        )
                      )}
                      {streaming ? (
                        <p className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />{" "}
                          Writing…
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>

              <div
                className={`border-t border-slate-200 py-3 ${mainContentPad}`}
              >
                <div className={fullscreen ? "mx-auto max-w-3xl" : ""}>
                  {error ? (
                    <p className="mb-2 text-xs font-medium text-rose-600">
                      {error}
                    </p>
                  ) : null}
                  {!fullscreen ? (
                    <div className="mb-2">
                      <label className="sr-only" htmlFor="coach-ai-skill">
                        Skill
                      </label>
                      <select
                        id="coach-ai-skill"
                        value={outputId}
                        onChange={(e) => {
                          followRouteRef.current = false;
                          setOutputId(e.target.value);
                        }}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 focus:border-sky-400 focus:outline-none"
                      >
                        {PROFIT_COACH_OUTPUTS.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  {micState === "recording" ? (
                    <div className="flex items-center gap-2.5 rounded-2xl border border-slate-300 bg-white px-2 py-2">
                      <button
                        type="button"
                        onClick={cancelRecording}
                        aria-label="Discard recording"
                        title="Discard"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <span className="shrink-0 text-sm font-medium tabular-nums text-slate-700">
                        {formatRecordingClock(recordSeconds)}
                      </span>
                      <div
                        aria-hidden
                        className="flex h-8 min-w-0 flex-1 items-center gap-[2px] overflow-hidden px-1"
                      >
                        {Array.from({ length: LEVEL_BARS }).map((_, i) => {
                          const offset = Math.max(
                            0,
                            levels.length - LEVEL_BARS
                          );
                          const level =
                            i < levels.length - offset
                              ? levels[offset + i]!
                              : null;
                          const h =
                            level === null ? 3 : Math.min(26, 3 + level * 110);
                          return (
                            <span
                              key={i}
                              className={`w-[2px] shrink-0 rounded-full ${
                                level === null
                                  ? "bg-slate-200"
                                  : "bg-slate-700"
                              }`}
                              style={{ height: `${h}px` }}
                            />
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={stopRecording}
                        aria-label="Stop and transcribe"
                        title="Done — turn into text"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white transition hover:bg-sky-700"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      className={`flex flex-col gap-2 rounded-2xl border border-slate-300 bg-white px-3 py-2 focus-within:border-sky-400 ${
                        fullscreen ? "shadow-sm" : ""
                      }`}
                    >
                      <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void send(input);
                          }
                        }}
                        rows={1}
                        placeholder={
                          micState === "transcribing"
                            ? "Transcribing…"
                            : micState === "requesting"
                              ? "Waiting for mic permission…"
                              : "Ask, or tell me what to write…"
                        }
                        className="min-h-[2.5rem] w-full resize-none overflow-y-hidden bg-transparent text-[15px] leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none"
                      />
                      {fullscreen ? (
                        <div className="flex items-center justify-between gap-2">
                          <label className="sr-only" htmlFor="coach-ai-skill-fs-footer">
                            Skill
                          </label>
                          <select
                            id="coach-ai-skill-fs-footer"
                            value={outputId}
                            onChange={(e) => {
                              followRouteRef.current = false;
                              setOutputId(e.target.value);
                            }}
                            className="max-w-[14rem] rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 focus:border-sky-400 focus:outline-none"
                          >
                            {PROFIT_COACH_OUTPUTS.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => void startRecording()}
                              disabled={micState !== "idle"}
                              aria-label="Record a voice note"
                              title="Speak instead of typing"
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-60"
                            >
                              {micState === "transcribing" ||
                              micState === "requesting" ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Mic className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => void send(input)}
                              disabled={streaming || !input.trim()}
                              aria-label="Send"
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white transition hover:bg-sky-700 disabled:opacity-40"
                            >
                              {streaming ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <ArrowUp className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-end justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void startRecording()}
                            disabled={micState !== "idle"}
                            aria-label="Record a voice note"
                            title="Speak instead of typing"
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-60"
                          >
                            {micState === "transcribing" ||
                            micState === "requesting" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Mic className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => void send(input)}
                            disabled={streaming || !input.trim()}
                            aria-label="Send"
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white transition hover:bg-sky-700 disabled:opacity-40"
                          >
                            {streaming ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ArrowUp className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}
      </div>
    </aside>
  );
}
