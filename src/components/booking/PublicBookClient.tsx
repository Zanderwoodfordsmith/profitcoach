"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ACCOUNT_SETTING_TIMEZONES,
  accountTimezoneOptionLabel,
} from "@/lib/accountProfileTimezones";
import { defaultCommunityCalendarTimezone } from "@/lib/communityCalendarTimezones";

type BookMeta = {
  slug: string;
  display_name: string;
  is_enabled: boolean;
  title: string;
  timezone: string;
  meeting_duration_minutes: number;
};

type DaySlots = {
  date: string;
  label: string;
  slots: { starts_at: string; ends_at: string; label: string }[];
};

type Props = {
  slug: string;
};

export function PublicBookClient({ slug }: Props) {
  const [meta, setMeta] = useState<BookMeta | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [tz, setTz] = useState(() => defaultCommunityCalendarTimezone());
  const [days, setDays] = useState<DaySlots[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{
    starts_at: string;
    label: string;
  } | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    date: string;
    time: string;
    timezone: string;
    title: string;
    coach_name: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/public/book/${encodeURIComponent(slug)}`);
      const body = (await res.json().catch(() => ({}))) as BookMeta & {
        error?: string;
      };
      if (cancelled) return;
      if (!res.ok) {
        setMetaError(body.error ?? "Coach not found.");
        return;
      }
      setMeta(body);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const loadSlots = useCallback(async () => {
    if (!meta?.is_enabled) {
      setDays([]);
      return;
    }
    setSlotsLoading(true);
    const res = await fetch(
      `/api/public/book/${encodeURIComponent(slug)}/slots?tz=${encodeURIComponent(tz)}`
    );
    const body = (await res.json().catch(() => ({}))) as {
      days?: DaySlots[];
      enabled?: boolean;
    };
    setSlotsLoading(false);
    setDays(body.days ?? []);
    setSelectedDate(null);
    setSelectedSlot(null);
  }, [meta?.is_enabled, slug, tz]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  const selectedDay = useMemo(
    () => days.find((d) => d.date === selectedDate) ?? null,
    [days, selectedDate]
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedSlot) return;
    setSubmitting(true);
    setFormError(null);
    const res = await fetch(`/api/public/book/${encodeURIComponent(slug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        starts_at: selectedSlot.starts_at,
        first_name: firstName,
        last_name: lastName,
        email,
        phone: phone || undefined,
        prospect_timezone: tz,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      display?: { date: string; time: string; timezone: string };
      title?: string;
      coach_name?: string;
    };
    setSubmitting(false);
    if (!res.ok) {
      setFormError(body.error ?? "Could not book.");
      void loadSlots();
      return;
    }
    setSuccess({
      date: body.display?.date ?? "",
      time: body.display?.time ?? selectedSlot.label,
      timezone: body.display?.timezone ?? tz,
      title: body.title ?? meta?.title ?? "Call",
      coach_name: body.coach_name ?? meta?.display_name ?? "",
    });
  }

  if (metaError) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-rose-600">{metaError}</p>
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-slate-600">Loading…</p>
      </div>
    );
  }

  if (!meta.is_enabled) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">{meta.display_name}</h1>
        <p className="mt-2 text-sm text-slate-600">
          Online booking is not enabled yet for this coach.
        </p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          You&apos;re booked
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          {success.title}
        </h1>
        <p className="mt-3 text-slate-700">
          {success.date}
          <br />
          <span className="text-lg font-medium">{success.time}</span>
          <span className="mt-1 block text-sm text-slate-500">
            {success.timezone}
          </span>
        </p>
        <p className="mt-4 text-sm text-slate-600">with {success.coach_name}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-100 px-6 py-5">
        <p className="text-sm text-slate-500">{meta.display_name}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          {meta.title}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {meta.meeting_duration_minutes} minutes · times shown in your timezone
        </p>
        <label className="mt-4 block max-w-xs text-sm">
          <span className="font-medium text-slate-700">Your timezone</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={tz}
            onChange={(e) => setTz(e.target.value)}
          >
            {!ACCOUNT_SETTING_TIMEZONES.includes(tz as (typeof ACCOUNT_SETTING_TIMEZONES)[number]) ? (
              <option value={tz}>{tz}</option>
            ) : null}
            {ACCOUNT_SETTING_TIMEZONES.map((z) => (
              <option key={z} value={z}>
                {accountTimezoneOptionLabel(z)}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="grid gap-0 md:grid-cols-2">
        <div className="border-b border-slate-100 p-5 md:border-b-0 md:border-r">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Choose a day
          </p>
          {slotsLoading ? (
            <p className="mt-4 text-sm text-slate-500">Loading times…</p>
          ) : days.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No open times in the next booking window.
            </p>
          ) : (
            <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {days.map((day) => (
                <li key={day.date}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDate(day.date);
                      setSelectedSlot(null);
                    }}
                    className={`w-full rounded-lg border px-2 py-2.5 text-center text-sm transition ${
                      selectedDate === day.date
                        ? "border-emerald-500 bg-emerald-50 font-semibold text-emerald-900"
                        : "border-slate-200 text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    {day.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Choose a time
          </p>
          {!selectedDay ? (
            <p className="mt-4 text-sm text-slate-500">Select a day first.</p>
          ) : (
            <ul className="mt-3 grid max-h-64 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
              {selectedDay.slots.map((slot) => (
                <li key={slot.starts_at}>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedSlot({
                        starts_at: slot.starts_at,
                        label: slot.label,
                      })
                    }
                    className={`w-full rounded-lg border px-2 py-2 text-sm ${
                      selectedSlot?.starts_at === slot.starts_at
                        ? "border-emerald-500 bg-emerald-50 font-semibold text-emerald-900"
                        : "border-slate-200 text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    {slot.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {selectedSlot ? (
        <form
          onSubmit={(e) => void onSubmit(e)}
          className="space-y-3 border-t border-slate-100 px-6 py-5"
        >
          <p className="text-sm text-slate-700">
            Selected:{" "}
            <span className="font-semibold">
              {selectedDay?.label} · {selectedSlot.label}
            </span>
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              required
              placeholder="First name"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
            />
            <input
              required
              placeholder="Last name"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
            />
          </div>
          <input
            required
            type="email"
            placeholder="Email"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <input
            type="tel"
            placeholder="Phone (optional)"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
          />
          {formError ? (
            <p className="text-sm text-rose-600">{formError}</p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {submitting ? "Booking…" : "Confirm booking"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
