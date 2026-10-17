"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { ArrowUp, Loader2, Mic, PhoneOff, Square } from "lucide-react";

import { getValidSupabaseAccessToken } from "@/lib/supabaseAccessToken";
import type { AvaCallProtocol } from "@/lib/practiceKnowledge/intakeCall";

import { useAutoGrow, useVoiceInput } from "../composer";
import { usePractice } from "../PracticeProvider";

type Line = { role: "user" | "assistant"; text: string };

/**
 * The call with Ava. Live mode is a continuous ElevenLabs session whose words
 * come from the intake protocol. Without that, Ava speaks each question and
 * then listens: same protocol, one turn at a time.
 */
export function AvaVoiceCall({
  protocol,
  coachId,
  onClose,
}: {
  protocol: AvaCallProtocol;
  coachId: string | null;
  onClose: () => void;
}) {
  const [live, setLive] = useState<boolean | null>(null);
  const [typed, setTyped] = useState(false);
  const [bookPath, setBookPath] = useState("/advisory-blueprint");
  const { authHeaders } = usePractice();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const headers = await authHeaders();
      if (!headers) {
        if (!cancelled) setLive(false);
        return;
      }
      const res = await fetch("/api/coach/practice/voice/session", { headers }).catch(() => null);
      const body = (await res?.json().catch(() => null)) as { live?: boolean; bookPath?: string } | null;
      if (cancelled) return;
      setLive(Boolean(body?.live));
      if (body?.bookPath) setBookPath(body.bookPath);
    })();
    return () => {
      cancelled = true;
    };
  }, [authHeaders]);

  if (live === null) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--bp-muted)]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        Starting the call…
      </div>
    );
  }

  if (live && !typed) {
    return (
      <ConversationProvider>
        <LiveCall
          protocol={protocol}
          coachId={coachId}
          bookPath={bookPath}
          onClose={onClose}
          onType={() => setTyped(true)}
          authHeaders={authHeaders}
        />
      </ConversationProvider>
    );
  }

  return <TurnCall protocol={protocol} bookPath={bookPath} onClose={onClose} />;
}

function TurnCall({
  protocol,
  bookPath,
  onClose,
}: {
  protocol: AvaCallProtocol;
  bookPath: string;
  onClose: () => void;
}) {
  const { session, knowledge, loading, busy, error, start, reply, transcribe, avaSpeaking, playAva } = usePractice();
  const [draft, setDraft] = useState("");
  const boxRef = useAutoGrow(draft, 120);
  const opened = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const voice = useVoiceInput(transcribe, (said) => {
    if (said.trim()) reply(said.trim());
  });

  useEffect(() => {
    if (loading || opened.current) return;
    opened.current = true;
    const turns = session?.status === "active" ? session.turns : [];
    const last = [...turns].reverse().find((turn) => turn.role === "assistant");
    if (turns.length && last) {
      void playAva(last.content).then((heard) => {
        if (!heard) setVoiceNote("Ava's voice didn't start. Her question is on screen, and you can answer it here.");
      });
      return;
    }
    start();
  }, [loading, session, start, playAva]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [session?.turns.length, busy]);

  const done = Boolean(knowledge?.interview_completed_at);
  const turns = session?.turns ?? [];

  function send() {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    reply(text);
  }

  return (
    <CallFrame
      protocol={protocol}
      done={done}
      bookPath={bookPath}
      status={voice.recording ? "Listening" : avaSpeaking ? "Ava is speaking" : busy ? "Ava is thinking" : "Your turn"}
      onClose={onClose}
    >
      <Transcript
        lines={turns.map((turn) => ({ role: turn.role, text: turn.content }))}
        thinking={busy}
      />
      <div ref={bottomRef} />
      {error ? <p className="px-4 text-sm text-[#9b2c2c]">{error}</p> : null}
      {voiceNote ? <p className="px-4 text-sm text-[var(--bp-muted)]">{voiceNote}</p> : null}
      {voice.failed ? <p className="px-4 text-sm text-[#9b2c2c]">{voice.failed}</p> : null}
      <div className="border-t border-[var(--bp-rule)] px-4 py-3">
        <div className="rounded-2xl border border-[var(--bp-rule)] bg-white focus-within:border-[var(--bp-sky)]">
          <textarea
            ref={boxRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 8000))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={voice.transcribing ? "Turning your voice into text…" : "Answer Ava, or type"}
            className="bp-input block w-full resize-none bg-transparent px-4 pb-1 pt-3 text-[0.9375rem] leading-6 outline-none"
          />
          <div className="flex items-center justify-between px-2.5 pb-2.5">
            <button
              type="button"
              onClick={() => void voice.toggle()}
              disabled={voice.transcribing || busy}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                voice.recording ? "bg-[#fdeeee] text-[#9b1c1c]" : "text-[var(--bp-muted)] hover:bg-[var(--bp-tint)]"
              }`}
            >
              {voice.transcribing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : voice.recording ? (
                <Square className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Mic className="h-3.5 w-3.5" aria-hidden />
              )}
              {voice.recording ? "Stop" : "Speak"}
            </button>
            <button
              type="button"
              onClick={send}
              disabled={!draft.trim() || busy}
              aria-label="Send"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bp-navy)] text-white disabled:opacity-35"
            >
              <ArrowUp className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </CallFrame>
  );
}

function LiveCall({
  protocol,
  coachId,
  bookPath,
  onClose,
  onType,
  authHeaders,
}: {
  protocol: AvaCallProtocol;
  coachId: string | null;
  bookPath: string;
  onClose: () => void;
  onType: () => void;
  authHeaders: () => Promise<Record<string, string> | null>;
}) {
  const { reload, knowledge } = usePractice();
  const [lines, setLines] = useState<Line[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const started = useRef(false);

  const { startSession, endSession, status, isSpeaking } = useConversation({
    onMessage: ({ message, source }) => {
      const text = message.trim();
      if (!text) return;
      setLines((prev) => [...prev, { role: source === "user" ? "user" : "assistant", text }]);
    },
    onError: (message) => {
      setErrorMessage(typeof message === "string" ? message : "Voice dropped. You can type instead.");
    },
    onDisconnect: () => {
      reload();
    },
  });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      const headers = await authHeaders();
      const token = await getValidSupabaseAccessToken();
      if (!headers || !token) {
        setErrorMessage("Sign in again, then restart the call.");
        return;
      }
      const res = await fetch("/api/coach/practice/voice/session", { method: "POST", headers });
      const body = (await res.json().catch(() => null)) as { signedUrl?: string; error?: string } | null;
      if (!res.ok || !body?.signedUrl) {
        setErrorMessage(body?.error || "Live voice is not available. Type instead.");
        return;
      }
      try {
        startSession({
          signedUrl: body.signedUrl,
          connectionType: "websocket",
          customLlmExtraBody: {
            ava_auth: token,
            ava_coach_id: coachId,
          },
        });
      } catch {
        setErrorMessage("Could not start the call.");
      }
    })();
    return () => {
      endSession();
    };
    // The session starts once. endSession identity changes across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connected = status === "connected";
  const label = errorMessage
    ? "Unavailable"
    : status === "connecting"
      ? "Connecting"
      : !connected
        ? "Ended"
        : isSpeaking
          ? "Ava is speaking"
          : "Listening";

  return (
    <CallFrame
      protocol={protocol}
      done={Boolean(knowledge?.interview_completed_at)}
      bookPath={bookPath}
      status={label}
      onClose={() => {
        endSession();
        onClose();
      }}
    >
      {errorMessage ? (
        <div className="px-4">
          <p className="text-sm text-[#9b2c2c]">{errorMessage}</p>
          <button type="button" onClick={onType} className="mt-2 text-sm font-semibold text-[var(--bp-blue)] hover:underline">
            Type instead
          </button>
        </div>
      ) : null}
      <Transcript lines={lines} thinking={connected && lines.length === 0} />
    </CallFrame>
  );
}

function CallFrame({
  protocol,
  done,
  bookPath,
  status,
  onClose,
  children,
}: {
  protocol: AvaCallProtocol;
  done: boolean;
  bookPath: string;
  status: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--bp-rule)] px-4 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--bp-ink)]">
            {protocol === "intake" ? "First call" : "Follow-up"}
          </p>
          <p className="text-xs text-[var(--bp-faint)]">{status}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#9b1c1c] px-3 py-1.5 text-xs font-semibold text-white"
        >
          <PhoneOff className="h-3.5 w-3.5" aria-hidden />
          End
        </button>
      </div>
      <div className="bp-scroll min-h-0 flex-1 overflow-y-auto py-4">{children}</div>
      {done ? (
        <div className="border-t border-[var(--bp-rule)] px-4 py-3">
          <Link
            href={bookPath}
            className="flex w-full items-center justify-center rounded-full bg-[var(--bp-navy)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--bp-blue)]"
          >
            Book your Blueprint Call
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function Transcript({ lines, thinking }: { lines: Line[]; thinking: boolean }) {
  if (!lines.length && !thinking) {
    return <p className="px-4 text-sm leading-6 text-[var(--bp-muted)]">Ava will start. Answer in your own words.</p>;
  }
  return (
    <div className="space-y-3 px-4">
      {lines.map((line, i) =>
        line.role === "user" ? (
          <div key={i} className="flex justify-end">
            <p className="max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-tr-md bg-[var(--bp-navy)] px-4 py-2.5 text-[0.9375rem] leading-6 text-white">
              {line.text}
            </p>
          </div>
        ) : (
          <p key={i} className="max-w-[94%] whitespace-pre-wrap rounded-2xl rounded-tl-md bg-[var(--bp-tint)] px-4 py-3 text-[0.9375rem] leading-6 text-[var(--bp-ink)]">
            {line.text}
          </p>
        )
      )}
      {thinking ? (
        <p className="flex items-center gap-2 text-sm text-[var(--bp-muted)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Ava is thinking…
        </p>
      ) : null}
    </div>
  );
}
