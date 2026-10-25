"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronDown, Loader2, MessageCircle, Repeat, Share2, StepForward } from "lucide-react";

import { figtree } from "@/fonts";
import { clientById } from "@/lib/simulator/clients";
import { difficultyById } from "@/lib/simulator/difficulty";
import { faceOf } from "@/lib/simulator/faces";
import { POWER, situationById } from "@/lib/simulator/situations";
import type { CallStart, ScoredArea, SimClient, SimSessionRow } from "@/lib/simulator/types";

import { AiWorking } from "./AiWorking";
import { SimCall, scoringSteps, type SimCallSetup } from "./SimCall";
import { ShareSession } from "./ShareSession";
import { TalkItThrough } from "./TalkItThrough";
import { Transcript, unquote, type ReplayShown } from "./Transcript";
import { formatSimDate, useSimApi, useSimPrefix } from "./simApi";
import { QUICK_PACE, readPace } from "./SimulatorHome";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import "./sim.css";

// Moved to Transcript.tsx; still exported here for the Call simulator.
export { Transcript, unquote };

type ReplayRow = Pick<SimSessionRow, "id" | "replay_line" | "status" | "report">;
type Loaded = {
  session: SimSessionRow;
  client: SimClient | null;
  coachName: string | null;
  mine: boolean;
  canFollowUp: boolean;
  replays: ReplayRow[];
};

/** The report after a call: score out of 50, the ten areas, moments from the call, and one thing for next time. */
export function SimReport({ id }: { id: string }) {
  const api = useSimApi();
  const prefix = useSimPrefix();
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [talking, setTalking] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [replayCall, setReplayCall] = useState<SimCallSetup | null>(null);
  const [replayError, setReplayError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await api<Loaded>(`/api/coach/simulator/sessions/${id}`);
    if (res.ok) setData(res.data);
    else setError(res.error);
  }, [api, id]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await api<Loaded>(`/api/coach/simulator/sessions/${id}`);
      if (cancelled) return;
      if (res.ok) setData(res.data);
      else setError(res.error);
    })();
    return () => {
      cancelled = true;
    };
  }, [api, id]);

  // Still scoring (or the scorer failed): check back, and offer a retry after a while.
  const status = data?.session.status;
  const [waited, setWaited] = useState(0);
  useEffect(() => {
    if (status !== "scoring") return;
    const t = window.setTimeout(() => {
      setWaited((w) => w + 5);
      void load();
    }, 5000);
    return () => window.clearTimeout(t);
  }, [status, load, waited]);

  async function retry() {
    setRetrying(true);
    await api(`/api/coach/simulator/sessions/${id}/finish`, { method: "POST", body: {} });
    setRetrying(false);
    void load();
  }

  if (error) return <p className="mx-auto mt-16 max-w-md text-center text-slate-600">{error}</p>;
  if (!data) {
    return (
      <p className="mx-auto mt-16 flex max-w-md items-center justify-center gap-2 text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading
      </p>
    );
  }

  const s = data.session;
  const client = data.client ?? clientById(s.client_id);
  const situation = situationById(s.situation_id);
  if (!client || !situation) return <p className="mx-auto mt-16 max-w-md text-center text-slate-600">This client is no longer available.</p>;
  if (s.replay_of) {
    return (
      <p className="mx-auto mt-16 max-w-md text-center text-slate-600">
        This was a replay of one moment.{" "}
        <Link href={`${prefix}/simulator/${s.replay_of}`} className="font-semibold text-[#0c5290] hover:underline">
          Open the full session
        </Link>
      </p>
    );
  }
  const report = s.report;
  const score = s.reviewed_score ?? s.score;
  const face = faceOf(client);
  const again = `${prefix}/simulator?client=${client.id}&situation=${situation.id}&level=${s.difficulty}`;
  const replays: ReplayShown[] = data.replays
    .filter((r) => r.status === "scored" && r.report?.replay && r.replay_line !== null)
    .map((r) => ({ line: r.replay_line!, ...r.report!.replay! }));

  async function startReplay(line: number) {
    setReplayError(null);
    const res = await api<{ id: string; call: CallStart; cue: string; firstTry: string }>(`/api/coach/simulator/sessions/${s.id}/replay`, {
      method: "POST",
      body: { line },
    });
    if (!res.ok) {
      setReplayError(res.error);
      return;
    }
    setReplayCall({
      id: res.data.id,
      call: res.data.call,
      client: client!,
      situation: situation!,
      difficulty: s.difficulty,
      tips: false,
      mode: "practice",
      pace: readPace() ? QUICK_PACE : 1,
      replay: { firstTry: res.data.firstTry },
      cue: res.data.cue,
    });
  }

  return (
    <div className={`sim ${figtree.className} pb-20`}>
      <section className="sim-room mx-auto mt-6 w-full max-w-[1180px] rounded-[2rem] px-6 py-8 sm:px-10">
        <Link href={`${prefix}/simulator`} className="relative z-[2] inline-flex items-center gap-1.5 text-sm text-[var(--sim-cream-soft)] hover:text-[var(--sim-cream)]">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Client simulator
        </Link>
        <div className="relative z-[2] mt-6 grid items-center gap-8 md:grid-cols-[auto_1fr_auto]">
          <div className="sim-face mx-auto aspect-square w-40 md:w-44">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={face} alt="" />
          </div>
          <div className="min-w-0 text-center md:text-left">
            <p className="text-sm text-[var(--sim-cream-soft)]">
              {situation.title} · {difficultyById(s.difficulty)?.label} · {formatSimDate(s.started_at)}
              {s.mode === "assessment" ? " · Certification" : ""}
            </p>
            <p className="mt-2 text-[clamp(2rem,4vw,3.25rem)] font-light leading-[1.05] tracking-[-0.03em]">{client.name}</p>
            {!data.mine && data.coachName ? <p className="mt-2 text-sm text-[var(--sim-cream-soft)]">{s.shared_at ? "Shared by" : "Coach:"} {data.coachName}</p> : null}
          </div>
          {score !== null ? <ScoreRing score={score} reviewed={s.reviewed_score !== null} /> : null}
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1180px] px-1">
        {status === "scoring" || !report ? (
          status === "abandoned" ? (
            <p className="mx-auto mt-14 max-w-md text-center text-lg text-slate-700">This call was too short to score.</p>
          ) : (
            <div className="sim-room mx-auto mt-8 grid place-items-center rounded-[2rem] px-6 py-14">
              <div className="relative z-[2]">
                <AiWorking {...scoringSteps({ mode: s.mode })} />
                {waited >= 60 && !retrying && data.mine ? (
                  <div className="mt-6 text-center">
                    <button type="button" onClick={() => void retry()} className="sim-pill sim-pill-solid">
                      Try scoring again
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          )
        ) : (
          <>
            <p className="mx-auto mt-12 max-w-3xl text-center text-[clamp(1.35rem,2.4vw,1.9rem)] font-light leading-snug tracking-[-0.015em] text-slate-900">
              {report.summary}
            </p>

            {data.mine ? (
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <button type="button" onClick={() => setTalking(true)} className={buttonClass("main")}>
                  <MessageCircle className="h-4 w-4" aria-hidden /> Talk it through with Ava
                </button>
                <Link href={again} className={buttonClass("second")}>
                  <Repeat className="h-4 w-4" aria-hidden /> Practise again
                </Link>
                <button
                  type="button"
                  onClick={() => setSharing(true)}
                  className={buttonClass("second")}
                >
                  <Share2 className="h-4 w-4" aria-hidden /> {s.shared_at ? "Shared with the community" : "Share with the community"}
                </button>
                {data.canFollowUp && s.mode === "practice" ? (
                  <Link
                    href={`${prefix}/simulator?client=${client.id}&situation=follow-up&level=${s.difficulty}`}
                    className={buttonClass("second")}
                  >
                    <StepForward className="h-4 w-4" aria-hidden /> Continue with {client.firstName}
                  </Link>
                ) : null}
              </div>
            ) : null}

            <div className="mt-12 grid gap-6 md:grid-cols-2">
              <AreaList title="The session" areas={report.stages} />
              <AreaList title="POWER skills" areas={report.power} />
            </div>

            <section className="mt-12">
              <h2 className="text-subhead font-semibold tracking-tight text-slate-900">Moments from the call</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {report.moments.map((m, i) => (
                  <article key={i} className={cardClass("plain", "flex flex-col p-5")}>
                    <span className={`w-max rounded-full px-2.5 py-1 text-xs font-semibold ${m.kind === "good" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
                      {m.kind === "good" ? "Worked well" : "Missed chance"}
                    </span>
                    <p className="mt-3 text-read leading-snug text-slate-900">&ldquo;{unquote(m.quote)}&rdquo;</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{m.note}</p>
                    {m.tryInstead ? (
                      <p className="mt-auto pt-3 text-sm leading-relaxed text-slate-800">
                        <span className="font-medium text-[#0c5290]">Try instead: </span>&ldquo;{unquote(m.tryInstead)}&rdquo;
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>

            <section className="sim-room mt-12 rounded-3xl px-6 py-8 text-center sm:px-10">
              <p className="relative z-[2] text-kicker font-semibold uppercase text-[var(--sim-cream-faint)]">Your one thing for next time</p>
              <p className="relative z-[2] mx-auto mt-3 max-w-3xl text-[clamp(1.25rem,2.2vw,1.75rem)] font-light leading-snug">{report.oneThing}</p>
            </section>

            <section className="mt-12 grid gap-8 md:grid-cols-2">
              <div>
                <h2 className="text-subhead font-semibold tracking-tight text-slate-900">
                  What {client.firstName} shared · {report.found.length} of {client.facts.length}
                </h2>
                <p className="mt-1 text-sm text-slate-500">The dashed ones were there to find.</p>
                <ul className="mt-4 grid grid-cols-2 gap-2">
                  {client.facts.map((f) => {
                    const got = report.found.includes(f.id);
                    return (
                      <li
                        key={f.id}
                        className={`flex items-start gap-1.5 rounded-xl px-3 py-2 text-sm ${got ? "bg-[#0c5290] font-medium text-white" : "border border-dashed border-slate-300 text-slate-500"}`}
                      >
                        {got ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-label="Found" /> : null}
                        {f.label}
                      </li>
                    );
                  })}
                </ul>
              </div>
              {report.agreedActions.length ? (
                <div>
                  <h2 className="text-subhead font-semibold tracking-tight text-slate-900">What {client.firstName} agreed to</h2>
                  <ul className="mt-4 space-y-2">
                    {report.agreedActions.map((a) => (
                      <li key={a} className="flex items-start gap-2 rounded-xl bg-white px-3 py-2.5 text-sm leading-relaxed text-slate-700 ring-1 ring-slate-200">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#0c5290]" aria-hidden />
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>

            {replayError ? <p className="mt-6 text-center text-sm text-amber-700">{replayError}</p> : null}
            <Transcript
              lines={s.transcript}
              conversationIds={s.conversation_ids}
              audioUrl={(part) => `/api/coach/simulator/sessions/${s.id}/audio?part=${part}`}
              face={face}
              name={client.firstName}
              report={report}
              chapters={report.chapters}
              stageLabels={Object.fromEntries([...situation.stages, ...POWER].map((x) => [x.id, x.label]))}
              onReplay={data.mine && s.mode === "practice" ? (line) => void startReplay(line) : undefined}
              replays={replays}
            />
          </>
        )}
      </div>

      {talking && report && score !== null ? <TalkItThrough sessionId={s.id} onClose={() => setTalking(false)} /> : null}
      {sharing ? (
        <ShareSession
          sessionId={s.id}
          shared={Boolean(s.shared_at)}
          onClose={(changed) => {
            setSharing(false);
            if (changed) void load();
          }}
        />
      ) : null}
      {replayCall ? (
        <SimCall
          setup={replayCall}
          onDone={() => {
            setReplayCall(null);
            void load();
          }}
          onDropped={() => {
            setReplayCall(null);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}

export function ScoreRing({ score, reviewed, max = 50 }: { score: number; reviewed: boolean; max?: number }) {
  const r = 62;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative mx-auto grid h-40 w-40 place-items-center">
      <svg viewBox="0 0 160 160" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="80" cy="80" r={r} fill="none" stroke="rgba(244,238,228,0.16)" strokeWidth="6" />
        <circle cx="80" cy="80" r={r} fill="none" stroke="#f4eee4" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(score / max) * c} ${c}`} />
      </svg>
      <div className="text-center">
        <p className="text-5xl font-light tabular-nums leading-none">
          {score}
          {max === 100 ? <span className="text-2xl">%</span> : null}
        </p>
        <p className="mt-1 text-xs text-[var(--sim-cream-soft)]">{max === 100 ? "score" : `out of ${max}`}{reviewed ? " · reviewed" : ""}</p>
      </div>
    </div>
  );
}

export function AreaList({ title, areas }: { title: string; areas: ScoredArea[] }) {
  const total = areas.reduce((s, a) => s + a.score, 0);
  return (
    <section className={cardClass("plain", "p-5")}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
        <p className="text-sm tabular-nums text-slate-500">{total} / {areas.length * 5}</p>
      </div>
      <ul className="mt-3 divide-y divide-slate-100">
        {areas.map((a) => (
          <li key={a.id}>
            <details className="group py-3">
              <summary className="flex cursor-pointer list-none items-center gap-3">
                <span className="min-w-0 flex-1 text-ui font-medium text-slate-800">{a.label}</span>
                <span className="flex gap-1" aria-label={`${a.score} out of 5`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span key={n} className={`h-2 w-5 rounded-full ${n <= a.score ? (a.score >= 4 ? "bg-[#0c5290]" : a.score === 3 ? "bg-[#4a88c2]" : "bg-amber-400") : "bg-slate-200"}`} />
                  ))}
                </span>
                <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" aria-hidden />
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{a.evidence}</p>
              {a.better ? (
                <p className="mt-2 text-sm leading-relaxed text-slate-800">
                  <span className="font-medium text-[#0c5290]">Better: </span>
                  {a.better}
                </p>
              ) : null}
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
