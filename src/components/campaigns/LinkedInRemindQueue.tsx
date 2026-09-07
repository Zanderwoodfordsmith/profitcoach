"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { supabaseClient } from "@/lib/supabaseClient";

type RemindItem = {
  job_id: string;
  campaign_id: string;
  campaign_name: string;
  lead_id: string;
  scheduled_for: string;
  preview_body: string;
  draft_body: string | null;
  fallback_at: string | null;
  state: "upcoming" | "due" | "overdue";
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  linkedin_url: string | null;
};

type Counts = { due: number; overdue: number; upcoming: number };

async function authHeaders(): Promise<HeadersInit | null> {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (!session?.access_token) return null;
  return {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
}

function leadName(item: RemindItem) {
  return (
    [item.first_name, item.last_name].filter(Boolean).join(" ") ||
    item.linkedin_url ||
    "Unknown"
  );
}

function relativeDue(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  const mins = Math.round(ms / 60000);
  if (Math.abs(mins) < 60) {
    if (mins >= 0) return `in ${mins}m`;
    return `${Math.abs(mins)}m overdue`;
  }
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 48) {
    if (hours >= 0) return `in ${hours}h`;
    return `${Math.abs(hours)}h overdue`;
  }
  const days = Math.round(hours / 24);
  if (days >= 0) return `in ${days}d`;
  return `${Math.abs(days)}d overdue`;
}

/**
 * Coach-send queue: planned message steps that need a human send.
 * Inbox stays for replies — this is the proactive work queue.
 */
export function LinkedInRemindQueue() {
  const pathname = usePathname() ?? "";
  const prefix = pathname.startsWith("/admin") ? "/admin" : "/coach";
  const [items, setItems] = useState<RemindItem[]>([]);
  const [counts, setCounts] = useState<Counts>({
    due: 0,
    overdue: 0,
    upcoming: 0,
  });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch("/api/coach/linkedin-outreach/remind", {
        headers,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not load due queue.");
      setItems(body.queue ?? []);
      setCounts(body.counts ?? { due: 0, overdue: 0, upcoming: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(
    jobId: string,
    action: "send" | "skip" | "snooze",
    extra?: { body?: string; hours?: number }
  ) {
    setBusyId(jobId);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch("/api/coach/linkedin-outreach/remind", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action,
          job_id: jobId,
          body: extra?.body,
          hours: extra?.hours,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Action failed.");
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusyId(null);
    }
  }

  const actionable = items.filter((i) => i.state !== "upcoming");
  const upcoming = items.filter((i) => i.state === "upcoming");
  const badge = counts.due + counts.overdue;

  if (loading && items.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200/90 bg-white px-5 py-8 text-center text-sm text-slate-500 shadow-sm shadow-slate-200/40">
        <Loader2 className="mx-auto h-4 w-4 animate-spin" />
        <p className="mt-2">Loading due sends…</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-200/40">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Due to send
            {badge > 0 ? (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-amber-900">
                {badge}
              </span>
            ) : null}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Remind-me steps — edit, send, or skip. Inbox stays for replies.
            {counts.overdue > 0
              ? ` · ${counts.overdue} overdue`
              : ""}
            {counts.upcoming > 0
              ? ` · ${counts.upcoming} upcoming`
              : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="border-b border-rose-100 bg-rose-50 px-5 py-2.5 text-xs text-rose-800">
          {error}
        </div>
      ) : null}

      {actionable.length === 0 && upcoming.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm font-medium text-slate-800">Nothing due</p>
          <p className="mt-1 text-xs text-slate-500">
            Message steps set to “Remind me” will appear here when their wait
            ends.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {actionable.map((item) => {
            const open = editingId === item.job_id;
            const busy = busyId === item.job_id;
            return (
              <li key={item.job_id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {leadName(item)}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          item.state === "overdue"
                            ? "bg-rose-50 text-rose-800"
                            : "bg-amber-50 text-amber-900"
                        }`}
                      >
                        {item.state === "overdue" ? "Overdue" : "Due"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      <Link
                        href={`${prefix}/campaigns/${item.campaign_id}`}
                        className="font-medium text-[#0c5290] hover:underline"
                      >
                        {item.campaign_name}
                      </Link>
                      {item.company ? ` · ${item.company}` : ""}
                      {" · "}
                      {relativeDue(item.scheduled_for)}
                      {item.fallback_at
                        ? ` · fallback ${relativeDue(item.fallback_at)}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setEditingId(open ? null : item.job_id);
                        setDraft(item.draft_body || item.preview_body);
                      }}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {open ? "Close" : "Edit & send"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void act(item.job_id, "send", {
                          body: item.draft_body || item.preview_body,
                        })
                      }
                      className="rounded-lg bg-[#0c5290] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0a457a] disabled:opacity-50"
                    >
                      Send
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void act(item.job_id, "snooze", { hours: 24 })}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Snooze 1d
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (!window.confirm("Skip this message and continue the sequence?"))
                          return;
                        void act(item.job_id, "skip");
                      }}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                    >
                      Skip
                    </button>
                  </div>
                </div>
                {open ? (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={5}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                    <button
                      type="button"
                      disabled={busy || !draft.trim()}
                      onClick={() =>
                        void act(item.job_id, "send", { body: draft })
                      }
                      className="rounded-lg bg-[#0c5290] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0a457a] disabled:opacity-50"
                    >
                      {busy ? "Sending…" : "Send personalised"}
                    </button>
                  </div>
                ) : (
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500">
                    {item.draft_body || item.preview_body}
                  </p>
                )}
              </li>
            );
          })}
          {upcoming.slice(0, 5).map((item) => (
            <li
              key={item.job_id}
              className="bg-slate-50/60 px-5 py-3 text-xs text-slate-500"
            >
              <span className="font-medium text-slate-700">
                {leadName(item)}
              </span>
              {" · "}
              {item.campaign_name}
              {" · upcoming "}
              {relativeDue(item.scheduled_for)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
