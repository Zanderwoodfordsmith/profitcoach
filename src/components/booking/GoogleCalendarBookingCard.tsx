"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { supabaseClient } from "@/lib/supabaseClient";

type CalendarItem = {
  id: string;
  summary: string;
  primary: boolean;
  accessRole: string;
};

type GoogleStatus = {
  configured: boolean;
  connected: boolean;
  email: string | null;
  calendars: CalendarItem[];
  busy_calendar_ids: string[];
  event_calendar_id: string;
};

function GoogleCalendarMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="28"
      height="28"
      aria-hidden
    >
      <path fill="#fff" d="M4 4h16v16H4z" />
      <path
        fill="#1a73e8"
        d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"
      />
      <path fill="#ea4335" d="M5 4h2v2H5zm12 0h2v2h-2z" />
      <text
        x="12"
        y="18.5"
        textAnchor="middle"
        fill="#1a73e8"
        fontSize="9"
        fontFamily="Arial, sans-serif"
        fontWeight="700"
      >
        31
      </text>
    </svg>
  );
}

/**
 * Compact integrations list for Settings → Calendar (expand for prefs).
 */
export function GoogleCalendarBookingCard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [eventCalendarId, setEventCalendarId] = useState("primary");
  const [googleOpen, setGoogleOpen] = useState(false);
  const [busyOpen, setBusyOpen] = useState(false);

  const authHeaders = useCallback(async () => {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) return null;
    return {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    };
  }, []);

  const load = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) {
      setError("Not signed in.");
      setLoading(false);
      return;
    }
    const res = await fetch("/api/coach/google-calendar", { headers });
    const body = (await res.json().catch(() => ({}))) as GoogleStatus & {
      error?: string;
    };
    if (!res.ok) {
      setError(body.error ?? "Could not load Google Calendar status.");
      setLoading(false);
      return;
    }
    setStatus(body);
    setBusyIds(body.busy_calendar_ids ?? []);
    setEventCalendarId(body.event_calendar_id || "primary");
    setLoading(false);
  }, [authHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const flag = searchParams.get("google_calendar");
    if (!flag) return;
    if (flag === "connected") {
      setBanner("Google Calendar connected.");
      setGoogleOpen(true);
      void load();
    } else {
      setBanner(`Google connect issue: ${flag.replace(/_/g, " ")}`);
    }
    const next = new URLSearchParams(searchParams.toString());
    next.delete("google_calendar");
    if (!next.get("tab")) next.set("tab", "calendar");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [searchParams, pathname, router, load]);

  async function connect() {
    setConnecting(true);
    setError(null);
    const headers = await authHeaders();
    if (!headers) {
      setConnecting(false);
      setError("Not signed in.");
      return;
    }
    const returnTo = pathname.startsWith("/admin")
      ? "/admin/account?tab=calendar"
      : "/coach/settings?tab=calendar";
    const res = await fetch(
      `/api/coach/google-calendar/connect?returnTo=${encodeURIComponent(returnTo)}`,
      { headers }
    );
    const body = (await res.json().catch(() => ({}))) as {
      url?: string;
      error?: string;
    };
    setConnecting(false);
    if (!res.ok || !body.url) {
      setError(body.error ?? "Could not start Google connect.");
      return;
    }
    window.location.href = body.url;
  }

  async function disconnect() {
    if (!window.confirm("Disconnect Google Calendar from booking?")) return;
    setSaving(true);
    setError(null);
    const headers = await authHeaders();
    if (!headers) {
      setSaving(false);
      setError("Not signed in.");
      return;
    }
    const res = await fetch("/api/coach/google-calendar", {
      method: "DELETE",
      headers,
    });
    setSaving(false);
    if (!res.ok) {
      setError("Could not disconnect.");
      return;
    }
    setBanner("Google Calendar disconnected.");
    setGoogleOpen(false);
    setBusyOpen(false);
    void load();
  }

  async function saveCalendars() {
    setSaving(true);
    setError(null);
    const headers = await authHeaders();
    if (!headers) {
      setSaving(false);
      setError("Not signed in.");
      return;
    }
    const res = await fetch("/api/coach/google-calendar", {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        busy_calendar_ids: busyIds,
        event_calendar_id: eventCalendarId,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
    };
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Could not save calendar choices.");
      return;
    }
    setBanner("Calendar preferences saved.");
    void load();
  }

  function toggleBusy(id: string) {
    setBusyIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const writableCalendars = useMemo(
    () =>
      (status?.calendars ?? []).filter(
        (c) =>
          c.accessRole === "owner" ||
          c.accessRole === "writer" ||
          c.primary
      ),
    [status?.calendars]
  );

  const busyLabel = useMemo(() => {
    const selected = (status?.calendars ?? []).filter((c) =>
      busyIds.includes(c.id)
    );
    if (selected.length === 0) return "None selected";
    if (selected.length === 1) return selected[0]?.summary ?? "1 calendar";
    return `${selected.length} calendars`;
  }, [busyIds, status?.calendars]);

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-200/80 bg-white p-4">
        <p className="text-sm text-slate-600">Loading integrations…</p>
      </section>
    );
  }

  const connected = Boolean(status?.connected);

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Integrations</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Connect once — expand a row to adjust sync settings.
        </p>
      </div>

      {banner ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {banner}
        </p>
      ) : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {!status?.configured ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Google OAuth isn&apos;t configured on this environment yet.
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
            onClick={() => setGoogleOpen((o) => !o)}
            aria-expanded={googleOpen}
          >
            {googleOpen ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
            )}
            <GoogleCalendarMark className="h-7 w-7 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">
                Google Calendar
              </p>
              {connected ? (
                <p className="truncate text-xs text-slate-500">
                  {status?.email ?? "Connected"}
                </p>
              ) : (
                <p className="text-xs text-slate-400">Not connected</p>
              )}
            </div>
          </button>
          {connected ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700">
              <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
              Connected
            </span>
          ) : (
            <button
              type="button"
              disabled={connecting || !status?.configured}
              onClick={() => void connect()}
              className="shrink-0 text-sm font-medium text-teal-700 hover:text-teal-800 disabled:opacity-60"
            >
              {connecting ? "Opening…" : "Connect"}
            </button>
          )}
        </div>

        {googleOpen && connected ? (
          <div className="space-y-4 border-t border-slate-100 px-4 py-4">
            <label className="block text-sm">
              <span className="font-medium text-slate-700">
                Calendar for new bookings
              </span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={eventCalendarId}
                onChange={(e) => setEventCalendarId(e.target.value)}
              >
                {writableCalendars.map((cal) => (
                  <option key={cal.id} value={cal.id}>
                    {cal.summary}
                    {cal.primary ? " (primary)" : ""}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-lg border border-slate-100">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
                onClick={() => setBusyOpen((o) => !o)}
                aria-expanded={busyOpen}
              >
                {busyOpen ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">
                    Calendars that block availability
                  </p>
                  <p className="truncate text-xs text-slate-500">{busyLabel}</p>
                </div>
              </button>
              {busyOpen ? (
                <ul className="max-h-48 space-y-1.5 overflow-y-auto border-t border-slate-100 px-3 py-2.5">
                  {(status?.calendars ?? []).map((cal) => (
                    <li key={cal.id}>
                      <label className="flex items-start gap-2 text-sm text-slate-800">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600"
                          checked={busyIds.includes(cal.id)}
                          onChange={() => toggleBusy(cal.id)}
                        />
                        <span className="min-w-0 break-words">
                          {cal.summary}
                          {cal.primary ? (
                            <span className="ml-1 text-xs text-slate-400">
                              (primary)
                            </span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={saving || busyIds.length === 0}
                onClick={() => void saveCalendars()}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save preferences"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void disconnect()}
                className="text-sm font-medium text-rose-700/90 hover:text-rose-800 disabled:opacity-60"
              >
                Disconnect
              </button>
            </div>
          </div>
        ) : null}

        {googleOpen && !connected ? (
          <div className="border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
            Connect Google to block busy times and create Meet links when someone
            books.
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-white">
        <div className="flex items-center gap-3 px-4 py-3">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#2D8CFF] text-[10px] font-bold text-white"
            aria-hidden
          >
            Z
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">Zoom</p>
            <p className="text-xs text-slate-400">Coming soon</p>
          </div>
          <span className="shrink-0 text-sm font-medium text-slate-300">
            Connect
          </span>
        </div>
      </div>
    </div>
  );
}
