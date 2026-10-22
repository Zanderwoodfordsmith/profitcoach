"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";

type View = "queued" | "approved" | "rejected";

type Nudge = {
  id: string;
  coach_id: string;
  coach_name: string;
  coach_slug: string;
  scan_date: string;
  level: "red" | "amber" | "green";
  stuck_at: string;
  next_step: string | null;
  body: string;
  status: "queued" | "approved" | "rejected" | "posted" | "skipped";
  decided_at: string | null;
  posted_at: string | null;
  note: string | null;
};

const VIEW_LABEL: Record<View, string> = { queued: "To approve", approved: "Approved", rejected: "Rejected" };

const LEVEL_STYLE: Record<Nudge["level"], string> = {
  red: "bg-rose-100 text-rose-800",
  amber: "bg-amber-100 text-amber-900",
  green: "bg-emerald-100 text-emerald-800",
};

const STATUS_LABEL: Record<Nudge["status"], string> = {
  queued: "Waiting",
  approved: "Approved, not posted yet",
  rejected: "Rejected",
  posted: "Posted",
  skipped: "Dropped: no longer stuck there",
};

async function adminHeaders(): Promise<Record<string, string> | null> {
  const headers = await getCoachAuthHeaders(null);
  if (!headers) return null;
  delete headers["x-impersonate-coach-id"];
  return headers;
}

function day(ymd: string) {
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export function AvaNudgeQueue() {
  const [view, setView] = useState<View>("queued");
  const [rows, setRows] = useState<Nudge[]>([]);
  const [counts, setCounts] = useState<Partial<Record<View, number>>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);

  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const headers = await adminHeaders();
      if (cancelled) return;
      if (!headers) {
        setError("Sign in again to load nudges.");
        setLoading(false);
        return;
      }
      const res = await fetch(`/api/admin/ava/nudges?view=${view}`, { headers });
      const body = (await res.json().catch(() => null)) as { rows?: Nudge[]; counts?: Record<View, number>; error?: string } | null;
      if (cancelled) return;
      if (!res.ok || !body?.rows) setError(body?.error ?? "Could not load nudges.");
      else {
        setError(null);
        setRows(body.rows);
        setCounts(body.counts ?? {});
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [view, reload]);

  const decide = async (row: Nudge, action: "approve" | "reject" | "save", text: string) => {
    const headers = await adminHeaders();
    if (!headers) return false;
    const res = await fetch("/api/admin/ava/nudges", { method: "PATCH", headers, body: JSON.stringify({ id: row.id, action, body: text }) });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Could not save.");
      return false;
    }
    setError(null);
    if (action === "save") {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, body: text } : r)));
    } else {
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      const to: View = action === "approve" ? "approved" : "rejected";
      setCounts((c) => ({ ...c, queued: Math.max(0, (c.queued ?? 1) - 1), [to]: (c[to] ?? 0) + 1 }));
    }
    return true;
  };

  const scan = async () => {
    setScanning(true);
    setScanNote(null);
    const headers = await adminHeaders();
    if (headers) {
      const res = await fetch("/api/admin/ava/nudges", { method: "POST", headers });
      const body = (await res.json().catch(() => null)) as { stuck?: number; queued?: number; kept?: number; skipped?: number; error?: string } | null;
      if (!res.ok) setError(body?.error ?? "Scan failed.");
      else setScanNote(`${body?.stuck ?? 0} coaches stuck: ${body?.queued ?? 0} new, ${body?.kept ?? 0} still waiting, ${body?.skipped ?? 0} dropped.`);
      setReload((n) => n + 1);
    }
    setScanning(false);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/admin/ava" className="text-sm text-slate-500 hover:text-slate-800">
        ← Ava
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Nudges</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Every morning Ava checks coach health and drafts a nudge for each coach who is stuck. Edit any of them, then
            approve or reject. Nothing reaches a coach until you approve it.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void scan()}
          disabled={scanning}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {scanning ? "Checking coaches…" : "Check coaches now"}
        </button>
      </div>
      {scanNote ? <p className="mt-3 text-sm text-slate-600">{scanNote}</p> : null}

      <div className="mt-6 flex gap-2">
        {(Object.keys(VIEW_LABEL) as View[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => {
              if (v === view) return;
              setLoading(true);
              setView(v);
            }}
            className={`rounded-md border px-3 py-1.5 text-sm ${view === v ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700"}`}
          >
            {VIEW_LABEL[v]}
            {counts[v] != null ? <span className="ml-1.5 tabular-nums opacity-70">{counts[v]}</span> : null}
          </button>
        ))}
      </div>

      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="mt-6 text-sm text-slate-500">Loading nudges…</p> : null}
      {!loading && rows.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">
          {view === "queued" ? "Nothing waiting. New nudges arrive each morning." : "None yet."}
        </p>
      ) : null}

      <div className="mt-4 space-y-4">
        {rows.map((row) => (
          <NudgeCard key={row.id} row={row} onDecide={decide} />
        ))}
      </div>
    </div>
  );
}

function NudgeCard({
  row,
  onDecide,
}: {
  row: Nudge;
  onDecide: (row: Nudge, action: "approve" | "reject" | "save", text: string) => Promise<boolean>;
}) {
  const [text, setText] = useState(row.body);
  const [saving, setSaving] = useState<null | "approve" | "reject" | "save">(null);
  const editable = row.status === "queued" || row.status === "approved";
  const changed = text.trim() !== row.body.trim();

  const run = async (action: "approve" | "reject" | "save") => {
    setSaving(action);
    await onDecide(row, action, text);
    setSaving(null);
  };

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/admin/coaches/${row.coach_slug}`} className="font-medium text-slate-900 hover:underline">
            {row.coach_name || row.coach_slug || "Coach"}
          </Link>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${LEVEL_STYLE[row.level]}`}>{row.stuck_at}</span>
        </div>
        <span className="text-xs text-slate-500">
          {day(row.scan_date)}
          {row.status !== "queued" ? ` · ${STATUS_LABEL[row.status]}` : ""}
        </span>
      </div>
      {row.next_step ? <p className="mt-1 text-xs text-slate-500">Coach health says: {row.next_step}</p> : null}

      {editable ? (
        <textarea
          id={`nudge-${row.id}`}
          aria-label={`Nudge for ${row.coach_name}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          className="mt-3 block w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm leading-relaxed text-slate-900 focus:border-slate-500 focus:outline-none"
        />
      ) : (
        <p className="mt-3 whitespace-pre-wrap rounded-md bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-800">{row.body}</p>
      )}

      {row.status === "queued" ? (
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={saving != null}
            onClick={() => void run("reject")}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {saving === "reject" ? "Rejecting…" : "Reject"}
          </button>
          <button
            type="button"
            disabled={saving != null || !text.trim()}
            onClick={() => void run("approve")}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving === "approve" ? "Approving…" : changed ? "Approve with my edits" : "Approve"}
          </button>
        </div>
      ) : row.status === "approved" && changed ? (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            disabled={saving != null}
            onClick={() => void run("save")}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving === "save" ? "Saving…" : "Save edits"}
          </button>
        </div>
      ) : null}
    </article>
  );
}
