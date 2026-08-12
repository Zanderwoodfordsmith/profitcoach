"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Copy, Link2 } from "lucide-react";
import {
  ACCOUNT_SETTING_TIMEZONES,
  accountTimezoneOptionLabel,
} from "@/lib/accountProfileTimezones";
import type { AvailabilityRuleRow } from "@/lib/booking/computeBookingSlots";
import type { CoachCalendarRow } from "@/lib/booking/coachCalendars";
import { DEFAULT_WEEKDAY_AVAILABILITY } from "@/lib/booking/computeBookingSlots";
import { supabaseClient } from "@/lib/supabaseClient";

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
] as const;

type Props = {
  appOrigin: string;
  callsBasePath: "/coach/calls" | "/admin/calls";
};

export function CallsCalendarSettings({
  appOrigin,
  callsBasePath: _callsBasePath,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [timezone, setTimezone] = useState("Europe/London");
  const [rules, setRules] = useState<AvailabilityRuleRow[]>([]);
  const [calendars, setCalendars] = useState<CoachCalendarRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

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
    const res = await fetch("/api/coach/calendars", { headers });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      slug?: string;
      timezone?: string;
      rules?: AvailabilityRuleRow[];
      calendars?: CoachCalendarRow[];
    };
    if (!res.ok) {
      setError(body.error ?? "Could not load calendars.");
      setLoading(false);
      return;
    }
    setSlug(body.slug ?? null);
    setTimezone(body.timezone ?? "Europe/London");
    setRules(
      body.rules && body.rules.length > 0
        ? body.rules
        : DEFAULT_WEEKDAY_AVAILABILITY.map((r) => ({ ...r }))
    );
    setCalendars(body.calendars ?? []);
    setLoading(false);
  }, [authHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveShared() {
    setSaving(true);
    setError(null);
    const headers = await authHeaders();
    if (!headers) {
      setSaving(false);
      setError("Not signed in.");
      return;
    }
    const res = await fetch("/api/coach/calendars", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ timezone, rules }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Save failed.");
      return;
    }
    void load();
  }

  async function patchCalendar(id: string, patch: Partial<CoachCalendarRow>) {
    setSaving(true);
    setError(null);
    const headers = await authHeaders();
    if (!headers) {
      setSaving(false);
      setError("Not signed in.");
      return;
    }
    const res = await fetch(`/api/coach/calendars/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(patch),
    });
    setSaving(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Could not update calendar.");
      return;
    }
    const body = (await res.json()) as { calendar?: CoachCalendarRow };
    if (body.calendar) {
      setCalendars((prev) =>
        prev.map((c) => (c.id === id ? body.calendar! : c))
      );
    } else {
      void load();
    }
  }

  function bookUrl(calendarSlug: string) {
    if (!slug) return null;
    const path =
      slug === "zander" && calendarSlug === "discovery"
        ? "/zander"
        : `/book/${encodeURIComponent(slug)}/${encodeURIComponent(calendarSlug)}`;
    return `${appOrigin.replace(/\/$/, "")}${path}`;
  }

  async function copyLink(calendarSlug: string) {
    const url = bookUrl(calendarSlug);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(calendarSlug);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      /* ignore */
    }
  }

  function toggleWeekday(weekday: number) {
    setRules((prev) => {
      const has = prev.some((r) => r.weekday === weekday);
      if (has) return prev.filter((r) => r.weekday !== weekday);
      return [
        ...prev,
        { weekday, start_time: "09:00", end_time: "17:00" },
      ].sort((a, b) => a.weekday - b.weekday);
    });
  }

  const editing = calendars.find((c) => c.id === editingId) ?? null;
  const activeDays = rules.length;

  if (loading) {
    return <p className="text-sm text-slate-600">Loading calendars…</p>;
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] lg:items-start">
        <section className="min-w-0 space-y-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              Booking calendars
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Edit each calendar’s length, buffers, and public book link.
            </p>
          </div>

          <ul className="space-y-2">
            {calendars.map((cal) => {
              const open = editingId === cal.id;
              return (
                <li key={cal.id}>
                  <div
                    className={`overflow-hidden rounded-xl border bg-white transition-colors ${
                      open
                        ? "border-sky-300 ring-1 ring-sky-200"
                        : "border-slate-200/80"
                    }`}
                  >
                    <div className="flex w-full items-center gap-3 px-4 py-3.5">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        onClick={() =>
                          setEditingId((id) => (id === cal.id ? null : cal.id))
                        }
                      >
                        {open ? (
                          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {cal.name}
                            </p>
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                cal.is_enabled
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {cal.is_enabled ? "Active" : "Off"}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {cal.meeting_duration_minutes} min
                            {cal.is_public && cal.is_enabled
                              ? " · Public link"
                              : " · Private"}
                          </p>
                        </div>
                      </button>
                      {cal.is_public && cal.is_enabled ? (
                        <button
                          type="button"
                          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-sky-700 hover:bg-sky-50"
                          onClick={() => void copyLink(cal.slug)}
                        >
                          {copied === cal.slug ? (
                            "Copied"
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" aria-hidden />
                              Link
                            </>
                          )}
                        </button>
                      ) : (
                        <Link2
                          className="h-4 w-4 shrink-0 text-slate-300"
                          aria-hidden
                        />
                      )}
                    </div>

                    {open && editing && editing.id === cal.id ? (
                      <div className="space-y-4 border-t border-slate-100 px-4 py-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block text-sm sm:col-span-2">
                            <span className="font-medium text-slate-700">
                              Name
                            </span>
                            <input
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                              value={editing.name}
                              onChange={(e) =>
                                setCalendars((prev) =>
                                  prev.map((c) =>
                                    c.id === editing.id
                                      ? { ...c, name: e.target.value }
                                      : c
                                  )
                                )
                              }
                            />
                          </label>
                          <label className="block text-sm">
                            <span className="font-medium text-slate-700">
                              Duration (min)
                            </span>
                            <input
                              type="number"
                              min={5}
                              max={180}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                              value={editing.meeting_duration_minutes}
                              onChange={(e) =>
                                setCalendars((prev) =>
                                  prev.map((c) =>
                                    c.id === editing.id
                                      ? {
                                          ...c,
                                          meeting_duration_minutes:
                                            Number(e.target.value) || 15,
                                        }
                                      : c
                                  )
                                )
                              }
                            />
                          </label>
                          <label className="block text-sm">
                            <span className="font-medium text-slate-700">
                              Buffer (min)
                            </span>
                            <input
                              type="number"
                              min={0}
                              max={120}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                              value={editing.buffer_minutes}
                              onChange={(e) =>
                                setCalendars((prev) =>
                                  prev.map((c) =>
                                    c.id === editing.id
                                      ? {
                                          ...c,
                                          buffer_minutes:
                                            Number(e.target.value) || 0,
                                        }
                                      : c
                                  )
                                )
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
                              value={editing.min_notice_hours}
                              onChange={(e) =>
                                setCalendars((prev) =>
                                  prev.map((c) =>
                                    c.id === editing.id
                                      ? {
                                          ...c,
                                          min_notice_hours:
                                            Number(e.target.value) || 0,
                                        }
                                      : c
                                  )
                                )
                              }
                            />
                          </label>
                          <label className="block text-sm">
                            <span className="font-medium text-slate-700">
                              Open days (rolling)
                            </span>
                            <input
                              type="number"
                              min={1}
                              max={90}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                              value={editing.booking_window_days}
                              onChange={(e) =>
                                setCalendars((prev) =>
                                  prev.map((c) =>
                                    c.id === editing.id
                                      ? {
                                          ...c,
                                          booking_window_days:
                                            Number(e.target.value) || 14,
                                        }
                                      : c
                                  )
                                )
                              }
                            />
                          </label>
                          <label className="inline-flex items-center gap-2 text-sm sm:col-span-2">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300 text-sky-600"
                              checked={editing.is_enabled}
                              onChange={(e) =>
                                setCalendars((prev) =>
                                  prev.map((c) =>
                                    c.id === editing.id
                                      ? {
                                          ...c,
                                          is_enabled: e.target.checked,
                                          is_public: e.target.checked
                                            ? c.is_public
                                            : false,
                                        }
                                      : c
                                  )
                                )
                              }
                            />
                            Enabled
                          </label>
                          <label className="inline-flex items-center gap-2 text-sm sm:col-span-2">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300 text-sky-600"
                              checked={editing.is_public}
                              disabled={!editing.is_enabled}
                              onChange={(e) =>
                                setCalendars((prev) =>
                                  prev.map((c) =>
                                    c.id === editing.id
                                      ? { ...c, is_public: e.target.checked }
                                      : c
                                  )
                                )
                              }
                            />
                            Public book link
                          </label>
                          <fieldset className="sm:col-span-2">
                            <legend className="text-sm font-medium text-slate-700">
                              How the call happens
                            </legend>
                            <div className="mt-2 flex flex-wrap gap-3">
                              {(
                                [
                                  ["google_meet", "Google Meet"],
                                  ["phone", "Phone"],
                                  ["custom", "Custom"],
                                ] as const
                              ).map(([value, label]) => (
                                <label
                                  key={value}
                                  className="inline-flex items-center gap-2 text-sm"
                                >
                                  <input
                                    type="radio"
                                    name={`loc-${editing.id}`}
                                    checked={editing.location_mode === value}
                                    onChange={() =>
                                      setCalendars((prev) =>
                                        prev.map((c) =>
                                          c.id === editing.id
                                            ? { ...c, location_mode: value }
                                            : c
                                        )
                                      )
                                    }
                                  />
                                  {label}
                                </label>
                              ))}
                            </div>
                            {editing.location_mode === "phone" ? (
                              <input
                                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                placeholder="Phone number"
                                value={editing.location_phone ?? ""}
                                onChange={(e) =>
                                  setCalendars((prev) =>
                                    prev.map((c) =>
                                      c.id === editing.id
                                        ? {
                                            ...c,
                                            location_phone: e.target.value,
                                          }
                                        : c
                                    )
                                  )
                                }
                              />
                            ) : null}
                            {editing.location_mode === "custom" ? (
                              <input
                                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                placeholder="Custom link or note"
                                value={editing.location_custom ?? ""}
                                onChange={(e) =>
                                  setCalendars((prev) =>
                                    prev.map((c) =>
                                      c.id === editing.id
                                        ? {
                                            ...c,
                                            location_custom: e.target.value,
                                          }
                                        : c
                                    )
                                  )
                                }
                              />
                            ) : null}
                          </fieldset>
                        </div>
                        <button
                          type="button"
                          disabled={saving}
                          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
                          onClick={() =>
                            void patchCalendar(editing.id, {
                              name: editing.name,
                              meeting_duration_minutes:
                                editing.meeting_duration_minutes,
                              min_notice_hours: editing.min_notice_hours,
                              buffer_minutes: editing.buffer_minutes,
                              booking_window_days: editing.booking_window_days,
                              is_enabled: editing.is_enabled,
                              is_public: editing.is_public,
                              location_mode: editing.location_mode,
                              location_phone: editing.location_phone,
                              location_custom: editing.location_custom,
                            })
                          }
                        >
                          {saving ? "Saving…" : "Save calendar"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="rounded-xl border border-slate-200/80 bg-white p-4 lg:sticky lg:top-20">
          <h3 className="text-sm font-semibold text-slate-900">
            Weekly hours
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Shared across all calendars · {activeDays} day
            {activeDays === 1 ? "" : "s"} open
          </p>

          <label className="mt-4 block text-sm">
            <span className="font-medium text-slate-700">Timezone</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              {ACCOUNT_SETTING_TIMEZONES.map((z) => (
                <option key={z} value={z}>
                  {accountTimezoneOptionLabel(z)}
                </option>
              ))}
            </select>
          </label>

          <ul className="mt-3 space-y-1.5">
            {WEEKDAYS.map((day) => {
              const rule = rules.find((r) => r.weekday === day.value);
              return (
                <li
                  key={day.value}
                  className="flex flex-wrap items-center gap-2 rounded-lg px-1 py-1"
                >
                  <label className="inline-flex w-10 items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600"
                      checked={Boolean(rule)}
                      onChange={() => toggleWeekday(day.value)}
                    />
                    {day.label}
                  </label>
                  {rule ? (
                    <div className="flex min-w-0 flex-1 items-center gap-1">
                      <input
                        type="time"
                        className="w-full min-w-0 rounded border border-slate-200 px-1.5 py-1 text-xs"
                        value={rule.start_time.slice(0, 5)}
                        onChange={(e) =>
                          setRules((prev) =>
                            prev.map((r) =>
                              r.weekday === day.value
                                ? { ...r, start_time: e.target.value }
                                : r
                            )
                          )
                        }
                      />
                      <span className="text-[10px] text-slate-400">–</span>
                      <input
                        type="time"
                        className="w-full min-w-0 rounded border border-slate-200 px-1.5 py-1 text-xs"
                        value={rule.end_time.slice(0, 5)}
                        onChange={(e) =>
                          setRules((prev) =>
                            prev.map((r) =>
                              r.weekday === day.value
                                ? { ...r, end_time: e.target.value }
                                : r
                            )
                          )
                        }
                      />
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400">Off</span>
                  )}
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            disabled={saving}
            onClick={() => void saveShared()}
            className="mt-4 w-full rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save hours"}
          </button>
        </aside>
      </div>
    </div>
  );
}
