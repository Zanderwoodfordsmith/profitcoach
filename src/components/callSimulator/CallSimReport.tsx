"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, Repeat } from "lucide-react";

import { figtree } from "@/fonts";
import { callById, callFacts } from "@/lib/callSimulator/calls";
import { prospectById } from "@/lib/callSimulator/prospects";
import type { CallSessionRow } from "@/lib/callSimulator/types";
import { difficultyById } from "@/lib/simulator/difficulty";

import { AreaList, ScoreRing, Transcript, unquote } from "@/components/simulator/SimReport";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { formatSimDate, useSimApi, useSimPrefix } from "@/components/simulator/simApi";
import "@/components/simulator/sim.css";

type Loaded = { session: CallSessionRow; coachName: string | null; mine: boolean };

const OUTCOME = {
  won: { title: "Won", tone: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  step: { title: "Next step", tone: "bg-sky-50 text-sky-900 ring-sky-200" },
  lost: { title: "No next step", tone: "bg-amber-50 text-amber-900 ring-amber-200" },
} as const;

/** The report after a practice sales call: a score out of 100, how it ended, the parts and skills, and the call with notes. */
export function CallSimReport({ id }: { id: string }) {
  const api = useSimApi();
  const prefix = useSimPrefix();
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const load = useCallback(async () => {
    const res = await api<Loaded>(`/api/coach/call-simulator/sessions/${id}`);
    if (res.ok) setData(res.data);
    else setError(res.error);
  }, [api, id]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await api<Loaded>(`/api/coach/call-simulator/sessions/${id}`);
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
    await api(`/api/coach/call-simulator/sessions/${id}/finish`, { method: "POST", body: {} });
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
  const prospect = prospectById(s.prospect_id)!;
  const call = callById(s.call_id)!;
  const report = s.report;
  const facts = callFacts(call, prospect, s.difficulty);
  const fromPart = s.start_part ? call.parts.find((x) => x.id === s.start_part)?.label : null;
  const again = `${prefix}/script/simulator?prospect=${prospect.id}&call=${call.id}&level=${s.difficulty}${s.start_part ? `&from=${s.start_part}` : ""}${
    s.objections.length ? `&objections=${s.objections.join(",")}` : ""
  }`;

  return (
    <div className={`sim ${figtree.className} pb-20`}>
      <section className="sim-room mx-auto mt-6 w-full max-w-[1180px] rounded-[2rem] px-6 py-8 sm:px-10">
        <Link href={`${prefix}/script/simulator`} className="relative z-[2] inline-flex items-center gap-1.5 text-sm text-[var(--sim-cream-soft)] hover:text-[var(--sim-cream)]">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Call simulator
        </Link>
        <div className="relative z-[2] mt-6 grid items-center gap-8 md:grid-cols-[auto_1fr_auto]">
          <div className="sim-face mx-auto aspect-square w-40 md:w-44">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={prospect.face} alt="" />
          </div>
          <div className="min-w-0 text-center md:text-left">
            <p className="text-sm text-[var(--sim-cream-soft)]">
              {call.title}
              {fromPart ? ` · from ${fromPart}` : ""} · {difficultyById(s.difficulty)?.label} · {formatSimDate(s.started_at)}
            </p>
            <p className="mt-2 text-[clamp(2rem,4vw,3.25rem)] font-light leading-[1.05] tracking-[-0.03em]">{prospect.name}</p>
            {!data.mine && data.coachName ? <p className="mt-2 text-sm text-[var(--sim-cream-soft)]">Coach: {data.coachName}</p> : null}
          </div>
          {s.score !== null ? <ScoreRing score={s.score} reviewed={false} max={100} /> : null}
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1180px] px-1">
        {status === "scoring" || !report ? (
          <div className="mx-auto mt-14 max-w-md text-center">
            <p className="flex items-center justify-center gap-2 text-lg text-slate-700">
              {retrying || waited < 60 ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
              {status === "abandoned" ? "This call was too short to score." : "Scoring your call"}
            </p>
            {status !== "abandoned" && waited >= 60 && !retrying && data.mine ? (
              <button type="button" onClick={() => void retry()} className={buttonClass("main", "normal", "mt-4")}>
                Try scoring again
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="mt-12 flex justify-center">
              <span className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium ring-1 ${OUTCOME[report.outcome.result].tone}`}>
                {report.outcome.result === "won" ? <Check className="h-4 w-4" aria-hidden /> : null}
                {OUTCOME[report.outcome.result].title}: {report.outcome.label}
              </span>
            </div>
            <p className="mx-auto mt-5 max-w-3xl text-center text-[clamp(1.35rem,2.4vw,1.9rem)] font-light leading-snug tracking-[-0.015em] text-slate-900">
              {report.summary}
            </p>

            {data.mine ? (
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link href={again} className={buttonClass("main")}>
                  <Repeat className="h-4 w-4" aria-hidden /> Practise again
                </Link>
                <Link
                  href={`${prefix}/script/${call.script}`}
                  className={buttonClass("second")}
                >
                  Open the script
                </Link>
              </div>
            ) : null}

            <div className="mt-12 grid gap-6 md:grid-cols-2">
              <AreaList title={call.drill ? "The objections" : "The call"} areas={report.parts} />
              <AreaList title="Sales skills" areas={report.skills} />
            </div>

            <section className="mt-12">
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">Moments from the call</h2>
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

            {facts.length ? (
              <section className="mt-12">
                <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                  What you found out · {report.found.length} of {facts.length}
                </h2>
                <p className="mt-1 text-sm text-slate-500">The dashed ones were there to find.</p>
                <ul className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                  {facts.map((f) => {
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
              </section>
            ) : null}

            <Transcript
              lines={s.transcript}
              conversationIds={s.conversation_ids}
              audioUrl={(part) => `/api/coach/call-simulator/sessions/${s.id}/audio?part=${part}`}
              face={prospect.face}
              name={prospect.firstName}
              report={report}
            />
          </>
        )}
      </div>
    </div>
  );
}
