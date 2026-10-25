"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, Check, ChevronDown, ChevronLeft, ChevronRight, ImagePlus, Lightbulb, Loader2, Plus, Shuffle, Target, Trash2, Trophy } from "lucide-react";

import { figtree } from "@/fonts";
import { CLIENTS, clientById } from "@/lib/simulator/clients";
import { DIFFICULTIES } from "@/lib/simulator/difficulty";
import { faceOf, isCustomId } from "@/lib/simulator/faces";
import { SITUATIONS, SITUATION_GROUPS, situationById } from "@/lib/simulator/situations";
import type { CallStart, Difficulty, SimAssessmentRow, SimClient, SimSessionRow } from "@/lib/simulator/types";

import { CreateClient } from "./CreateClient";
import { SimCall, type SimCallSetup } from "./SimCall";
import { formatSimDate, useSimApi, useSimPrefix } from "./simApi";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import "./sim.css";

/** Quick raises every voice about 12 per cent (ElevenLabs caps speed at 1.2). */
export const QUICK_PACE = 1.12;
const PACE_KEY = "simulator:pace";
const paceListeners = new Set<() => void>();
let paceFallback = false;
export function subscribePace(listener: () => void) {
  paceListeners.add(listener);
  return () => paceListeners.delete(listener);
}
export function readPace(): boolean {
  try {
    return window.localStorage.getItem(PACE_KEY) === "quick";
  } catch {
    return paceFallback;
  }
}
/** Voice speed, remembered in this browser and shared by both simulators. */
export function setPace(next: boolean) {
  try {
    window.localStorage.setItem(PACE_KEY, next ? "quick" : "normal");
  } catch {
    /* private window: the choice lasts until the page closes */
    paceFallback = next;
  }
  paceListeners.forEach((l) => l());
}

type Summary = Omit<SimSessionRow, "transcript" | "live" | "conversation_ids" | "report">;
type WeakSpot = { id: string; label: string; average: number; sessions: number; clientId: string };
type HomeData = {
  configured: boolean;
  sessions: Summary[];
  customClients: SimClient[];
  weakSpot: WeakSpot | null;
  minutes: { used: number; limit: number | null };
  assessment: (SimAssessmentRow & { sessions: Summary[] }) | null;
  passMark: number;
  assessmentSessions: number;
};

/**
 * Keep Clients → Client simulator. One screen: pick a face, a session and a
 * level, then start. Coaches can make their own clients and practise with
 * other coaches' shared ones. Past sessions, the weak spot and certification
 * sit underneath.
 */
export function SimulatorHome() {
  const api = useSimApi();
  const prefix = useSimPrefix();
  const router = useRouter();
  const params = useSearchParams();
  const [data, setData] = useState<HomeData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState(() => params.get("client") ?? CLIENTS[0].id);
  // Shared clients join the faces once picked from "From other coaches".
  const [picked, setPicked] = useState<string[]>([]);
  const [situationId, setSituationId] = useState(() => situationById(params.get("situation") ?? "")?.id ?? "coaching");
  const [difficulty, setDifficulty] = useState<Difficulty>(() => {
    const d = params.get("level");
    return d === "easy" || d === "hard" ? d : "medium";
  });
  const [tips, setTips] = useState(true);
  const [focus, setFocus] = useState<WeakSpot | null>(null);
  // Voice speed, remembered in this browser. Quick lets coaches fit in more practice.
  const quick = useSyncExternalStore(subscribePace, readPace, () => false);
  const choosePace = setPace;
  const [certifying, setCertifying] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [call, setCall] = useState<SimCallSetup | null>(null);
  const [creating, setCreating] = useState<false | "new" | SimClient>(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await api<HomeData>("/api/coach/simulator");
    if (res.ok) setData(res.data);
    else setLoadError(res.error);
  }, [api]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await api<HomeData>("/api/coach/simulator");
      if (cancelled) return;
      if (res.ok) setData(res.data);
      else setLoadError(res.error);
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  const custom = useMemo(() => data?.customClients ?? [], [data]);
  const shared = useMemo(() => custom.filter((c) => !c.custom?.mine), [custom]);
  const people = useMemo(
    () => [...CLIENTS, ...custom.filter((c) => c.custom?.mine), ...shared.filter((c) => picked.includes(c.id) || c.id === selectedId)],
    [custom, shared, picked, selectedId]
  );
  const who = useCallback((id: string) => people.find((c) => c.id === id) ?? custom.find((c) => c.id === id) ?? clientById(id), [people, custom]);
  const index = Math.max(0, people.findIndex((c) => c.id === selectedId));
  const client = people[index];
  const mineCustom = client.custom?.mine ? client.custom : null;
  const draft = client.custom?.status === "draft";
  const situation = situationById(situationId)!;
  const scored = useMemo(() => (data?.sessions ?? []).filter((s) => s.status === "scored"), [data]);
  const metClients = useMemo(() => new Set(scored.map((s) => s.client_id)), [scored]);
  const assessment = data?.assessment ?? null;
  const certOpen = assessment?.status === "in_progress";
  const certDone = (assessment?.sessions ?? []).filter((s) => s.status === "scored");
  const certUsed = new Set(certDone.map((s) => s.client_id));
  const certNeedsHard = certOpen && certDone.length === (data?.assessmentSessions ?? 3) - 1 && !certDone.some((s) => s.difficulty === "hard");
  const minutesLeft = data?.minutes.limit ? Math.max(0, data.minutes.limit - data.minutes.used) : null;

  // Certification is always a coaching session, no tips, and Hard when it's the last chance.
  const effectiveSituation = certifying ? "coaching" : situationId;
  const effectiveDifficulty: Difficulty = certifying && certNeedsHard ? "hard" : difficulty;
  const blocked = draft
    ? `Check ${client.firstName} and confirm them first.`
    : minutesLeft === 0
      ? "You've used this month's practice minutes. They reset on the 1st."
      : certifying
        ? certUsed.has(client.id)
          ? `You've already done ${client.firstName}. Pick someone else.`
          : null
        : situation.needsPrevious && !metClients.has(client.id)
          ? `Do a session with ${client.firstName} first.`
          : null;

  function pick(id: string) {
    setSelectedId(id);
    setFocus(null);
  }

  function go(delta: number) {
    pick(people[(index + delta + people.length) % people.length].id);
  }

  function surprise() {
    const average = scored.length ? scored.slice(0, 5).reduce((s, x) => s + (x.score ?? 0), 0) / Math.min(5, scored.length) : 0;
    const level: Difficulty = !scored.length || average < 25 ? "easy" : average < 36 ? "medium" : "hard";
    const pool = SITUATIONS.filter((s) => !s.needsPrevious);
    const next = data?.weakSpot && Math.random() < 0.5 ? data.weakSpot.clientId : CLIENTS[Math.floor(Math.random() * CLIENTS.length)].id;
    pick(next === selectedId ? CLIENTS[(CLIENTS.findIndex((c) => c.id === next) + 1) % CLIENTS.length].id : next);
    setSituationId(Math.random() < 0.5 ? "coaching" : pool[Math.floor(Math.random() * pool.length)].id);
    setDifficulty(level);
  }

  function practiseWeakSpot(w: WeakSpot) {
    setCertifying(false);
    setSelectedId(w.clientId);
    setSituationId("coaching");
    setDifficulty("medium");
    setFocus(w);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function start() {
    setStarting(true);
    setStartError(null);
    const res = await api<{ id: string; call: CallStart }>("/api/coach/simulator/sessions", {
      method: "POST",
      body: {
        clientId: client.id,
        situationId: effectiveSituation,
        difficulty: effectiveDifficulty,
        tips: certifying ? false : tips,
        mode: certifying ? "assessment" : "practice",
        focus: !certifying && focus ? focus.id : undefined,
      },
    });
    setStarting(false);
    if (!res.ok) {
      setStartError(res.error);
      return;
    }
    setCall({
      id: res.data.id,
      call: res.data.call,
      client,
      situation: situationById(effectiveSituation)!,
      difficulty: effectiveDifficulty,
      tips: certifying ? false : tips,
      mode: certifying ? "assessment" : "practice",
      pace: quick ? QUICK_PACE : 1,
    });
  }

  async function beginCertification() {
    const res = await api<{ assessment: SimAssessmentRow }>("/api/coach/simulator/assessment", { method: "POST" });
    if (!res.ok) {
      setStartError(res.error);
      return;
    }
    await load();
    setCertifying(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function updateMine(body: Record<string, unknown>) {
    if (!mineCustom) return;
    setBusy(true);
    await api(`/api/coach/simulator/custom/${mineCustom.rowId}`, { method: "PATCH", body });
    await load();
    setBusy(false);
  }

  async function deleteMine() {
    if (!mineCustom || !window.confirm(`Delete ${client.name}? Past sessions with them keep their reports.`)) return;
    setBusy(true);
    await api(`/api/coach/simulator/custom/${mineCustom.rowId}`, { method: "DELETE" });
    setSelectedId(CLIENTS[0].id);
    await load();
    setBusy(false);
  }

  async function makeFace() {
    if (!mineCustom) return;
    setBusy(true);
    const res = await api<{ face: string }>(`/api/coach/simulator/custom/${mineCustom.rowId}/face`, { method: "POST" });
    if (!res.ok) setStartError(res.error);
    await load();
    setBusy(false);
  }

  return (
    <div className={`sim ${figtree.className} pb-16`}>
      <section className="sim-room mx-auto mt-6 w-full max-w-[1280px] rounded-[2rem] px-5 pb-8 pt-6 sm:px-10 sm:pt-8">
        <header className="relative z-[2] flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium tracking-[0.02em] text-[var(--sim-cream-soft)]">
            {certifying ? (
              <span className="inline-flex items-center gap-2">
                <Trophy className="h-4 w-4" aria-hidden />
                Certification · session {Math.min(certDone.length + 1, data?.assessmentSessions ?? 3)} of {data?.assessmentSessions ?? 3}
              </span>
            ) : (
              "Client simulator"
            )}
          </p>
          <div className="flex items-center gap-2">
            {certifying ? (
              <button type="button" className="sim-pill sim-pill-line" onClick={() => setCertifying(false)}>
                Back to practice
              </button>
            ) : (
              <>
                <button type="button" className="sim-pill sim-pill-line" onClick={() => setCreating("new")}>
                  <Plus className="h-4 w-4" aria-hidden />
                  Create your own
                </button>
                <button type="button" className="sim-pill sim-pill-solid" onClick={surprise}>
                  <Shuffle className="h-4 w-4" aria-hidden />
                  Surprise me
                </button>
              </>
            )}
          </div>
        </header>

        <Cast index={index} onPick={(i) => pick(people[i].id)} onStep={go} used={certifying ? certUsed : null} people={people} />

        {/* Above the faces (z 10), so the session menu opens over them. */}
        <div className="relative z-[30] mt-2 border-t border-[var(--sim-cream-line)] pt-7">
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto_1fr]">
            <div className="min-w-0">
              {client.custom ? (
                <p className="mb-2 flex flex-wrap gap-1.5">
                  <span className="sim-chip is-on">{client.custom.mine ? "Your client" : `Shared by ${client.custom.ownerName ?? "a coach"}`}</span>
                  {client.custom.isReal ? <span className="sim-chip">Based on a real situation</span> : null}
                  {draft ? <span className="sim-chip">Draft</span> : null}
                </p>
              ) : null}
              <p className="text-sm font-medium text-[var(--sim-cream-soft)]">
                {client.name}, {client.age} · {client.business}, {client.place} · {client.personality}
              </p>
              <p className="mt-2 text-[clamp(1.6rem,2.6vw,2.4rem)] font-light leading-[1.12] tracking-[-0.02em]">{client.line}</p>
              <p className="mt-3 max-w-xl text-read leading-relaxed text-[var(--sim-cream-soft)]">{client.brief}</p>
              {mineCustom ? (
                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-[var(--sim-cream-soft)]">
                  {draft ? (
                    <button type="button" className="sim-pill sim-pill-solid !py-2" onClick={() => setCreating(client)}>
                      Check and confirm
                    </button>
                  ) : (
                    <label className="inline-flex cursor-pointer items-center gap-2.5">
                      Share with other coaches
                      <input type="checkbox" className="peer sr-only" checked={mineCustom.shared} disabled={busy} onChange={(e) => void updateMine({ shared: e.target.checked })} />
                      <span className="relative h-5 w-9 rounded-full bg-[var(--sim-cream-line)] transition peer-checked:bg-[var(--sim-cream)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--sim-cream)] after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-[var(--sim-navy)] after:transition peer-checked:after:translate-x-4" />
                    </label>
                  )}
                  {!client.face && !draft ? (
                    <button type="button" className="sim-pill sim-pill-line !py-2" disabled={busy} onClick={() => void makeFace()}>
                      <ImagePlus className="h-4 w-4" aria-hidden /> Make a face
                    </button>
                  ) : null}
                  <button type="button" className="sim-pill sim-pill-line !py-2" disabled={busy} onClick={() => void deleteMine()} aria-label={`Delete ${client.name}`}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="sim-start-wrap">
                <span className="sim-orbit" aria-hidden />
                <button
                  type="button"
                  className="sim-start"
                  disabled={starting || !data?.configured || Boolean(blocked)}
                  onClick={() => void start()}
                >
                  {starting ? <Loader2 className="mx-auto h-5 w-5 animate-spin" aria-label="Starting" /> : "Start"}
                </button>
              </div>
              <p className="text-center text-xs text-[var(--sim-cream-faint)]">
                {DIFFICULTIES.find((d) => d.id === effectiveDifficulty)?.label} · about {situationById(effectiveSituation)?.minutes} minutes · uses your microphone
              </p>
              {focus && !certifying ? (
                <p className="flex items-center gap-1.5 text-xs text-[var(--sim-cream)]">
                  <Target className="h-3.5 w-3.5" aria-hidden /> Tips focus on {focus.label}
                  <button type="button" onClick={() => setFocus(null)} className="ml-1 text-[var(--sim-cream-faint)] hover:text-[var(--sim-cream)]" aria-label="Stop focusing">
                    ×
                  </button>
                </p>
              ) : null}
              {minutesLeft !== null && minutesLeft < 60 ? (
                <p className="text-xs text-[var(--sim-cream-faint)]">{minutesLeft} practice minutes left this month</p>
              ) : null}
            </div>

            <div className="flex min-w-0 flex-col gap-4 lg:items-end">
              {certifying ? (
                <p className="max-w-sm text-sm leading-relaxed text-[var(--sim-cream-soft)] lg:text-right">
                  A coaching session, with no tips and no help mid-call. Pick a different client each time
                  {certNeedsHard ? ". This one has to be on Hard." : ", and do at least one on Hard."}
                </p>
              ) : (
                <SituationMenu value={situationId} onChange={setSituationId} met={metClients} clientId={client.id} level={effectiveDifficulty} />
              )}
              <div className="sim-seg" role="group" aria-label="Level">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    aria-pressed={effectiveDifficulty === d.id}
                    disabled={Boolean(certifying && certNeedsHard && d.id !== "hard")}
                    onClick={() => setDifficulty(d.id)}
                    title={d.line}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 text-sm text-[var(--sim-cream-soft)]">
                Voice speed
                <div className="sim-seg" role="group" aria-label="Voice speed">
                  <button type="button" aria-pressed={!quick} onClick={() => choosePace(false)}>
                    Normal
                  </button>
                  <button type="button" aria-pressed={quick} onClick={() => choosePace(true)}>
                    Quick
                  </button>
                </div>
              </div>
              {!certifying ? (
                <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm text-[var(--sim-cream-soft)]">
                  <Lightbulb className="h-4 w-4" aria-hidden />
                  Tips during the call
                  <input type="checkbox" className="peer sr-only" checked={tips} onChange={(e) => setTips(e.target.checked)} />
                  <span className="relative h-5 w-9 rounded-full bg-[var(--sim-cream-line)] transition peer-checked:bg-[var(--sim-cream)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--sim-cream)] after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-[var(--sim-navy)] after:transition peer-checked:after:translate-x-4" />
                </label>
              ) : null}
            </div>
          </div>
          {blocked || startError || (data && !data.configured) || loadError ? (
            <p className="mt-5 text-center text-sm text-[var(--sim-amber)]" role="status">
              {blocked ?? startError ?? loadError ?? "Voice isn't set up on this server yet."}
            </p>
          ) : null}
        </div>
      </section>

      {shared.length ? (
        <SharedClients
          clients={shared}
          onPick={(c) => {
            setPicked((p) => (p.includes(c.id) ? p : [...p, c.id]));
            pick(c.id);
            setCertifying(false);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      ) : null}

      <div className="mx-auto mt-10 grid w-full max-w-[1280px] gap-8 px-1 lg:grid-cols-[1.4fr_1fr]">
        <History sessions={data?.sessions ?? null} prefix={prefix} who={who} />
        <div className="space-y-6">
          {data?.weakSpot ? <WeakSpotCard spot={data.weakSpot} client={who(data.weakSpot.clientId)} onPractise={practiseWeakSpot} /> : null}
          <Certification
            data={data}
            prefix={prefix}
            who={who}
            onBegin={() => void beginCertification()}
            onContinue={() => {
              setCertifying(true);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </div>
      </div>

      {call ? (
        <SimCall
          setup={call}
          onDone={(id) => router.push(`${prefix}/simulator/${id}`)}
          onDropped={() => {
            setCall(null);
            void load();
          }}
        />
      ) : null}

      {creating ? (
        <CreateClient
          draft={creating === "new" ? null : creating}
          onClose={(made) => {
            setCreating(false);
            void load().then(() => {
              if (made) pick(made.id);
            });
          }}
        />
      ) : null}
    </div>
  );
}

/** Clients other coaches made and shared. Picking one puts them in the middle of the stage. */
function SharedClients({ clients, onPick }: { clients: SimClient[]; onPick: (c: SimClient) => void }) {
  return (
    <section className="mx-auto mt-10 w-full max-w-[1280px] px-1">
      <h2 className="text-subhead font-semibold tracking-tight text-slate-900">From other coaches</h2>
      <p className="mt-1 text-sm text-slate-500">Situations coaches have met and shared. Names and details are changed.</p>
      <ul className="sim-scroll mt-4 flex snap-x gap-4 overflow-x-auto pb-2">
        {clients.map((c) => (
          <li key={c.id} className="w-64 shrink-0 snap-start">
            <button type="button" onClick={() => onPick(c)} className={cardClass("raised", "group flex h-full w-full flex-col overflow-hidden text-left transition hover:shadow-lg")}>
              <div className="sim-room flex items-center gap-3 px-4 py-4">
                <span className="sim-face relative z-[2] h-14 w-14 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={faceOf(c)} alt="" />
                </span>
                <span className="relative z-[2] min-w-0">
                  <span className="block truncate text-ui font-medium text-[var(--sim-cream)]">{c.name}</span>
                  <span className="block truncate text-xs text-[var(--sim-cream-soft)]">{c.business}</span>
                </span>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <p className="text-sm leading-snug text-slate-800">{c.line}</p>
                <p className="mt-auto pt-3 text-xs text-slate-500">
                  {c.custom?.isReal ? "Real situation · " : ""}Shared by {c.custom?.ownerName ?? "a coach"}
                </p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function WeakSpotCard({ spot, client, onPractise }: { spot: WeakSpot; client: SimClient | null; onPractise: (w: WeakSpot) => void }) {
  return (
    <section className="sim-room rounded-2xl p-6">
      <div className="relative z-[2]">
        <p className="flex items-center gap-2 text-kicker font-semibold uppercase text-[var(--sim-cream-faint)]">
          <Target className="h-4 w-4" aria-hidden /> Your weak spot
        </p>
        <p className="mt-2 text-2xl font-light tracking-[-0.02em] text-[var(--sim-cream)]">{spot.label}</p>
        <p className="mt-1 text-sm text-[var(--sim-cream-soft)]">
          Averaging {spot.average} out of 5 over your last {spot.sessions} sessions.
          {client ? ` ${client.firstName} is a good one to practise it on.` : ""}
        </p>
        <button type="button" onClick={() => onPractise(spot)} className="sim-pill sim-pill-solid mt-4">
          Practise it
        </button>
      </div>
    </section>
  );
}

/** The faces. The chosen one is large in the middle with the name behind it; the others drift off either side. */
export function Cast({
  index,
  onPick,
  onStep,
  used,
  people = CLIENTS,
}: {
  index: number;
  onPick: (i: number) => void;
  onStep: (delta: number) => void;
  used: Set<string> | null;
  /** The Call simulator passes its prospects. */
  people?: SimClient[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const touch = useRef<number | null>(null);
  const n = people.length;
  const client = people[index];

  return (
    <div
      ref={ref}
      className="sim-cast relative mt-2 select-none"
      role="listbox"
      aria-label="Clients"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") onStep(1);
        if (e.key === "ArrowLeft") onStep(-1);
      }}
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        if (Math.abs(dx) > 40) onStep(dx < 0 ? 1 : -1);
        touch.current = null;
      }}
    >
      <p className="sim-giant" aria-hidden>
        {client.firstName}
      </p>
      {people.map((c, i) => {
        let offset = i - index;
        if (offset > n / 2) offset -= n;
        if (offset < -n / 2) offset += n;
        const far = Math.abs(offset);
        // Percent of the big face's width: neighbours just clear it, the next ones sit near the edge.
        const x = offset === 0 ? 0 : Math.sign(offset) * (far === 1 ? 96 : 150);
        const scale = offset === 0 ? 1 : far === 1 ? 0.5 : 0.38;
        const hidden = far > 2;
        const done = used?.has(c.id);
        return (
          <button
            key={c.id}
            type="button"
            role="option"
            aria-selected={offset === 0}
            aria-label={`${c.name}, ${c.business}`}
            tabIndex={-1}
            className="sim-cast-face sim-face"
            onClick={() => onPick(i)}
            style={{
              transform: `translate(-50%, -50%) translateX(${x}%) scale(${scale})`,
              filter: offset === 0 ? "none" : `blur(${far === 1 ? 1.5 : 3}px)${done ? " grayscale(1)" : ""}`,
              opacity: hidden ? 0 : offset === 0 ? (done ? 0.55 : 1) : far === 1 ? 0.7 : 0.38,
              zIndex: 10 - far,
              pointerEvents: hidden ? "none" : "auto",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={faceOf(c)} alt="" draggable={false} />
            {done ? (
              <span className="absolute inset-x-0 bottom-[12%] mx-auto flex w-max items-center gap-1 rounded-full bg-[var(--sim-cream)] px-2.5 py-1 text-xs font-semibold text-[var(--sim-navy)]">
                <Check className="h-3.5 w-3.5" aria-hidden /> Done
              </span>
            ) : null}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => onStep(-1)}
        aria-label="Previous client"
        className="absolute left-0 top-1/2 z-20 -translate-y-1/2 rounded-full p-2.5 text-[var(--sim-cream-soft)] transition hover:bg-[var(--sim-glass)] hover:text-[var(--sim-cream)]"
      >
        <ChevronLeft className="h-6 w-6" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => onStep(1)}
        aria-label="Next client"
        className="absolute right-0 top-1/2 z-20 -translate-y-1/2 rounded-full p-2.5 text-[var(--sim-cream-soft)] transition hover:bg-[var(--sim-glass)] hover:text-[var(--sim-cream)]"
      >
        <ChevronRight className="h-6 w-6" aria-hidden />
      </button>
    </div>
  );
}

function SituationMenu({
  value,
  onChange,
  met,
  clientId,
  level,
}: {
  value: string;
  onChange: (id: string) => void;
  met: Set<string>;
  clientId: string;
  level: Difficulty;
}) {
  const prefix = useSimPrefix();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = situationById(value)!;

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
          <span className="block text-kicker font-semibold uppercase text-[var(--sim-cream-faint)]">
            {SITUATION_GROUPS.find((g) => g.id === current.group)?.title}
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
          {SITUATION_GROUPS.map((g) => (
            <div key={g.id} className="py-1">
              <p className="px-3 pb-1 pt-2 text-kicker font-semibold uppercase text-[var(--sim-cream-faint)]">{g.title}</p>
              {SITUATIONS.filter((s) => s.group === g.id).map((s) => {
                const locked = Boolean(s.needsPrevious && !met.has(clientId));
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="option"
                    aria-selected={s.id === value}
                    onClick={() => {
                      onChange(s.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-[var(--sim-glass-strong)] ${s.id === value ? "bg-[var(--sim-glass-strong)]" : ""}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-ui font-medium text-[var(--sim-cream)]">{s.title}</span>
                      <span className="mt-0.5 block text-ui leading-snug text-[var(--sim-cream-soft)]">
                        {locked ? "Do a session with this client first." : s.line}
                      </span>
                    </span>
                    <span className="shrink-0 pt-0.5 text-xs text-[var(--sim-cream-faint)]">{s.minutes} min</span>
                  </button>
                );
              })}
            </div>
          ))}
          {/* Sales calls live in the Call simulator under Get Clients → Scripts. */}
          <div className="border-t border-[var(--sim-cream-line)] py-1">
            <p className="px-3 pb-1 pt-2 text-kicker font-semibold uppercase text-[var(--sim-cream-faint)]">Sales calls</p>
            {[
              { call: "review", title: "BOSS Score Review" },
              { call: "roadmap", title: "Profit Roadmap call" },
            ].map((c) => (
              <Link
                key={c.call}
                href={`${prefix}/script/simulator?${isCustomId(clientId) ? "" : `prospect=${clientId}&`}call=${c.call}&level=${level}`}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-[var(--sim-glass-strong)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-ui font-medium text-[var(--sim-cream)]">{c.title}</span>
                  <span className="mt-0.5 block text-ui leading-snug text-[var(--sim-cream-soft)]">In the Call simulator, with the Scripts</span>
                </span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--sim-cream-faint)]" aria-hidden />
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function History({ sessions, prefix, who }: { sessions: Summary[] | null; prefix: string; who: (id: string) => SimClient | null }) {
  const done = (sessions ?? []).filter((s) => s.status === "scored" || s.status === "scoring");
  const scores = done.filter((s) => s.score !== null).slice(0, 12).reverse().map((s) => s.reviewed_score ?? s.score ?? 0);
  return (
    <section>
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-subhead font-semibold tracking-tight text-slate-900">Your sessions</h2>
        {scores.length > 1 ? <Trend scores={scores} /> : null}
      </div>
      {sessions === null ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading
        </p>
      ) : done.length === 0 ? (
        <p className="mt-4 max-w-md text-read leading-relaxed text-slate-600">
          Your practice sessions show up here, each with a score out of 50 and a report you can come back to.
        </p>
      ) : (
        <ul className={cardClass("plain", "mt-4 divide-y divide-slate-200 overflow-hidden")}>
          {done.map((s) => {
            const c = who(s.client_id);
            const sit = situationById(s.situation_id);
            const score = s.reviewed_score ?? s.score;
            return (
              <li key={s.id}>
                <Link href={`${prefix}/simulator/${s.id}`} className="flex items-center gap-4 px-4 py-3 transition hover:bg-slate-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c ? faceOf(c) : faceOf({ face: "", name: "?" })} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-ui font-medium text-slate-900">
                      {c?.firstName ?? "A client"} · {sit?.title ?? "Session"}
                    </span>
                    <span className="block text-ui text-slate-500">
                      {formatSimDate(s.started_at)} · {DIFFICULTIES.find((d) => d.id === s.difficulty)?.label}
                      {s.mode === "assessment" ? " · Certification" : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    {score !== null ? (
                      <span className="text-lg font-semibold tabular-nums text-slate-900">
                        {score}
                        <span className="text-sm font-normal text-slate-400">/50</span>
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

export function Trend({ scores, range = [20, 40] }: { scores: number[]; range?: [number, number] }) {
  const w = 160;
  const h = 40;
  const min = Math.min(...scores, range[0]);
  const max = Math.max(...scores, range[1]);
  const pts = scores.map((s, i) => [(i / (scores.length - 1)) * w, h - ((s - min) / (max - min || 1)) * (h - 6) - 3] as const);
  const last = scores[scores.length - 1];
  const first = scores[0];
  return (
    <div className="flex items-center gap-3">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
        <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="#0c5290" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.5" fill="#0c5290" />
      </svg>
      <span className="text-sm text-slate-600">
        {last > first ? `Up ${last - first} since your first` : last < first ? `Down ${first - last}` : "Steady"}
      </span>
    </div>
  );
}

function Certification({
  data,
  prefix,
  who,
  onBegin,
  onContinue,
}: {
  data: HomeData | null;
  prefix: string;
  who: (id: string) => SimClient | null;
  onBegin: () => void;
  onContinue: () => void;
}) {
  const a = data?.assessment ?? null;
  const total = data?.assessmentSessions ?? 3;
  const pass = data?.passMark ?? 30;
  const done = (a?.sessions ?? []).filter((s) => s.status === "scored");
  return (
    <section className={cardClass("plain", "h-max p-6")}>
      <p className="flex items-center gap-2 text-kicker font-semibold uppercase text-[#0c5290]">
        <Trophy className="h-4 w-4" aria-hidden /> Certification
      </p>
      <h2 className="mt-2 text-subhead font-semibold tracking-tight text-slate-900">Show you can coach</h2>
      <p className="mt-2 text-read leading-relaxed text-slate-600">
        {total} coaching sessions with three different clients, at least one on Hard. No tips and no help mid-call. You can pause if you need to. Average {pass} out of 50 to pass. A BCA coach checks every one.
      </p>
      {a?.status === "in_progress" ? (
        <>
          <ol className="mt-4 space-y-2">
            {Array.from({ length: total }, (_, i) => {
              const s = done[i];
              const c = s ? who(s.client_id) : null;
              return (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-semibold ${s ? "bg-[#0c5290] text-white" : "bg-slate-100 text-slate-500"}`}>
                    {s ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
                  </span>
                  {s ? (
                    <Link href={`${prefix}/simulator/${s.id}`} className="text-slate-700 hover:underline">
                      {c?.firstName} · {DIFFICULTIES.find((d) => d.id === s.difficulty)?.label} · {s.score}/50
                    </Link>
                  ) : (
                    <span className="text-slate-500">To do</span>
                  )}
                </li>
              );
            })}
          </ol>
          <button type="button" onClick={onContinue} className={buttonClass("main", "normal", "mt-5 w-full")}>
            {done.length ? "Next session" : "Start the first session"}
          </button>
        </>
      ) : a?.status === "submitted" ? (
        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Handed in with an average of <strong>{a.average}</strong> out of 50. A BCA coach is checking it now.
        </p>
      ) : (
        <>
          {a?.status === "reviewed" ? (
            <p className={`mt-4 rounded-xl px-4 py-3 text-sm ${a.passed ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
              {a.passed ? "Passed" : "Not this time"} with an average of <strong>{a.average}</strong> out of 50.
              {a.review_note ? <span className="mt-1 block text-slate-700">{a.review_note}</span> : null}
            </p>
          ) : null}
          <button
            type="button"
            onClick={onBegin}
            disabled={!data?.configured}
            className={buttonClass("main", "normal", "mt-5 w-full")}
          >
            {a?.status === "reviewed" ? "Try again" : "Start certification"}
          </button>
        </>
      )}
      {prefix === "/admin" ? (
        <Link href="/admin/simulator/review" className="mt-4 block text-center text-sm font-medium text-[#0c5290] hover:underline">
          Review coaches&rsquo; certification
        </Link>
      ) : null}
    </section>
  );
}
