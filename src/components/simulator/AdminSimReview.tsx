"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

import { clientById } from "@/lib/simulator/clients";
import { difficultyById } from "@/lib/simulator/difficulty";
import { faceOf } from "@/lib/simulator/faces";
import { situationById } from "@/lib/simulator/situations";
import type { SimAssessmentRow, SimSessionRow } from "@/lib/simulator/types";
import { getValidSupabaseAccessToken } from "@/lib/supabaseAccessToken";

import { formatSimDate } from "./simApi";

type Summary = Omit<SimSessionRow, "transcript" | "live" | "conversation_ids" | "report">;
type Attempt = SimAssessmentRow & { sessions: Summary[] };
type Coach = { id: string; full_name: string | null; avatar_url: string | null };
type Data = {
  assessments: Attempt[];
  recent: Summary[];
  coaches: Coach[];
  usage: { coach_id: string; minutes: number; sessions: number }[];
  monthlyMinutes: number;
};

async function adminFetch<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T | { error: string }> {
  const token = await getValidSupabaseAccessToken();
  if (!token) return { error: "Sign in again." };
  const res = await fetch(path, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  }).catch(() => null);
  const data = (await res?.json().catch(() => null)) as T | { error: string } | null;
  return data ?? { error: "Couldn't reach the server." };
}

const STATUS: Record<SimAssessmentRow["status"], string> = {
  in_progress: "In progress",
  submitted: "Waiting for review",
  reviewed: "Reviewed",
};

/** Admin → certification attempts: read each session, change a score if the AI got it wrong, then confirm. */
export function AdminSimReview() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await adminFetch<Data>("/api/admin/simulator");
    if ("error" in res) setError(res.error);
    else setData(res);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await adminFetch<Data>("/api/admin/simulator");
      if (cancelled) return;
      if ("error" in res) setError(res.error);
      else setData(res);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const coach = (id: string) => data?.coaches.find((c) => c.id === id);

  return (
    <div className="mx-auto w-full max-w-5xl py-8">
      <Link href="/admin/simulator" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Client simulator
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">Certification review</h1>
      <p className="mt-1 text-[0.9375rem] text-slate-600">Three coaching sessions per attempt. Change any score, add a note, then confirm the result.</p>
      {error ? <p className="mt-6 text-sm text-red-700">{error}</p> : null}
      {!data && !error ? (
        <p className="mt-8 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading
        </p>
      ) : null}
      {data ? (
        <>
          <div className="mt-6 space-y-4">
            {data.assessments.length === 0 ? <p className="text-sm text-slate-500">No attempts yet.</p> : null}
            {data.assessments.map((a) => (
              <AttemptCard key={a.id} attempt={a} coach={coach(a.coach_id)} onSaved={load} />
            ))}
          </div>
          <h2 className="mt-12 text-lg font-semibold tracking-tight text-slate-900">Practice minutes this month</h2>
          <p className="mt-1 text-sm text-slate-500">
            Each coach gets {data.monthlyMinutes} a month (MONTHLY_MINUTES in src/lib/simulator/server.ts). A minute of voice uses about 1,000 ElevenLabs credits.
          </p>
          {data.usage.length ? (
            <ul className="mt-3 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {data.usage.map((u) => (
                <li key={u.coach_id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-900">{coach(u.coach_id)?.full_name ?? "Coach"}</span>
                  <span className="text-slate-500">{u.sessions} sessions</span>
                  <span className="w-24 text-right font-semibold tabular-nums text-slate-900">
                    {u.minutes} <span className="font-normal text-slate-400">/ {data.monthlyMinutes}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No practice yet this month.</p>
          )}
          <h2 className="mt-12 text-lg font-semibold tracking-tight text-slate-900">Recent practice</h2>
          <ul className="mt-3 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {data.recent.map((s) => (
              <li key={s.id}>
                <SessionRow s={s} coachName={coach(s.coach_id)?.full_name ?? "Coach"} />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function SessionRow({ s, coachName }: { s: Summary; coachName: string }) {
  const c = clientById(s.client_id);
  return (
    <Link href={`/admin/simulator/${s.id}`} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-slate-50">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={faceOf(c ?? { face: "", name: "?" })} alt="" className="h-9 w-9 rounded-full object-cover" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-slate-900">
          {coachName} · {c?.firstName ?? "Their own client"} · {situationById(s.situation_id)?.title}
        </span>
        <span className="text-slate-500">
          {formatSimDate(s.started_at)} · {difficultyById(s.difficulty)?.label}
        </span>
      </span>
      <span className="font-semibold tabular-nums text-slate-900">{s.reviewed_score ?? s.score ?? "–"}/50</span>
    </Link>
  );
}

function AttemptCard({ attempt, coach, onSaved }: { attempt: Attempt; coach?: Coach; onSaved: () => void }) {
  const [scores, setScores] = useState<Record<string, string>>(() =>
    Object.fromEntries(attempt.sessions.map((s) => [s.id, s.reviewed_score !== null ? String(s.reviewed_score) : ""]))
  );
  const [note, setNote] = useState(attempt.review_note ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save(confirm: boolean) {
    setSaving(true);
    setMessage(null);
    const res = await adminFetch<{ assessment: SimAssessmentRow }>(`/api/admin/simulator/assessments/${attempt.id}`, {
      method: "PATCH",
      body: {
        scores: Object.fromEntries(Object.entries(scores).map(([id, v]) => [id, v.trim() === "" ? null : Number(v)])),
        note,
        confirm,
      },
    });
    setSaving(false);
    if ("error" in res) setMessage(res.error);
    else {
      setMessage(confirm ? "Confirmed. The coach can see the result." : "Saved.");
      onSaved();
    }
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-3">
        {coach?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coach.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">{coach?.full_name ?? "Coach"}</p>
          <p className="text-sm text-slate-500">
            Started {formatSimDate(attempt.created_at)} · {STATUS[attempt.status]}
          </p>
        </div>
        {attempt.average !== null ? (
          <p className={`rounded-full px-3 py-1 text-sm font-semibold ${attempt.passed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
            Average {attempt.average} · {attempt.passed ? "Pass" : "Below the mark"}
          </p>
        ) : null}
      </div>
      <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100">
        {attempt.sessions.map((s) => {
          const c = clientById(s.client_id);
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
              <Link href={`/admin/simulator/${s.id}`} className="min-w-0 flex-1 font-medium text-[#0c5290] hover:underline">
                {c?.firstName} · {difficultyById(s.difficulty)?.label} · AI score {s.score ?? "–"}/50
              </Link>
              <label className="flex items-center gap-2 text-slate-600">
                Your score
                <input
                  inputMode="numeric"
                  value={scores[s.id] ?? ""}
                  onChange={(e) => setScores((m) => ({ ...m, [s.id]: e.target.value.replace(/[^0-9]/g, "").slice(0, 2) }))}
                  placeholder={String(s.score ?? "")}
                  className="w-14 rounded-lg border border-slate-300 px-2 py-1 text-right tabular-nums"
                  aria-label={`Your score for ${c?.firstName}`}
                />
              </label>
            </li>
          );
        })}
      </ul>
      {attempt.status !== "in_progress" ? (
        <>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="A note for the coach (optional)"
            rows={2}
            className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void save(false)} disabled={saving} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
              Save
            </button>
            <button type="button" onClick={() => void save(true)} disabled={saving} className="rounded-full bg-[#051e36] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0c5290]">
              Confirm result
            </button>
            {message ? <span className="text-sm text-slate-600">{message}</span> : null}
          </div>
        </>
      ) : null}
    </article>
  );
}
