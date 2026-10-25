"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { Check, ChevronDown, FileText, Lightbulb, Loader2, Mic, MicOff, Pause, PhoneOff, Play, X } from "lucide-react";

import { figtree } from "@/fonts";
import { PUSHBACK_HELP, difficultyById } from "@/lib/simulator/difficulty";
import type { CallStart, Difficulty, LiveState, SimClient, SimFact, SimMode, SimStage, TranscriptLine } from "@/lib/simulator/types";

import { faceOf } from "@/lib/simulator/faces";

import { AiWorking } from "./AiWorking";
import { useSimApi } from "./simApi";
import "./sim.css";

export type SimCallSetup = {
  id: string;
  call: CallStart;
  client: SimClient;
  situation: { title: string; stages: SimStage[] };
  difficulty: Difficulty;
  tips: boolean;
  mode: SimMode;
  /** 1 for Normal; Quick raises every voice a notch. */
  pace: number;
  /** The Call simulator uses its own sessions API; the Client simulator's is the default. */
  apiBase?: string;
  /** The tiles for "Found so far", when they aren't the client's facts. */
  facts?: SimFact[];
  /** The help box, when it isn't the client's kind of pushback. */
  help?: { title: string; help: string; try: string[] };
  /** Shown before anyone speaks, when the coach goes first. */
  cue?: string;
  /** The stage pills jump ahead: the call restarts at that part. */
  canSkip?: boolean;
  /** "Try that moment again": a short retry of one line, checked against the first try. */
  replay?: { firstTry: string };
  /** What the scoring screen says, when it isn't a coaching session (the Call simulator's sales calls). */
  scoring?: { title: string; steps: string[]; seconds: number };
  /** A panel on the left, toggled from the header (the Call simulator's script). The render brings its own card. */
  script?: {
    label: string;
    render: (s: { lines: TranscriptLine[]; stage: string }) => ReactNode;
    /** "side": a panel on the left. "centre": the script takes the middle and the client moves to a slim column on the left. */
    layout?: "side" | "centre";
  };
};

const MIC_HELP =
  "Check your browser lets this page use the microphone: click the icon at the left of the address bar, allow Microphone, then try again. Chrome, Edge or Safari work best.";

type Phase = "connecting" | "live" | "timeout" | "skipping" | "dropped" | "confirm-end" | "scoring" | "too-short" | "error";
type Note = { working: string; next: string; ask: string };

/**
 * The call. A full-screen navy room with the client's face in the middle.
 * Practice shows the stages, the facts found and a tip; certification shows
 * only the face and the clock.
 */
export function SimCall(props: { setup: SimCallSetup; onDone: (id: string) => void; onDropped: () => void }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <ConversationProvider>
      <CallRoom {...props} />
    </ConversationProvider>,
    document.body
  );
}

function CallRoom({ setup, onDone, onDropped }: { setup: SimCallSetup; onDone: (id: string) => void; onDropped: () => void }) {
  const { id, client, situation, difficulty, tips, mode } = setup;
  const base = setup.apiBase ?? "/api/coach/simulator/sessions";
  const facts = setup.facts ?? client.facts;
  const api = useSimApi();
  // A replay is a few lines long: no stages, no help panel, just the moment.
  const practice = mode === "practice" && !setup.replay;
  const [phase, setPhase] = useState<Phase>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [caption, setCaption] = useState<string>(setup.cue ?? "");
  const [live, setLive] = useState<LiveState>({ stage: situation.stages[0].id, covered: [], found: [], tip: "" });
  // Open beside the face on wide screens; on a phone it would cover the face, so it starts closed.
  const [panelOpen, setPanelOpen] = useState(() => practice && typeof window !== "undefined" && window.innerWidth >= 1024);
  const [note, setNote] = useState<Note | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteLoading, setNoteLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const lines = useRef<TranscriptLine[]>([]);
  // A copy that re-renders, for the script panel and the pause screen.
  const [shownLines, setShownLines] = useState<TranscriptLine[]>([]);
  const [scriptOpen, setScriptOpen] = useState(() => Boolean(setup.script) && typeof window !== "undefined" && window.innerWidth >= 1024);
  const started = useRef(Date.now());
  // Each stretch between pauses is its own recording; lines remember which one and when, for the player.
  const part = useRef(-1);
  const partStarted = useRef(Date.now());
  const phaseRef = useRef<Phase>("connecting");
  const turnBusy = useRef(false);
  const turnAgain = useRef(false);
  const faceRef = useRef<HTMLDivElement>(null);
  const micRef = useRef<HTMLDivElement>(null);

  const setPhaseBoth = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const runTurn = useCallback(async () => {
    if (turnBusy.current) {
      turnAgain.current = true;
      return;
    }
    turnBusy.current = true;
    do {
      turnAgain.current = false;
      const res = await api<{ live: Partial<LiveState> }>(`${base}/${id}/turn`, {
        method: "POST",
        body: { transcript: lines.current },
      });
      if (res.ok && res.data.live?.stage) setLive((prev) => ({ ...prev, ...res.data.live }) as LiveState);
    } while (turnAgain.current);
    turnBusy.current = false;
  }, [api, base, id]);

  const conversation = useConversation({
    onConnect: ({ conversationId }) => {
      part.current += 1;
      partStarted.current = Date.now();
      setPhaseBoth("live");
      void api(`${base}/${id}/conversation`, { method: "POST", body: { conversationId } });
    },
    onMessage: ({ message, source }) => {
      const text = message.replace(/\[[a-z ,'-]{2,40}\]\s*/gi, "").trim();
      if (!text) return;
      const role = source === "user" ? "coach" : "client";
      const now = Date.now();
      lines.current = [
        ...lines.current,
        {
          role,
          text,
          at: Math.round((now - started.current) / 1000),
          part: Math.max(0, part.current),
          // The client's words arrive as they start speaking; the coach's only once they've finished,
          // so step those back to roughly where they began (about 2.6 words a second).
          t: Math.max(0, Math.round(((now - partStarted.current) / 1000 - (role === "coach" ? text.split(/\s+/).length / 2.6 : 0)) * 10) / 10),
        },
      ];
      setShownLines(lines.current);
      if (role === "client") {
        setCaption(text);
        void runTurn();
      }
    },
    onError: (message) => {
      const text = typeof message === "string" ? message : "";
      // Failing before connecting is nearly always the microphone being blocked.
      if (phaseRef.current === "connecting") {
        setError(
          /permission|notallowed|denied|microphone|getusermedia|device/i.test(text)
            ? MIC_HELP
            : `Couldn't connect the call. ${MIC_HELP}`
        );
        setPhaseBoth("error");
        return;
      }
      setError(text || "The voice line had a problem.");
    },
    onDisconnect: () => {
      if (phaseRef.current === "live" || phaseRef.current === "connecting") setPhaseBoth("dropped");
    },
  });
  const { startSession, endSession, isSpeaking, isMuted, setMuted, getOutputVolume, getInputVolume } = conversation;

  const startCall = useCallback(
    (call: CallStart) => {
      setError(null);
      try {
        startSession({
          signedUrl: call.signedUrl,
          connectionType: "websocket",
          overrides: {
            agent: { prompt: { prompt: call.prompt }, firstMessage: call.firstMessage, language: "en" },
            // ElevenLabs takes 0.7 to 1.2.
            tts: { voiceId: call.voiceId, speed: Math.min(1.2, Math.round(call.speed * setup.pace * 100) / 100) },
          },
        });
      } catch {
        setPhaseBoth("error");
        setError("Couldn't start the call. Check your microphone is allowed.");
      }
    },
    [startSession, setPhaseBoth, setup.pace]
  );

  // Start once, and hang up if the room closes. Both wait a tick: in dev, React
  // mounts twice, and the ElevenLabs provider ends any call pending when it
  // unmounts, so the call only starts after that settles.
  const once = useRef(false);
  const hangUp = useRef<number | null>(null);
  useEffect(() => {
    if (hangUp.current !== null) {
      window.clearTimeout(hangUp.current);
      hangUp.current = null;
    }
    const begin = window.setTimeout(() => {
      if (once.current) return;
      once.current = true;
      startCall(setup.call);
    }, 0);
    return () => {
      window.clearTimeout(begin);
      hangUp.current = window.setTimeout(() => endSession(), 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If the call hasn't connected after 20 seconds, say why it might not have, instead of spinning.
  useEffect(() => {
    if (phase !== "connecting") return;
    const t = window.setTimeout(() => {
      if (phaseRef.current !== "connecting") return;
      setError(`The call hasn't connected. ${MIC_HELP}`);
      setPhaseBoth("error");
    }, 20000);
    return () => window.clearTimeout(t);
  }, [phase, setPhaseBoth]);

  // Clock, page lock and leave warning.
  useEffect(() => {
    const t = window.setInterval(() => setElapsed(Math.round((Date.now() - started.current) / 1000)), 1000);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const warn = (e: BeforeUnloadEvent) => {
      if (phaseRef.current === "live" || phaseRef.current === "timeout") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.clearInterval(t);
      document.body.style.overflow = previous;
      window.removeEventListener("beforeunload", warn);
    };
  }, []);

  // The face's light follows the client's voice; the small ring follows the coach's.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      try {
        const out = isSpeaking ? Math.min(1, getOutputVolume() * 2.2) : 0;
        const inp = Math.min(1, getInputVolume() * 3);
        faceRef.current?.style.setProperty("--sim-vol", out.toFixed(3));
        micRef.current?.style.setProperty("--sim-in", inp.toFixed(3));
      } catch {
        /* not connected yet */
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isSpeaking, getOutputVolume, getInputVolume]);

  /** Pause: the client stops straight away, mid-sentence if need be, and nothing runs while paused. */
  function pause() {
    if (phaseRef.current !== "live") return;
    setPhaseBoth("timeout");
    setNote(null);
    setNoteError(null);
    endSession();
  }

  /** While paused, practice only: a short note on how it's going (counted as a time out for the scorer). */
  async function askHelp() {
    setNote(null);
    setNoteError(null);
    setNoteLoading(true);
    const res = await api<{ note: Note }>(`${base}/${id}/time-out`, {
      method: "POST",
      body: { transcript: lines.current },
    });
    setNoteLoading(false);
    if (res.ok) setNote(res.data.note);
    else setNoteError(res.error);
  }

  // Space or P pauses a live call.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement | null)?.isContentEditable;
      if ((e.code === "Space" || e.key === "p" || e.key === "P") && phaseRef.current === "live" && !typing) {
        e.preventDefault();
        pause();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  async function resume() {
    setPhaseBoth("connecting");
    const res = await api<{ call: CallStart }>(`${base}/${id}/resume`, { method: "POST", body: { transcript: lines.current } });
    if (!res.ok) {
      setPhaseBoth("error");
      setError(res.error);
      return;
    }
    startCall(res.data.call);
  }

  async function skipTo(stageId: string) {
    setPhaseBoth("skipping");
    endSession();
    setCaption("");
    setLive((prev) => ({ ...prev, stage: stageId, tip: "" }));
    const res = await api<{ call: CallStart }>(`${base}/${id}/resume`, {
      method: "POST",
      body: { skipTo: stageId, transcript: lines.current },
    });
    if (!res.ok) {
      setPhaseBoth("error");
      setError(res.error);
      return;
    }
    setPhaseBoth("connecting");
    startCall(res.data.call);
  }

  /** End without saving: nothing is scored and it never shows in the history. Not offered in certification. */
  async function discard() {
    setPhaseBoth("scoring");
    endSession();
    await api(`${base}/${id}/discard`, { method: "POST" });
    onDropped();
  }

  async function finish() {
    setPhaseBoth("scoring");
    endSession();
    const res = await api<{ status: string }>(`${base}/${id}/finish`, {
      method: "POST",
      body: { transcript: lines.current },
    });
    if (res.ok && res.data.status === "abandoned") {
      setPhaseBoth("too-short");
      return;
    }
    // Scored, or failed to score: the report page shows the result or a retry.
    onDone(id);
  }

  const level = difficultyById(difficulty)?.label;
  const stageIndex = situation.stages.findIndex((s) => s.id === live.stage);
  const help = setup.help ?? PUSHBACK_HELP[client.pushback.kind];
  const status =
    phase === "connecting"
      ? "Connecting…"
      : phase === "live"
        ? isSpeaking
          ? `${client.firstName} is speaking`
          : "Listening"
        : phase === "timeout"
          ? "Paused"
          : phase === "skipping"
            ? "Skipping ahead…"
            : "";

  const centre = setup.script?.layout === "centre" && scriptOpen;
  const helpPanel =
    practice && panelOpen ? (
            <aside className="sim-glass sim-scroll absolute inset-y-0 right-0 z-[4] w-[min(92vw,340px)] overflow-y-auto rounded-l-3xl bg-[rgba(8,28,48,0.72)] p-5 lg:static lg:mr-6 lg:mb-6 lg:rounded-3xl">
              <div className="flex items-center justify-between">
                <p className="text-kicker font-semibold uppercase text-[var(--sim-cream-faint)]">
                  {facts.length ? `Found so far · ${live.found.length} of ${facts.length}` : "Help"}
                </p>
                <button type="button" onClick={() => setPanelOpen(false)} className="rounded-full p-1 text-[var(--sim-cream-faint)] hover:text-[var(--sim-cream)] lg:hidden" aria-label="Close">
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <div className={`grid grid-cols-2 gap-2 ${facts.length ? "mt-3" : ""}`}>
                {facts.map((f) => {
                  const got = live.found.includes(f.id);
                  return (
                    <span key={f.id} className={`sim-fact ${got ? "" : "is-hidden"}`} title={got ? undefined : "Not found yet: dig here"}>
                      {got ? f.label : f.hint}
                    </span>
                  );
                })}
              </div>
              {tips ? (
                <div className={facts.length ? "mt-6" : "mt-3"}>
                  <p className="text-kicker font-semibold uppercase text-[var(--sim-cream-faint)]">Tip</p>
                  <p key={live.tip} className="sim-caption mt-2 !text-read !leading-snug">
                    {live.tip || situation.stages[Math.max(0, stageIndex)]?.aim}
                  </p>
                </div>
              ) : null}
              <details className="group mt-6 rounded-2xl border border-[var(--sim-cream-line)] p-4" open={difficulty === "hard"}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-[var(--sim-cream)] marker:hidden">
                  {help.title}
                  <ChevronDown className="h-4 w-4 shrink-0 text-[var(--sim-cream-faint)] transition group-open:rotate-180" aria-hidden />
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-[var(--sim-cream-soft)]">{help.help}</p>
                <ul className="mt-3 space-y-1.5">
                  {help.try.map((q) => (
                    <li key={q} className="text-sm leading-snug text-[var(--sim-cream)]">
                      &ldquo;{q}&rdquo;
                    </li>
                  ))}
                </ul>
              </details>
              <div className="mt-4 rounded-2xl border border-[var(--sim-cream-line)] p-4">
                <p className="text-sm font-medium text-[var(--sim-cream)]">{situation.stages[Math.max(0, stageIndex)]?.label}</p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--sim-cream-soft)]">{situation.stages[Math.max(0, stageIndex)]?.aim}</p>
                {situation.stages[Math.max(0, stageIndex)]?.questions.length ? (
                  <ul className="mt-2 space-y-1">
                    {situation.stages[Math.max(0, stageIndex)].questions.map((q) => (
                      <li key={q} className="text-sm text-[var(--sim-cream)]">
                        &ldquo;{q}&rdquo;
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </aside>
    ) : null;

  return (
    <div className={`sim ${figtree.className} fixed inset-0 z-[100]`} role="dialog" aria-modal="true" aria-label={`Practice call with ${client.name}`}>
      <div className="sim-room flex h-full flex-col">
        <header className="relative z-[3] flex items-center gap-4 px-4 pt-4 sm:px-8 sm:pt-6">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--sim-cream)]">{setup.replay ? "Trying that moment again" : situation.title}</p>
            <p className="text-xs text-[var(--sim-cream-faint)]">
              {setup.replay ? "Say your new line, see how it goes, then finish" : practice ? (tips ? "Tips on" : "Tips off") : "Certification · no tips"}
            </p>
          </div>
          {practice && !centre ? (
            <nav aria-label="Where you are" className="hidden items-center gap-[0.35rem] md:flex">
              {situation.stages.map((s, i) => (
                <span key={s.id} className="flex items-center gap-[0.35rem]">
                  {i > 0 ? <span className="sim-stage-link" aria-hidden /> : null}
                  {setup.canSkip && i > stageIndex ? (
                    <button
                      type="button"
                      className="sim-stage-pill transition hover:border-[var(--sim-cream)] hover:text-[var(--sim-cream)]"
                      onClick={() => void skipTo(s.id)}
                      disabled={phase !== "live"}
                      title={`Skip ahead to ${s.label}`}
                    >
                      {s.label}
                    </button>
                  ) : (
                    <span
                      className={`sim-stage-pill ${i === stageIndex ? "is-now" : live.covered.includes(s.id) ? "is-done" : i < stageIndex ? "is-skipped" : ""}`}
                      aria-current={i === stageIndex ? "step" : undefined}
                      title={i < stageIndex && !live.covered.includes(s.id) ? "Skipped so far" : undefined}
                    >
                      {s.label}
                    </span>
                  )}
                </span>
              ))}
            </nav>
          ) : null}
          <div className="flex flex-1 items-center justify-end gap-3">
            <span className="tabular-nums text-sm text-[var(--sim-cream-soft)]">
              {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
            </span>
            {setup.script ? (
              <button
                type="button"
                onClick={() => setScriptOpen((o) => !o)}
                aria-pressed={scriptOpen}
                className="sim-pill sim-pill-line !px-3 !py-2"
                aria-label={scriptOpen ? `Hide the ${setup.script.label.toLowerCase()}` : `Show the ${setup.script.label.toLowerCase()}`}
              >
                <FileText className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">{setup.script.label}</span>
              </button>
            ) : null}
            {practice ? (
              <button
                type="button"
                onClick={() => setPanelOpen((o) => !o)}
                aria-pressed={panelOpen}
                className="sim-pill sim-pill-line !px-3 !py-2"
                aria-label={panelOpen ? "Hide the help panel" : "Show the help panel"}
              >
                <Lightbulb className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Help</span>
              </button>
            ) : null}
          </div>
        </header>

        {practice ? (
          <p className="relative z-[3] mt-3 px-4 text-center text-xs font-medium uppercase tracking-[0.14em] text-[var(--sim-cream-soft)] md:hidden">
            {situation.stages[Math.max(0, stageIndex)]?.label}
          </p>
        ) : null}

        {centre ? (
          <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
            <div className="flex shrink-0 items-center gap-3 px-4 pb-3 lg:w-[260px] lg:flex-col lg:items-stretch lg:gap-0 lg:px-4 lg:pb-6">
              {/* Like the Scripts rail: the call's stages down the side, the current one filled. */}
              {practice ? (
                <nav aria-label="Where you are" className="hidden space-y-1 lg:block lg:pt-4">
                  {situation.stages.map((st, i) => {
                    const now = i === stageIndex;
                    const done = live.covered.includes(st.id);
                    const row = `flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                      now ? "bg-[var(--sim-cream)] text-[var(--sim-navy)]" : done ? "bg-[var(--sim-glass-strong)] text-[var(--sim-cream)]" : "text-[var(--sim-cream-soft)]"
                    }`;
                    const badge = (
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                          now ? "bg-[var(--sim-navy)] text-[var(--sim-cream)]" : done ? "bg-[var(--sim-cream)] text-[var(--sim-navy)]" : "ring-1 ring-[var(--sim-cream-line)]"
                        }`}
                      >
                        {done && !now ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
                      </span>
                    );
                    return setup.canSkip && i > stageIndex ? (
                      <button
                        key={st.id}
                        type="button"
                        className={`${row} hover:bg-[var(--sim-glass)] hover:text-[var(--sim-cream)]`}
                        onClick={() => void skipTo(st.id)}
                        disabled={phase !== "live"}
                        title={`Skip ahead to ${st.label}`}
                      >
                        {badge}
                        {st.label}
                      </button>
                    ) : (
                      <div key={st.id} className={row} aria-current={now ? "step" : undefined}>
                        {badge}
                        {st.label}
                      </div>
                    );
                  })}
                </nav>
              ) : null}
              <div className="contents lg:mt-auto lg:flex lg:flex-col lg:items-center lg:pt-6">
                <div ref={faceRef} className="sim-face aspect-square h-11 w-11 shrink-0 lg:h-auto lg:w-[min(18vh,160px)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={faceOf(client)} alt={client.name} />
                </div>
                <div className="min-w-0 lg:mt-4 lg:text-center">
                  <p className="truncate text-base font-light lg:text-2xl lg:tracking-[-0.02em]">{client.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[var(--sim-cream-soft)] lg:mt-2 lg:justify-center lg:text-sm">
                    {practice ? (
                      <span className="hidden rounded-full border border-[var(--sim-cream-line)] px-2.5 py-0.5 text-xs font-medium text-[var(--sim-cream)] lg:inline">
                        {level} · {client.personality}
                      </span>
                    ) : null}
                    <span aria-live="polite">{status}</span>
                  </p>
                  {caption && phase === "live" ? (
                    <p key={caption} className="sim-caption mt-4 hidden !text-base !leading-snug lg:block">
                      {caption}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
            <section className="sim-scroll min-h-0 min-w-0 flex-1 overflow-y-auto">{setup.script!.render({ lines: shownLines, stage: live.stage })}</section>
            {helpPanel}
          </div>
        ) : (
          <div className="relative flex min-h-0 flex-1">
            {setup.script && scriptOpen ? (
              <aside className="sim-scroll absolute inset-y-0 left-0 z-[4] w-[min(92vw,460px)] overflow-y-auto rounded-r-3xl lg:static lg:mb-6 lg:ml-6 lg:rounded-3xl">
                {setup.script.render({ lines: shownLines, stage: live.stage })}
              </aside>
            ) : null}
            <main className="flex min-w-0 flex-1 flex-col items-center justify-center px-6 pb-4">
              <div
                ref={faceRef}
                className={`sim-face aspect-square ${setup.script && scriptOpen && panelOpen ? "w-[min(30vh,280px)]" : "w-[min(58vw,340px)] sm:w-[min(40vh,360px)]"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={faceOf(client)} alt={client.name} />
              </div>
              <p className="mt-5 text-[clamp(1.6rem,3vw,2.4rem)] font-light tracking-[-0.02em]">{client.name}</p>
              <p className="mt-2 flex flex-wrap items-center justify-center gap-2 text-sm text-[var(--sim-cream-soft)]">
                {practice ? (
                  <span className="rounded-full border border-[var(--sim-cream-line)] px-2.5 py-0.5 text-xs font-medium text-[var(--sim-cream)]">
                    {level} · {client.personality}
                  </span>
                ) : null}
                <span aria-live="polite">{status}</span>
              </p>
              {setup.replay ? (
                <p className="mt-4 max-w-xl text-center text-sm leading-relaxed text-[var(--sim-cream-soft)]">
                  Last time you said: &ldquo;{setup.replay.firstTry}&rdquo;
                </p>
              ) : null}
              <div className="mt-6 min-h-[4.5em] max-w-2xl text-center">
                {caption && phase === "live" ? (
                  <p key={caption} className="sim-caption">
                    {caption}
                  </p>
                ) : null}
              </div>
            </main>

            {helpPanel}
          </div>
        )}

        <footer className="relative z-[3] flex flex-wrap items-center justify-center gap-3 px-4 pb-6 sm:pb-8">
          <div ref={micRef} className="sim-mic">
            <button
              type="button"
              onClick={() => setMuted(!isMuted)}
              aria-pressed={isMuted}
              aria-label={isMuted ? "Unmute your microphone" : "Mute your microphone"}
              className="grid h-full w-full place-items-center rounded-full text-[var(--sim-cream)]"
              disabled={phase !== "live"}
            >
              {isMuted ? <MicOff className="h-4 w-4" aria-hidden /> : <Mic className="h-4 w-4" aria-hidden />}
            </button>
          </div>
          <button type="button" className="sim-pill sim-pill-line" onClick={pause} disabled={phase !== "live"} title="Pause (space bar)">
            <Pause className="h-4 w-4" aria-hidden />
            Pause
          </button>
          <button
            type="button"
            className="sim-pill sim-pill-solid"
            onClick={() => setPhaseBoth("confirm-end")}
            disabled={phase === "scoring" || phase === "confirm-end"}
          >
            <PhoneOff className="h-4 w-4" aria-hidden />
            {setup.replay ? "Finish the replay" : practice ? "End and get feedback" : "End session"}
          </button>
        </footer>
      </div>

      {phase === "timeout" ? (
        <Overlay>
          <p className="text-kicker font-semibold uppercase text-[var(--sim-cream-faint)]">Paused</p>
          <p className="mt-2 text-subhead font-light">{client.firstName} won&rsquo;t say anything until you&rsquo;re back.</p>
          {shownLines.length ? (
            <div className="mt-4 space-y-2 text-sm leading-snug">
              {[...shownLines].reverse().find((l) => l.role === "client") ? (
                <p className="text-[var(--sim-cream-soft)]">
                  <span className="text-[var(--sim-cream-faint)]">{client.firstName}: </span>&ldquo;{[...shownLines].reverse().find((l) => l.role === "client")!.text}&rdquo;
                </p>
              ) : null}
              {[...shownLines].reverse().find((l) => l.role === "coach") ? (
                <p className="text-[var(--sim-cream-soft)]">
                  <span className="text-[var(--sim-cream-faint)]">You: </span>&ldquo;{[...shownLines].reverse().find((l) => l.role === "coach")!.text}&rdquo;
                </p>
              ) : null}
            </div>
          ) : null}
          {note ? (
            <div className="mt-3 space-y-4">
              <p className="text-read leading-relaxed text-[var(--sim-cream)]">{note.working}</p>
              <p className="text-read leading-relaxed text-[var(--sim-cream)]">{note.next}</p>
              <p className="rounded-2xl bg-[var(--sim-glass-strong)] px-4 py-3 text-read leading-relaxed">
                <span className="block text-xs font-medium text-[var(--sim-cream-faint)]">Try asking</span>
                &ldquo;{note.ask.trim().replace(/^["'\u201c]+|["'\u201d]+$/g, "")}&rdquo;
              </p>
            </div>
          ) : noteError ? (
            <p className="mt-3 text-[var(--sim-amber)]">{noteError}</p>
          ) : noteLoading ? (
            <p className="mt-4 flex items-center gap-2 text-[var(--sim-cream-soft)]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Looking at how it&rsquo;s going…
            </p>
          ) : practice ? (
            <button type="button" className="sim-pill sim-pill-line mt-4" onClick={() => void askHelp()}>
              <Lightbulb className="h-4 w-4" aria-hidden /> How am I doing?
            </button>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-2">
            <button type="button" className="sim-pill sim-pill-solid" onClick={() => void resume()}>
              <Play className="h-4 w-4" aria-hidden /> Back to the call
            </button>
            <button type="button" className="sim-pill sim-pill-line" onClick={() => void finish()}>
              End and get feedback
            </button>
            {mode !== "assessment" ? (
              <button type="button" className="sim-pill sim-pill-line" onClick={() => void discard()}>
                End without saving
              </button>
            ) : null}
          </div>
          <p className="mt-3 text-xs text-[var(--sim-cream-faint)]">When you&rsquo;re back, {client.firstName} waits for you to speak first.</p>
        </Overlay>
      ) : null}

      {phase === "confirm-end" ? (
        <Overlay>
          <p className="text-subhead font-light">End the session?</p>
          <p className="mt-2 text-sm text-[var(--sim-cream-soft)]">
            {practice ? "You'll get your score and a report straight after." : "This counts as your certification session."}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" className="sim-pill sim-pill-solid" onClick={() => void finish()}>
              Yes, end it
            </button>
            <button type="button" className="sim-pill sim-pill-line" onClick={() => setPhaseBoth("live")}>
              Keep going
            </button>
            {mode !== "assessment" ? (
              <button type="button" className="sim-pill sim-pill-line" onClick={() => void discard()}>
                End without saving
              </button>
            ) : null}
          </div>
        </Overlay>
      ) : null}

      {phase === "dropped" || phase === "error" ? (
        <Overlay>
          <p className="text-subhead font-light">{phase === "dropped" ? "The call dropped" : "The call couldn't connect"}</p>
          <p className="mt-2 text-sm text-[var(--sim-cream-soft)]">
            {error ?? `${client.firstName} remembers everything so far. Pick up where you left off, or end and get your feedback.`}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" className="sim-pill sim-pill-solid" onClick={() => void resume()}>
              Reconnect
            </button>
            <button type="button" className="sim-pill sim-pill-line" onClick={() => void finish()}>
              End and get feedback
            </button>
          </div>
        </Overlay>
      ) : null}

      {phase === "scoring" ? (
        <div className="sim-room fixed inset-0 z-[101] grid place-items-center p-6">
          <div className="relative z-[2]">
            <AiWorking {...(setup.scoring ?? scoringSteps(setup))} />
          </div>
        </div>
      ) : null}

      {phase === "too-short" ? (
        <Overlay>
          <p className="text-subhead font-light">Too short to score</p>
          <p className="mt-2 text-sm text-[var(--sim-cream-soft)]">Talk with {client.firstName} for a few minutes, then end it to get a report.</p>
          <div className="mt-5">
            <button type="button" className="sim-pill sim-pill-solid" onClick={onDropped}>
              Back
            </button>
          </div>
        </Overlay>
      ) : null}
    </div>
  );
}

/** What the scoring screen says it's doing. Certification is scored twice and averaged. */
export function scoringSteps(setup: { mode: SimMode; replay?: unknown }): { title: string; steps: string[]; seconds: number } {
  if (setup.replay) return { title: "Checking your second try", steps: ["Reading both tries", "Comparing them", "Writing a note"], seconds: 8 };
  const one = ["Reading the whole call", "Scoring the five stages", "Scoring the POWER skills", "Writing notes beside your lines"];
  return setup.mode === "assessment"
    ? { title: "Two examiners are scoring your session", steps: [...one.slice(0, 1), "First examiner scoring", "Second examiner scoring", "Comparing the two", "Writing notes beside your lines"], seconds: 45 }
    : { title: "Scoring your session", steps: one, seconds: 30 };
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[101] grid place-items-center bg-[rgba(4,16,30,0.55)] p-4">
      <div className="sim-glass w-full max-w-md rounded-3xl bg-[rgba(8,28,48,0.82)] p-6 text-[var(--sim-cream)] shadow-2xl">{children}</div>
    </div>
  );
}
