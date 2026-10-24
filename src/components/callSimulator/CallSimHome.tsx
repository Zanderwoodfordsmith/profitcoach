"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, ChevronDown, Lightbulb, Loader2, Shuffle } from "lucide-react";

import { figtree } from "@/fonts";
import { CALLS, CALL_GROUPS, callById, callFacts, callHelp, sessionParts } from "@/lib/callSimulator/calls";
import { MAX_OBJECTIONS, objectionList, surpriseObjections } from "@/lib/callSimulator/objections";
import { PROSPECTS, prospectById } from "@/lib/callSimulator/prospects";
import { callBrief, callCue } from "@/lib/callSimulator/prompt";
import { callScript } from "@/lib/callSimulator/script";
import type { CallId, CallSessionSummary } from "@/lib/callSimulator/types";
import { DIFFICULTIES } from "@/lib/simulator/difficulty";
import type { CallStart, Difficulty } from "@/lib/simulator/types";

import { SimCall, type SimCallSetup } from "@/components/simulator/SimCall";

import { CallScript } from "./CallScript";
import { Cast, QUICK_PACE, Trend, readPace, setPace, subscribePace } from "@/components/simulator/SimulatorHome";
import { formatSimDate, useSimApi, useSimPrefix } from "@/components/simulator/simApi";
import "@/components/simulator/sim.css";

type HomeData = { configured: boolean; sessions: CallSessionSummary[] };

const OUTCOME_LABEL = { won: "Won", step: "Next step", lost: "No" } as const;

/**
 * Get Clients → Scripts → Call simulator. The Client simulator's room with
 * the same six owners as prospects: pick a face, a call, where to start (or
 * the objections to face) and a level, then start. History sits underneath.
 */
export function CallSimHome() {
  const api = useSimApi();
  const prefix = useSimPrefix();
  const router = useRouter();
  const params = useSearchParams();
  const [data, setData] = useState<HomeData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [index, setIndex] = useState(() => Math.max(0, PROSPECTS.findIndex((c) => c.id === params.get("prospect"))));
  const [callId, setCallId] = useState<CallId>(() => callById(params.get("call") ?? "")?.id ?? "review");
  const [startPart, setStartPart] = useState<string | null>(() => params.get("from"));
  const [objections, setObjections] = useState<string[]>(() => (params.get("objections") ?? "").split(",").filter(Boolean));
  const [difficulty, setDifficulty] = useState<Difficulty>(() => {
    const d = params.get("level");
    return d === "easy" || d === "hard" ? d : "medium";
  });
  const [tips, setTips] = useState(true);
  // The script runs across the middle of the call; ?script=side keeps the first version, a white page beside the face.
  const scriptSide = params.get("script") === "side";
  const quick = useSyncExternalStore(subscribePace, readPace, () => false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [live, setLive] = useState<SimCallSetup | null>(null);
  // The coach's price (Blueprint) and first name, for the script panel's fill-ins.
  const [mine, setMine] = useState({ price: "", me: "" });

  async function load() {
    const res = await api<HomeData>("/api/coach/call-simulator");
    if (res.ok) setData(res.data);
    else setLoadError(res.error);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await api<HomeData>("/api/coach/call-simulator");
      if (cancelled) return;
      if (res.ok) setData(res.data);
      else setLoadError(res.error);
      const ctx = await api<{ price?: string; name?: string }>("/api/coach/sales-call/context");
      if (cancelled || !ctx.ok) return;
      setMine({ price: typeof ctx.data.price === "string" ? ctx.data.price : "", me: ctx.data.name?.trim().split(/\s+/)[0] ?? "" });
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  const prospect = PROSPECTS[index];
  const call = callById(callId)!;
  const from = call.startable && call.parts.some((p) => p.id === startPart) ? startPart : null;
  const picked = call.drill ? objections.filter((id) => objectionList(call.drill!).some((o) => o.id === id)) : [];
  const brief = callBrief(call, prospect, difficulty, from);
  const scored = useMemo(() => (data?.sessions ?? []).filter((s) => s.status === "scored"), [data]);
  const blocked = call.drill && !picked.length ? "Pick the objections to face, or Surprise me." : null;

  function chooseCall(id: CallId) {
    setCallId(id);
    setStartPart(null);
    const next = callById(id)!;
    if (next.drill) setObjections(surpriseObjections(next.drill));
  }

  function surprise() {
    const recent = scored.slice(0, 5);
    const average = recent.length ? recent.reduce((s, x) => s + (x.score ?? 0), 0) / recent.length : 0;
    setDifficulty(!recent.length || average < 55 ? "easy" : average < 75 ? "medium" : "hard");
    let next = Math.floor(Math.random() * PROSPECTS.length);
    if (next === index) next = (next + 1) % PROSPECTS.length;
    setIndex(next);
    const pick = CALLS[Math.floor(Math.random() * CALLS.length)];
    setCallId(pick.id);
    setStartPart(pick.startable && Math.random() < 0.5 ? pick.parts[1 + Math.floor(Math.random() * (pick.parts.length - 1))].id : null);
    if (pick.drill) setObjections(surpriseObjections(pick.drill));
  }

  async function start() {
    setStarting(true);
    setStartError(null);
    const res = await api<{ id: string; call: CallStart }>("/api/coach/call-simulator/sessions", {
      method: "POST",
      body: { prospectId: prospect.id, callId: call.id, difficulty, tips, startPart: from, objections: picked },
    });
    setStarting(false);
    if (!res.ok) {
      setStartError(res.error);
      return;
    }
    const parts = sessionParts(call, { startPart: from, objections: picked });
    const pages = callScript(call, { startPart: from, objections: picked });
    setLive({
      id: res.data.id,
      call: res.data.call,
      client: prospect,
      situation: { title: call.title, stages: parts },
      difficulty,
      tips,
      mode: "practice",
      pace: quick ? QUICK_PACE : 1,
      apiBase: "/api/coach/call-simulator/sessions",
      facts: callFacts(call, prospect, difficulty),
      help: callHelp(call),
      cue: callCue(call, prospect, from),
      canSkip: Boolean(call.startable),
      script: {
        label: "Script",
        layout: scriptSide ? "side" : "centre",
        render: ({ lines, stage }) => (
          <CallScript call={call} prospect={prospect} pages={pages} lines={lines} stage={stage} price={mine.price} me={mine.me} look={scriptSide ? "paper" : "glass"} />
        ),
      },
      scoring: {
        title: "Scoring your call",
        steps: ["Reading the whole call", call.drill ? "Scoring each objection" : "Scoring each part", "Scoring the five sales skills", "Writing notes beside your lines"],
        seconds: 30,
      },
    });
  }

  return (
    <div className={`sim ${figtree.className} pb-16`}>
      <section className="sim-room mx-auto mt-6 w-full max-w-[1280px] rounded-[2rem] px-5 pb-8 pt-6 sm:px-10 sm:pt-8">
        <header className="relative z-[2] flex flex-wrap items-center justify-between gap-3">
          <Link href={`${prefix}/script`} className="inline-flex items-center gap-1.5 text-sm font-medium tracking-[0.02em] text-[var(--sim-cream-soft)] hover:text-[var(--sim-cream)]">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Call simulator
          </Link>
          <button type="button" className="sim-pill sim-pill-solid" onClick={surprise}>
            <Shuffle className="h-4 w-4" aria-hidden />
            Surprise me
          </button>
        </header>

        <Cast index={index} onPick={setIndex} onStep={(d) => setIndex((i) => (i + d + PROSPECTS.length) % PROSPECTS.length)} used={null} people={PROSPECTS} />

        {/* Above the faces (z 10), so the call menu opens over them. */}
        <div className="relative z-[30] mt-2 border-t border-[var(--sim-cream-line)] pt-7">
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto_1fr]">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--sim-cream-soft)]">
                {prospect.name}, {prospect.age} · {prospect.business}, {prospect.place} · {prospect.personality}
              </p>
              <p className="mt-2 text-[clamp(1.6rem,2.6vw,2.4rem)] font-light leading-[1.12] tracking-[-0.02em]">
                {call.title} with {prospect.firstName}
              </p>
              <p className="mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-[var(--sim-cream-soft)]">{brief.setup}</p>
              {brief.sofar.length ? (
                <div className="mt-4">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[var(--sim-cream-faint)]">
                    {call.id === "roadmap" || call.id === "close-objections" ? "Your notes from the review" : from ? "Earlier in the call" : "Your notes"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {brief.sofar.map((line) => (
                      <span key={line} className="sim-fact">
                        {line}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="sim-start-wrap">
                <span className="sim-orbit" aria-hidden />
                <button type="button" className="sim-start" disabled={starting || !data?.configured || Boolean(blocked)} onClick={() => void start()}>
                  {starting ? <Loader2 className="mx-auto h-5 w-5 animate-spin" aria-label="Starting" /> : "Start"}
                </button>
              </div>
              <p className="text-center text-xs text-[var(--sim-cream-faint)]">
                {DIFFICULTIES.find((d) => d.id === difficulty)?.label} · about {call.minutes} minutes · uses your microphone
              </p>
            </div>

            <div className="flex min-w-0 flex-col gap-4 lg:items-end">
              <CallMenu value={callId} onChange={chooseCall} />
              {call.startable ? (
                <div className="w-full max-w-sm">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[var(--sim-cream-faint)] lg:text-right">Start at</p>
                  <div className="mt-2 flex flex-wrap gap-1.5 lg:justify-end" role="group" aria-label="Start at">
                    {call.parts.map((p, i) => {
                      const on = (from ?? call.parts[0].id) === p.id;
                      return (
                        <button key={p.id} type="button" aria-pressed={on} onClick={() => setStartPart(i === 0 ? null : p.id)} className={`sim-chip ${on ? "is-on" : ""}`}>
                          {i === 0 ? "The whole call" : p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              {call.drill ? (
                <ObjectionPicker kind={call.drill} value={picked} onChange={setObjections} />
              ) : null}
              <div className="sim-seg" role="group" aria-label="Level">
                {DIFFICULTIES.map((d) => (
                  <button key={d.id} type="button" aria-pressed={difficulty === d.id} onClick={() => setDifficulty(d.id)} title={d.line}>
                    {d.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 text-sm text-[var(--sim-cream-soft)]">
                Voice speed
                <div className="sim-seg" role="group" aria-label="Voice speed">
                  <button type="button" aria-pressed={!quick} onClick={() => setPace(false)}>
                    Normal
                  </button>
                  <button type="button" aria-pressed={quick} onClick={() => setPace(true)}>
                    Quick
                  </button>
                </div>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm text-[var(--sim-cream-soft)]">
                <Lightbulb className="h-4 w-4" aria-hidden />
                Tips during the call
                <input type="checkbox" className="peer sr-only" checked={tips} onChange={(e) => setTips(e.target.checked)} />
                <span className="relative h-5 w-9 rounded-full bg-[var(--sim-cream-line)] transition peer-checked:bg-[var(--sim-cream)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--sim-cream)] after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-[var(--sim-navy)] after:transition peer-checked:after:translate-x-4" />
              </label>
            </div>
          </div>
          {blocked || startError || (data && !data.configured) || loadError ? (
            <p className="mt-5 text-center text-sm text-[var(--sim-amber)]" role="status">
              {blocked ?? startError ?? loadError ?? "Voice isn't set up on this server yet."}
            </p>
          ) : null}
        </div>
      </section>

      <div className="mx-auto mt-10 w-full max-w-[1280px] px-1">
        <History sessions={data?.sessions ?? null} prefix={prefix} />
      </div>

      {live ? (
        <SimCall
          setup={live}
          onDone={(id) => router.push(`${prefix}/script/simulator/${id}`)}
          onDropped={() => {
            setLive(null);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}

function CallMenu({ value, onChange }: { value: CallId; onChange: (id: CallId) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = callById(value)!;

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative w-full max-w-sm">
      <button
        type="button"
        className="sim-pill sim-pill-line w-full justify-between !py-3 text-left"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[var(--sim-cream-faint)]">
            {CALL_GROUPS.find((g) => g.id === current.group)?.title}
          </span>
          <span className="mt-1 block truncate">{current.title}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label="What to practise"
          className="sim-glass sim-scroll absolute bottom-full right-0 z-30 mb-2 max-h-[min(70vh,560px)] w-[min(92vw,420px)] overflow-y-auto rounded-2xl bg-[rgba(8,28,48,0.96)] p-2 shadow-2xl"
        >
          {CALL_GROUPS.map((g) => (
            <div key={g.id} className="py-1">
              <p className="px-3 pb-1 pt-2 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[var(--sim-cream-faint)]">{g.title}</p>
              {CALLS.filter((c) => c.group === g.id).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={c.id === value}
                  onClick={() => {
                    onChange(c.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-[var(--sim-glass-strong)] ${c.id === value ? "bg-[var(--sim-glass-strong)]" : ""}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.9375rem] font-medium text-[var(--sim-cream)]">{c.title}</span>
                    <span className="mt-0.5 block text-[0.8125rem] leading-snug text-[var(--sim-cream-soft)]">{c.line}</span>
                  </span>
                  <span className="shrink-0 pt-0.5 text-xs text-[var(--sim-cream-faint)]">{c.minutes} min</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Up to four objections, raised in the order picked. Surprise me deals three or four at random. */
function ObjectionPicker({ kind, value, onChange }: { kind: "booking" | "close"; value: string[]; onChange: (ids: string[]) => void }) {
  const list = objectionList(kind);
  return (
    <div className="w-full max-w-sm">
      <div className="flex items-center justify-between gap-3 lg:justify-end">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[var(--sim-cream-faint)]">
          Objections · {value.length} of up to {MAX_OBJECTIONS}, in order
        </p>
        <button type="button" onClick={() => onChange(surpriseObjections(kind))} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--sim-cream)] hover:underline">
          <Shuffle className="h-3.5 w-3.5" aria-hidden /> Surprise me
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 lg:justify-end" role="group" aria-label="Objections to face">
        {list.map((o) => {
          const at = value.indexOf(o.id);
          const full = at < 0 && value.length >= MAX_OBJECTIONS;
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={at >= 0}
              disabled={full}
              title={`"${o.says}"`}
              onClick={() => onChange(at >= 0 ? value.filter((id) => id !== o.id) : [...value, o.id])}
              className={`sim-chip ${at >= 0 ? "is-on" : ""}`}
            >
              {at >= 0 ? <span className="tabular-nums opacity-70">{at + 1}</span> : null}
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function History({ sessions, prefix }: { sessions: CallSessionSummary[] | null; prefix: string }) {
  const done = (sessions ?? []).filter((s) => s.status === "scored" || s.status === "scoring");
  const scores = done.filter((s) => s.score !== null).slice(0, 12).reverse().map((s) => s.score ?? 0);
  return (
    <section>
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Your calls</h2>
        {scores.length > 1 ? <Trend scores={scores} range={[40, 80]} /> : null}
      </div>
      {sessions === null ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading
        </p>
      ) : done.length === 0 ? (
        <p className="mt-4 max-w-md text-[0.9375rem] leading-relaxed text-slate-600">
          Your practice calls show up here, each with a score, how the call ended, and a report you can come back to.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {done.map((s) => {
            const p = prospectById(s.prospect_id);
            const c = callById(s.call_id);
            const fromPart = s.start_part ? c?.parts.find((x) => x.id === s.start_part)?.label : null;
            return (
              <li key={s.id}>
                <Link href={`${prefix}/script/simulator/${s.id}`} className="flex items-center gap-4 px-4 py-3 transition hover:bg-slate-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p?.face} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.9375rem] font-medium text-slate-900">
                      {p?.firstName} · {c?.title}
                      {fromPart ? ` · from ${fromPart}` : ""}
                    </span>
                    <span className="block text-[0.8125rem] text-slate-500">
                      {formatSimDate(s.started_at)} · {DIFFICULTIES.find((d) => d.id === s.difficulty)?.label}
                      {s.outcome ? ` · ${OUTCOME_LABEL[s.outcome]}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    {s.score !== null ? (
                      <span className="inline-flex items-center gap-1 text-lg font-semibold tabular-nums text-slate-900">
                        {s.outcome === "won" ? <Check className="h-4 w-4 text-emerald-600" aria-label="Won" /> : null}
                        {s.score}
                        <span className="text-sm font-normal text-slate-400">%</span>
                      </span>
                    ) : (
                      <span className="text-sm text-slate-500">Scoring…</span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
