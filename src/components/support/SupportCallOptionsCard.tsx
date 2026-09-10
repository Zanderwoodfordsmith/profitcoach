"use client";

import { useCallback, useEffect, useState } from "react";
import type { CoachCalendarRow } from "@/lib/booking/coachCalendars";
import {
  SUPPORT_CALL_CALENDAR_SLUG,
  supportCallMeetingLocationUrl,
} from "@/lib/support/supportCallHosts";
import { supabaseClient } from "@/lib/supabaseClient";

type Props = {
  forSlug: string;
};

/**
 * Compact support-call options: length, notice, window, buffer.
 * Uses the host’s `support` calendar row.
 */
export function SupportCallOptionsCard({ forSlug }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [calendar, setCalendar] = useState<CoachCalendarRow | null>(null);

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
    setLoading(true);
    setError(null);
    const res = await fetch(
      `/api/coach/calendars?forSlug=${encodeURIComponent(forSlug)}`,
      { headers }
    );
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      calendars?: CoachCalendarRow[];
    };
    if (!res.ok) {
      setError(body.error ?? "Could not load call options.");
      setLoading(false);
      return;
    }
    const support =
      (body.calendars ?? []).find(
        (c) => c.slug === SUPPORT_CALL_CALENDAR_SLUG
      ) ?? null;
    setCalendar(support);
    if (!support) {
      setError("Support calendar not found for this host.");
    }
    setLoading(false);
  }, [authHeaders, forSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  function patchLocal(
    key:
      | "meeting_duration_minutes"
      | "buffer_minutes"
      | "min_notice_hours"
      | "booking_window_days",
    value: number
  ) {
    setCalendar((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function save() {
    if (!calendar) return;
    setSaving(true);
    setError(null);
    setSavedFlash(false);
    const headers = await authHeaders();
    if (!headers) {
      setSaving(false);
      setError("Not signed in.");
      return;
    }
    const res = await fetch(
      `/api/coach/calendars/${encodeURIComponent(calendar.id)}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          forSlug,
          meeting_duration_minutes: calendar.meeting_duration_minutes,
          buffer_minutes: calendar.buffer_minutes,
          min_notice_hours: calendar.min_notice_hours,
          booking_window_days: calendar.booking_window_days,
          is_enabled: true,
          is_public: true,
          location_mode: "custom",
          location_custom:
            supportCallMeetingLocationUrl(forSlug) ??
            calendar.location_custom,
          location_phone: null,
        }),
      }
    );
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      calendar?: CoachCalendarRow;
    };
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Could not save.");
      return;
    }
    if (body.calendar) setCalendar(body.calendar);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2000);
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200/80 bg-white p-4">
        <p className="text-sm text-slate-600">Loading call options…</p>
      </div>
    );
  }

  if (!calendar) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
        <p className="text-sm text-rose-700">
          {error ?? "Support calendar not found."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">Call options</h3>
      <p className="mt-0.5 text-xs text-slate-500">
        Length, how far ahead people can book, and notice before a slot. Starts
        are offered on the hour and half-hour.
      </p>

      {(() => {
        const zoomUrl =
          calendar.location_custom?.trim() ||
          supportCallMeetingLocationUrl(forSlug);
        if (!zoomUrl) return null;
        return (
          <p className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Meeting location:{" "}
            <a
              href={zoomUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-sky-700 hover:underline"
            >
              {zoomUrl.replace(/^https?:\/\//, "")}
            </a>
          </p>
        );
      })()}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Duration (min)</span>
          <input
            type="number"
            min={5}
            max={180}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={calendar.meeting_duration_minutes}
            onChange={(e) =>
              patchLocal(
                "meeting_duration_minutes",
                Number(e.target.value) || 20
              )
            }
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Buffer (min)</span>
          <input
            type="number"
            min={0}
            max={120}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={calendar.buffer_minutes}
            onChange={(e) =>
              patchLocal("buffer_minutes", Number(e.target.value) || 0)
            }
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">
            Min notice (hours)
          </span>
          <input
            type="number"
            min={0}
            max={168}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={calendar.min_notice_hours}
            onChange={(e) =>
              patchLocal("min_notice_hours", Number(e.target.value) || 0)
            }
          />
          <span className="mt-1 block text-[11px] text-slate-400">
            How soon the next bookable slot can be
          </span>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">
            Book up to (days ahead)
          </span>
          <input
            type="number"
            min={1}
            max={90}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={calendar.booking_window_days}
            onChange={(e) =>
              patchLocal(
                "booking_window_days",
                Number(e.target.value) || 14
              )
            }
          />
          <span className="mt-1 block text-[11px] text-slate-400">
            How far into the future slots appear
          </span>
        </label>
      </div>

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save options"}
        </button>
        {savedFlash ? (
          <span className="text-xs font-medium text-emerald-700">Saved</span>
        ) : null}
      </div>
    </div>
  );
}
