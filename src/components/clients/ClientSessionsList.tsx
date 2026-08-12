"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Plus } from "lucide-react";
import type { ClientSessionRow } from "@/lib/clientCoaching/loadClientSessions";
import { formatShortTime } from "@/lib/formatShortDate";
import { getValidSupabaseAccessToken } from "@/lib/supabaseAccessToken";

type Props = {
  contactId: string;
  impersonateCoachId?: string | null;
  /** When set, only show sessions on this YYYY-MM-DD day */
  filterDateKey?: string | null;
  compact?: boolean;
  onSessionsLoaded?: (sessions: ClientSessionRow[]) => void;
  /** Open notes editor for a session */
  onOpenNotes?: (session: ClientSessionRow) => void;
  showLogButton?: boolean;
};

function dayParts(iso: string): { day: string; weekday: string } {
  const d = new Date(iso);
  return {
    day: new Intl.DateTimeFormat("en-GB", { day: "numeric" }).format(d),
    weekday: new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(d),
  };
}

function timeRange(startsAt: string, endsAt: string | null): string {
  const start = formatShortTime(startsAt);
  if (!endsAt) return start;
  return `${start}–${formatShortTime(endsAt)}`;
}

function sourceLabel(source: ClientSessionRow["source"]): string {
  if (source === "manual") return "Logged";
  if (source === "ghl") return "Calendar";
  return "Booked";
}

export function ClientSessionsList({
  contactId,
  impersonateCoachId = null,
  filterDateKey = null,
  compact = false,
  onSessionsLoaded,
  onOpenNotes,
  showLogButton = true,
}: Props) {
  const [sessions, setSessions] = useState<ClientSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [logTitle, setLogTitle] = useState("Coaching session");
  const [logWhen, setLogWhen] = useState("");
  const [logNotes, setLogNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const authHeaders = useCallback(async () => {
    const token = await getValidSupabaseAccessToken();
    if (!token) return null;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (impersonateCoachId) {
      headers["x-impersonate-coach-id"] = impersonateCoachId;
    }
    return headers;
  }, [impersonateCoachId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) {
        setError("Sign in again.");
        return;
      }
      const res = await fetch(
        `/api/coach/contacts/${encodeURIComponent(contactId)}/sessions`,
        { headers, cache: "no-store" }
      );
      const body = (await res.json().catch(() => ({}))) as {
        sessions?: ClientSessionRow[];
        error?: string;
      };
      if (!res.ok) {
        setError(body.error ?? "Unable to load sessions.");
        setSessions([]);
        return;
      }
      const rows = body.sessions ?? [];
      setSessions(rows);
      onSessionsLoaded?.(rows);
    } catch {
      setError("Unable to load sessions.");
      setSessions([]);
    } finally {
      setLoading(false);
    }
    // Intentionally omit onSessionsLoaded — parent should keep it stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authHeaders, contactId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const now = Date.now();
    let rows = sessions;
    if (filterDateKey) {
      rows = rows.filter((s) => {
        const d = new Date(s.startsAt);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}` === filterDateKey;
      });
    }
    // Past + upcoming: show past first in list (already desc), limit in compact
    if (compact) {
      const past = rows.filter((s) => new Date(s.startsAt).getTime() <= now);
      return (past.length ? past : rows).slice(0, 8);
    }
    return rows;
  }, [sessions, filterDateKey, compact]);

  async function handleLog(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Sign in again.");
      const startsAt = logWhen
        ? new Date(logWhen).toISOString()
        : new Date().toISOString();
      const res = await fetch(
        `/api/coach/contacts/${encodeURIComponent(contactId)}/sessions`,
        {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            title: logTitle || "Coaching session",
            startsAt,
            notes: logNotes,
          }),
        }
      );
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Unable to log session.");
      setShowLog(false);
      setLogNotes("");
      setLogWhen("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to log session.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">
          {compact ? "Past coaching sessions" : "Coaching sessions"}
        </h3>
        {showLogButton ? (
          <button
            type="button"
            onClick={() => setShowLog((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-50"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {showLog ? "Cancel" : "Log session"}
          </button>
        ) : null}
      </div>

      {showLog ? (
        <form
          onSubmit={handleLog}
          className="space-y-2 border-b border-slate-100 px-4 py-3"
        >
          <input
            type="text"
            value={logTitle}
            onChange={(e) => setLogTitle(e.target.value)}
            placeholder="Session title"
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
          />
          <input
            type="datetime-local"
            value={logWhen}
            onChange={(e) => setLogWhen(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
          />
          <textarea
            value={logNotes}
            onChange={(e) => setLogNotes(e.target.value)}
            rows={3}
            placeholder="Session notes (optional)"
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-70"
          >
            {saving ? "Saving…" : "Save session"}
          </button>
        </form>
      ) : null}

      {loading ? (
        <p className="px-4 py-6 text-sm text-slate-500">Loading sessions…</p>
      ) : null}
      {error ? (
        <p className="px-4 py-3 text-sm text-rose-600">{error}</p>
      ) : null}

      {!loading && !error && visible.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">
          No coaching sessions yet. Book a call or log one manually.
        </p>
      ) : null}

      {!loading && visible.length > 0 ? (
        <ul className="divide-y divide-slate-100">
          {visible.map((session) => {
            const { day, weekday } = dayParts(session.startsAt);
            const key =
              session.id ||
              session.bookingId ||
              session.ghlAppointmentId ||
              session.startsAt;
            return (
              <li
                key={key}
                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/80"
              >
                <div className="flex w-12 shrink-0 flex-col items-center rounded-lg bg-slate-50 py-1.5">
                  <span className="text-lg font-semibold leading-none text-slate-900">
                    {day}
                  </span>
                  <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    {weekday}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {session.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {sourceLabel(session.source)}
                    {session.sessionType && session.sessionType !== "coaching"
                      ? ` · ${session.sessionType}`
                      : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right text-xs text-slate-500">
                  {timeRange(session.startsAt, session.endsAt)}
                </div>
                {onOpenNotes ? (
                  <button
                    type="button"
                    onClick={() => onOpenNotes(session)}
                    title={session.notes?.trim() ? "Edit notes" : "Add notes"}
                    className={`shrink-0 rounded-md p-1.5 ${
                      session.notes?.trim()
                        ? "text-sky-700 hover:bg-sky-50"
                        : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    }`}
                  >
                    <FileText className="h-4 w-4" aria-hidden />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
