"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";

type Disposition = "interested" | "neutral" | "not_interested";
type NextStep = "calendar" | "scorecard" | "answer" | "nurture" | "no_reply" | "human";

type Row = {
  id: string;
  coach_name: string;
  prospect_name: string;
  prospect_business: string;
  inbound_text: string;
  inbound_at: string | null;
  disposition: Disposition;
  situation: string | null;
  next_step: NextStep;
  confidence: number | null;
  reason: string | null;
  draft: string | null;
  alert_sent_at: string | null;
  admin_disposition: Disposition | null;
  admin_next_step: NextStep | null;
  admin_note: string | null;
};

type Stats = { labelled: number; dispositionAgree: number; stepAgree: number; calendarCalls: number; calendarRight: number };

const DISPOSITION_LABEL: Record<Disposition, string> = {
  interested: "Positive",
  neutral: "Neutral",
  not_interested: "Deselect",
};

const STEP_LABEL: Record<NextStep, string> = {
  calendar: "Send calendar",
  scorecard: "Send BOSS Score",
  answer: "Answer question",
  nurture: "Keep it going",
  no_reply: "No reply",
  human: "Coach handles",
};

async function adminHeaders(): Promise<Record<string, string> | null> {
  const headers = await getCoachAuthHeaders(null);
  if (!headers) return null;
  delete headers["x-impersonate-coach-id"];
  return headers;
}

function pct(a: number, b: number) {
  return b ? `${Math.round((100 * a) / b)}%` : "–";
}

export function AvaReplyReview() {
  const [view, setView] = useState<"todo" | "labelled" | "all">("todo");
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const headers = await adminHeaders();
    if (!headers) {
      setError("Sign in again to load replies.");
      setLoading(false);
      return;
    }
    const res = await fetch(`/api/admin/ava/replies?view=${view}`, { headers });
    const body = (await res.json().catch(() => null)) as { rows?: Row[]; stats?: Stats; error?: string } | null;
    if (!res.ok || !body?.rows) {
      setError(body?.error ?? "Could not load replies.");
    } else {
      setError(null);
      setRows(body.rows);
      setStats(body.stats ?? null);
    }
    setLoading(false);
  }, [view]);

  useEffect(() => {
    void load();
  }, [load]);

  const label = async (row: Row, disposition: Disposition, nextStep: NextStep, note: string) => {
    const headers = await adminHeaders();
    if (!headers) return;
    const res = await fetch("/api/admin/ava/replies", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ id: row.id, disposition, next_step: nextStep, note }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Could not save.");
      return;
    }
    setRows((prev) =>
      view === "todo"
        ? prev.filter((r) => r.id !== row.id)
        : prev.map((r) => (r.id === row.id ? { ...r, admin_disposition: disposition, admin_next_step: nextStep, admin_note: note } : r))
    );
    setStats((s) =>
      s
        ? {
            labelled: s.labelled + (row.admin_disposition ? 0 : 1),
            dispositionAgree: s.dispositionAgree + (!row.admin_disposition && disposition === row.disposition ? 1 : 0),
            stepAgree: s.stepAgree + (!row.admin_disposition && nextStep === row.next_step ? 1 : 0),
            calendarCalls: s.calendarCalls + (!row.admin_disposition && row.next_step === "calendar" ? 1 : 0),
            calendarRight: s.calendarRight + (!row.admin_disposition && row.next_step === "calendar" && nextStep === "calendar" ? 1 : 0),
          }
        : s
    );
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/admin/ava" className="text-sm text-slate-500 hover:text-slate-800">
        ← Ava
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">Reply review</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">
        Every positive and neutral reply Ava has read, with her call on what to do next. Confirm or correct each one.
        Autopilot stays off until these agree often enough, especially on when to send the calendar.
      </p>

      {stats ? (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Labelled", String(stats.labelled)],
            ["Type agrees", pct(stats.dispositionAgree, stats.labelled)],
            ["Next step agrees", pct(stats.stepAgree, stats.labelled)],
            ["Calendar calls right", `${pct(stats.calendarRight, stats.calendarCalls)} of ${stats.calendarCalls}`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">{k}</div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{v}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-6 flex gap-2">
        {(["todo", "labelled", "all"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`rounded-md border px-3 py-1.5 text-sm ${view === v ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700"}`}
          >
            {v === "todo" ? "To review" : v === "labelled" ? "Reviewed" : "All"}
          </button>
        ))}
      </div>

      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="mt-6 text-sm text-slate-500">Loading replies…</p> : null}
      {!loading && rows.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">
          Nothing here yet. Replies appear as coaches&apos; LinkedIn inboxes sync, or after running the triage backfill script.
        </p>
      ) : null}

      <div className="mt-4 space-y-4">
        {rows.map((row) => (
          <ReplyCard key={row.id} row={row} onLabel={label} />
        ))}
      </div>
    </div>
  );
}

function ReplyCard({
  row,
  onLabel,
}: {
  row: Row;
  onLabel: (row: Row, d: Disposition, s: NextStep, note: string) => Promise<void>;
}) {
  const [disposition, setDisposition] = useState<Disposition>(row.admin_disposition ?? row.disposition);
  const [step, setStep] = useState<NextStep>(row.admin_next_step ?? row.next_step);
  const [note, setNote] = useState(row.admin_note ?? "");
  const [saving, setSaving] = useState(false);

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-slate-500">
        <span>
          {row.coach_name || "Coach"} ← {row.prospect_name || "Prospect"}
          {row.prospect_business ? `, ${row.prospect_business}` : ""}
        </span>
        <span>{row.inbound_at ? new Date(row.inbound_at).toLocaleString("en-GB") : ""}</span>
      </div>
      <blockquote className="mt-2 whitespace-pre-wrap border-l-2 border-slate-300 pl-3 text-sm text-slate-900">
        {row.inbound_text}
      </blockquote>
      <p className="mt-3 text-sm text-slate-700">
        <span className="font-medium">Ava:</span> {DISPOSITION_LABEL[row.disposition]} · {STEP_LABEL[row.next_step]}
        {row.confidence != null ? ` · ${Math.round(Number(row.confidence) * 100)}% sure` : ""}
        {row.reason ? <span className="text-slate-500"> · {row.reason}</span> : null}
      </p>
      {row.draft ? (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-slate-500">Ava&apos;s draft</summary>
          <p className="mt-1 whitespace-pre-wrap rounded bg-slate-50 p-2 text-slate-800">{row.draft}</p>
        </details>
      ) : null}

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-600">
          Type
          <select
            id={`disp-${row.id}`}
            className="mt-1 block rounded border border-slate-300 px-2 py-1 text-sm"
            value={disposition}
            onChange={(e) => setDisposition(e.target.value as Disposition)}
          >
            {(Object.keys(DISPOSITION_LABEL) as Disposition[]).map((d) => (
              <option key={d} value={d}>
                {DISPOSITION_LABEL[d]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-600">
          Right next step
          <select
            id={`step-${row.id}`}
            className="mt-1 block rounded border border-slate-300 px-2 py-1 text-sm"
            value={step}
            onChange={(e) => setStep(e.target.value as NextStep)}
          >
            {(Object.keys(STEP_LABEL) as NextStep[]).map((s) => (
              <option key={s} value={s}>
                {STEP_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[12rem] flex-1 text-xs text-slate-600">
          Why (optional)
          <input
            id={`note-${row.id}`}
            className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. asked about price first, no calendar yet"
          />
        </label>
        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            await onLabel(row, disposition, step, note);
            setSaving(false);
          }}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {row.admin_disposition ? "Update" : disposition === row.disposition && step === row.next_step ? "Ava is right" : "Save correction"}
        </button>
      </div>
    </article>
  );
}
