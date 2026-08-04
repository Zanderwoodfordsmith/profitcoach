"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ACCOUNT_SETTING_TIMEZONES, accountTimezoneOptionLabel } from "@/lib/accountProfileTimezones";
import {
  DEFAULT_WEEKDAY_AVAILABILITY,
  type AvailabilityRuleRow,
  type BookingSettingsRow,
} from "@/lib/booking/computeBookingSlots";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
] as const;

function timeInputValue(t: string): string {
  return t.slice(0, 5);
}

type Props = {
  appOrigin: string;
};

export function NativeBookingSettingsCard({ appOrigin }: Props) {
  const { impersonatingCoachId } = useImpersonation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [slug, setSlug] = useState<string | null>(null);
  const [settings, setSettings] = useState<BookingSettingsRow | null>(null);
  const [rules, setRules] = useState<AvailabilityRuleRow[]>([]);
  const [copied, setCopied] = useState(false);

  const authHeaders = useCallback(async () => {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) return null;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    };
    if (impersonatingCoachId) {
      headers["x-impersonate-coach-id"] = impersonatingCoachId;
    }
    return headers;
  }, [impersonatingCoachId]);

  const load = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) {
      setError("Not signed in.");
      setLoading(false);
      return;
    }
    const res = await fetch("/api/coach/booking-settings", { headers });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      slug?: string | null;
      settings?: BookingSettingsRow;
      rules?: AvailabilityRuleRow[];
    };
    if (!res.ok) {
      setError(body.error ?? "Could not load booking settings.");
      setLoading(false);
      return;
    }
    setSlug(body.slug ?? null);
    setSettings(body.settings ?? null);
    setRules(
      body.rules && body.rules.length > 0
        ? body.rules
        : DEFAULT_WEEKDAY_AVAILABILITY.map((r) => ({ ...r }))
    );
    setLoading(false);
  }, [authHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleWeekday(weekday: number) {
    setRules((prev) => {
      const has = prev.some((r) => r.weekday === weekday);
      if (has) return prev.filter((r) => r.weekday !== weekday);
      return [
        ...prev,
        { weekday, start_time: "09:00", end_time: "17:00" },
      ].sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time));
    });
  }

  function updateRuleTime(
    weekday: number,
    field: "start_time" | "end_time",
    value: string
  ) {
    setRules((prev) =>
      prev.map((r) =>
        r.weekday === weekday ? { ...r, [field]: value } : r
      )
    );
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setSaveOk(false);
    setError(null);
    const headers = await authHeaders();
    if (!headers) {
      setSaving(false);
      setError("Not signed in.");
      return;
    }
    const res = await fetch("/api/coach/booking-settings", {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        ...settings,
        rules,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      slug?: string | null;
      settings?: BookingSettingsRow;
      rules?: AvailabilityRuleRow[];
    };
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Save failed.");
      return;
    }
    setSlug(body.slug ?? null);
    if (body.settings) setSettings(body.settings);
    if (body.rules) setRules(body.rules);
    setSaveOk(true);
  }

  const bookPath = slug ? `/book/${encodeURIComponent(slug)}` : null;
  const bookUrl = bookPath
    ? `${appOrigin.replace(/\/$/, "")}${bookPath}`
    : null;

  async function copyLink() {
    if (!bookUrl) return;
    try {
      await navigator.clipboard.writeText(bookUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Loading native booking…</p>
      </section>
    );
  }

  if (!settings) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-rose-600">{error ?? "Unavailable."}</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="h-1 bg-gradient-to-r from-emerald-500 to-emerald-400" aria-hidden />
      <div className="space-y-5 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Native discovery booking
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Prospects pick a day and time on your book page. Bookings land in
              Calls. GHL embed above still works separately.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              checked={settings.is_enabled}
              onChange={(e) =>
                setSettings((s) =>
                  s ? { ...s, is_enabled: e.target.checked } : s
                )
              }
            />
            Enabled
          </label>
        </div>

        {bookUrl ? (
          <div className="flex flex-col gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Public book link
              </p>
              <Link
                href={bookPath!}
                className="truncate text-sm font-medium text-sky-700 hover:underline"
                target="_blank"
              >
                {bookUrl}
              </Link>
            </div>
            <button
              type="button"
              onClick={() => void copyLink()}
              className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        ) : (
          <p className="text-xs text-amber-700">
            Set a coach slug in funnel settings to get a public book URL.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Meeting title</span>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={settings.title}
              onChange={(e) =>
                setSettings((s) => (s ? { ...s, title: e.target.value } : s))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Your timezone</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={settings.timezone}
              onChange={(e) =>
                setSettings((s) =>
                  s ? { ...s, timezone: e.target.value } : s
                )
              }
            >
              {ACCOUNT_SETTING_TIMEZONES.map((z) => (
                <option key={z} value={z}>
                  {accountTimezoneOptionLabel(z)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Duration (minutes)</span>
            <input
              type="number"
              min={5}
              max={180}
              step={5}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={settings.meeting_duration_minutes}
              onChange={(e) =>
                setSettings((s) =>
                  s
                    ? {
                        ...s,
                        meeting_duration_minutes: Number(e.target.value) || 15,
                      }
                    : s
                )
              }
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Min notice (hours)</span>
            <input
              type="number"
              min={0}
              max={168}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={settings.min_notice_hours}
              onChange={(e) =>
                setSettings((s) =>
                  s
                    ? {
                        ...s,
                        min_notice_hours: Number(e.target.value) || 0,
                      }
                    : s
                )
              }
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Buffer (minutes)</span>
            <input
              type="number"
              min={0}
              max={120}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={settings.buffer_minutes}
              onChange={(e) =>
                setSettings((s) =>
                  s
                    ? { ...s, buffer_minutes: Number(e.target.value) || 0 }
                    : s
                )
              }
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Window (days)</span>
            <input
              type="number"
              min={1}
              max={90}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={settings.booking_window_days}
              onChange={(e) =>
                setSettings((s) =>
                  s
                    ? {
                        ...s,
                        booking_window_days: Number(e.target.value) || 14,
                      }
                    : s
                )
              }
            />
          </label>
        </div>

        <div>
          <p className="text-sm font-medium text-slate-700">Weekly hours</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Times are in your timezone ({settings.timezone}).
          </p>
          <ul className="mt-3 space-y-2">
            {WEEKDAYS.map((day) => {
              const rule = rules.find((r) => r.weekday === day.value);
              return (
                <li
                  key={day.value}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-100 px-3 py-2"
                >
                  <label className="inline-flex w-14 items-center gap-2 text-sm font-medium text-slate-800">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                      checked={Boolean(rule)}
                      onChange={() => toggleWeekday(day.value)}
                    />
                    {day.label}
                  </label>
                  {rule ? (
                    <>
                      <input
                        type="time"
                        className="rounded border border-slate-200 px-2 py-1 text-sm"
                        value={timeInputValue(rule.start_time)}
                        onChange={(e) =>
                          updateRuleTime(day.value, "start_time", e.target.value)
                        }
                      />
                      <span className="text-xs text-slate-400">to</span>
                      <input
                        type="time"
                        className="rounded border border-slate-200 px-2 py-1 text-sm"
                        value={timeInputValue(rule.end_time)}
                        onChange={(e) =>
                          updateRuleTime(day.value, "end_time", e.target.value)
                        }
                      />
                    </>
                  ) : (
                    <span className="text-xs text-slate-400">Unavailable</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {saveOk ? (
          <p className="text-sm text-emerald-700">Booking settings saved.</p>
        ) : null}

        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save booking settings"}
        </button>
      </div>
    </section>
  );
}
