"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
      void load();
    } else {
      setBanner(`Google connect issue: ${flag.replace(/_/g, " ")}`);
    }
    const next = new URLSearchParams(searchParams.toString());
    next.delete("google_calendar");
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
      ? "/admin/funnel-settings"
      : "/coach/funnel-settings";
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

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Loading Google Calendar…</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="h-1 bg-gradient-to-r from-sky-500 to-sky-400" aria-hidden />
      <div className="space-y-4 p-6">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Google Calendar sync
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Block times you&apos;re already busy, and write new bookings onto a
            calendar (with Google Meet when selected).
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
            Google OAuth isn&apos;t configured on this environment yet. Add the
            Google Cloud credentials to{" "}
            <code className="text-xs">.env.local</code> (see team notes) and
            restart the server.
          </p>
        ) : null}

        {!status?.connected ? (
          <button
            type="button"
            disabled={connecting || !status?.configured}
            onClick={() => void connect()}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {connecting ? "Opening Google…" : "Connect Google Calendar"}
          </button>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <p className="text-sm text-slate-700">
                Connected as{" "}
                <span className="font-semibold">
                  {status.email ?? "Google account"}
                </span>
              </p>
              <button
                type="button"
                disabled={saving}
                onClick={() => void disconnect()}
                className="text-xs font-semibold text-rose-700 hover:underline"
              >
                Disconnect
              </button>
            </div>

            <div>
              <p className="text-sm font-medium text-slate-800">
                Calendars that block availability
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Dentist, other calls, etc. on these calendars remove open slots.
              </p>
              <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto">
                {(status.calendars ?? []).map((cal) => (
                  <li key={cal.id}>
                    <label className="flex items-center gap-2 text-sm text-slate-800">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-sky-600"
                        checked={busyIds.includes(cal.id)}
                        onChange={() => toggleBusy(cal.id)}
                      />
                      <span>
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
            </div>

            <label className="block text-sm">
              <span className="font-medium text-slate-700">
                Calendar for new bookings
              </span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={eventCalendarId}
                onChange={(e) => setEventCalendarId(e.target.value)}
              >
                {(status.calendars ?? [])
                  .filter(
                    (c) =>
                      c.accessRole === "owner" ||
                      c.accessRole === "writer" ||
                      c.primary
                  )
                  .map((cal) => (
                    <option key={cal.id} value={cal.id}>
                      {cal.summary}
                      {cal.primary ? " (primary)" : ""}
                    </option>
                  ))}
              </select>
            </label>

            <button
              type="button"
              disabled={saving || busyIds.length === 0}
              onClick={() => void saveCalendars()}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save calendar preferences"}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
