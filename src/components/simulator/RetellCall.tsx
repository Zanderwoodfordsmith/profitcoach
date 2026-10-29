"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

import { figtree } from "@/fonts";
import { difficultyById } from "@/lib/simulator/difficulty";
import { faceOf } from "@/lib/simulator/faces";
import { retellAgent } from "@/lib/simulator/retell";
import { POWER, situationById } from "@/lib/simulator/situations";
import type { SimReport, TranscriptLine } from "@/lib/simulator/types";

import { formatRetellDate } from "./RetellCalls";
import { AreaList, ScoreRing } from "./SimReport";
import { Transcript, unquote } from "./Transcript";
import { useSimApi } from "./simApi";
import { cardClass } from "@/components/ui/Card";
import "./sim.css";

type Call = {
  call_id: string;
  agent_name: string;
  client_id: string | null;
  difficulty: "easy" | "medium" | "hard" | null;
  started_at: string;
  duration_seconds: number;
  coach_name_heard: string | null;
  transcript: TranscriptLine[];
  recording_path: string | null;
  report: SimReport | null;
  score: number | null;
};

/** Admin → one old Retell practice call: the score, the ten areas, and the recording with its transcript. */
export function RetellCall({ id }: { id: string }) {
  const api = useSimApi();
  const [data, setData] = useState<{ call: Call; coachName: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await api<{ call: Call; coachName: string | null }>(`/api/admin/simulator/retell/${id}`);
      if (cancelled) return;
      if (res.ok) setData(res.data);
      else setError(res.error);
    })();
    return () => {
      cancelled = true;
    };
  }, [api, id]);

  if (error) return <p className="mx-auto mt-16 max-w-md text-center text-slate-600">{error}</p>;
  if (!data) {
    return (
      <p className="mx-auto mt-16 flex max-w-md items-center justify-center gap-2 text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading
      </p>
    );
  }

  const { call, coachName } = data;
  const agent = retellAgent(call.client_id);
  const name = agent?.oldName ?? "Prospect";
  const face = faceOf({ face: "", name });
  const report = call.report;
  const situation = situationById("coaching")!;
  // Retell's times are exact, so each line plays from where it starts.
  const lines = call.transcript.map((l) => (l.at !== undefined ? { ...l, part: 0, t: l.at } : l));

  return (
    <div className={`sim ${figtree.className} pb-20`}>
      <section className="sim-room mx-auto mt-6 w-full max-w-[1180px] rounded-[2rem] px-6 py-8 sm:px-10">
        <Link href="/admin/simulator/retell" className="relative z-[2] inline-flex items-center gap-1.5 text-sm text-[var(--sim-cream-soft)] hover:text-[var(--sim-cream)]">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Old Retell calls
        </Link>
        <div className="relative z-[2] mt-6 grid items-center gap-8 md:grid-cols-[auto_1fr_auto]">
          <div className="sim-face mx-auto aspect-square w-40 md:w-44">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={face} alt="" />
          </div>
          <div className="min-w-0 text-center md:text-left">
            <p className="text-sm text-[var(--sim-cream-soft)]">
              {agent?.business ?? "Sales objection practice"}
              {call.difficulty ? ` · ${difficultyById(call.difficulty)?.label}` : ""} · {formatRetellDate(call.started_at)} ·{" "}
              {Math.round(call.duration_seconds / 60)} min
            </p>
            <p className="mt-2 text-[clamp(2rem,4vw,3.25rem)] font-light leading-[1.05] tracking-[-0.03em]">{name}</p>
            <p className="mt-2 text-sm text-[var(--sim-cream-soft)]">
              Coach: {coachName ?? (call.coach_name_heard ? `unknown (said "${call.coach_name_heard}")` : "unknown")}
            </p>
          </div>
          {call.score !== null ? <ScoreRing score={call.score} reviewed={false} /> : null}
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1180px] px-1">
        {report ? (
          <>
            <p className="mx-auto mt-12 max-w-3xl text-center text-[clamp(1.35rem,2.4vw,1.9rem)] font-light leading-snug tracking-[-0.015em] text-slate-900">
              {report.summary}
            </p>
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
              <p className="relative z-[2] text-kicker font-semibold uppercase text-[var(--sim-cream-faint)]">The one thing to practise</p>
              <p className="relative z-[2] mx-auto mt-3 max-w-3xl text-[clamp(1.25rem,2.2vw,1.75rem)] font-light leading-snug">{report.oneThing}</p>
            </section>
          </>
        ) : (
          <p className="mx-auto mt-12 max-w-md text-center text-slate-600">
            {call.client_id ? "This call was too short to score." : "Sales practice calls aren't scored."}
          </p>
        )}
        <Transcript
          lines={lines}
          conversationIds={call.recording_path ? [call.call_id] : []}
          audioUrl={() => `/api/admin/simulator/retell/${call.call_id}/audio`}
          face={face}
          name={name.split(" ")[0]}
          report={report ?? { moments: [] }}
          chapters={report?.chapters}
          stageLabels={Object.fromEntries([...situation.stages, ...POWER].map((x) => [x.id, x.label]))}
        />
      </div>
    </div>
  );
}
