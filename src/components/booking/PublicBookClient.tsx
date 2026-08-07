"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ACCOUNT_SETTING_TIMEZONES,
  accountTimezoneOptionLabel,
} from "@/lib/accountProfileTimezones";
import {
  defaultCommunityCalendarTimezone,
  formatCommunityTimezoneShort,
} from "@/lib/communityCalendarTimezones";
import { formatInTimeZone } from "@/lib/booking/bookingTime";

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

type SuccessState = {
  date: string;
  time: string;
  time_range: string;
  timezone: string;
  title: string;
  coach_name: string;
  guest_email: string;
  starts_at: string;
  ends_at: string;
};

type Props = {
  slug: string;
};

type Step = "form" | "book";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function monthMatrix(year: number, monthIndex0: number): (number | null)[][] {
  const first = new Date(Date.UTC(year, monthIndex0, 1));
  const startPad = first.getUTCDay(); // Sun=0
  const daysInMonth = new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

function ymdFromParts(year: number, monthIndex0: number, day: number): string {
  return `${year}-${pad2(monthIndex0 + 1)}-${pad2(day)}`;
}

function formatSlotLabel(iso: string, tz: string, hour12: boolean): string {
  return formatInTimeZone(new Date(iso), tz, {
    hour: "numeric",
    minute: "2-digit",
    hour12,
  });
}

function buildGoogleCalendarUrl(input: {
  title: string;
  startsAt: string;
  endsAt: string;
  details?: string;
}): string {
  const fmt = (iso: string) =>
    new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    dates: `${fmt(input.startsAt)}/${fmt(input.endsAt)}`,
    details: input.details ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function buildOutlookCalendarUrl(input: {
  title: string;
  startsAt: string;
  endsAt: string;
  details?: string;
}): string {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: input.title,
    startdt: input.startsAt,
    enddt: input.endsAt,
    body: input.details ?? "",
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

function downloadIcs(input: {
  title: string;
  startsAt: string;
  endsAt: string;
  description?: string;
}): void {
  const stamp = (iso: string) =>
    new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Profit Coach//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${stamp(input.startsAt)}-${Math.random().toString(36).slice(2)}@theprofitcoach.com`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(input.startsAt)}`,
    `DTEND:${stamp(input.endsAt)}`,
    `SUMMARY:${input.title.replace(/\n/g, " ")}`,
    `DESCRIPTION:${(input.description ?? "").replace(/\n/g, "\\n")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "booking.ics";
  a.click();
  URL.revokeObjectURL(url);
}

export function PublicBookClient({ slug }: Props) {
  const [meta, setMeta] = useState<BookMeta | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("form");
  const [tz, setTz] = useState(() => defaultCommunityCalendarTimezone());
  const [hour12, setHour12] = useState(true);
  const [days, setDays] = useState<DaySlots[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{
    starts_at: string;
    ends_at: string;
  } | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [tzOpen, setTzOpen] = useState(false);

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
    };
    setSlotsLoading(false);
    const nextDays = body.days ?? [];
    setDays(nextDays);
    setSelectedSlot(null);
    if (nextDays.length > 0) {
      const first = nextDays[0]!;
      setSelectedDate(first.date);
      const [y, m] = first.date.split("-").map(Number);
      setViewYear(y);
      setViewMonth(m - 1);
    } else {
      setSelectedDate(null);
    }
  }, [meta?.is_enabled, slug, tz]);

  useEffect(() => {
    if (step === "book") void loadSlots();
  }, [step, loadSlots]);

  const availableSet = useMemo(
    () => new Set(days.map((d) => d.date)),
    [days]
  );

  const selectedDay = useMemo(
    () => days.find((d) => d.date === selectedDate) ?? null,
    [days, selectedDate]
  );

  const nowLabel = useMemo(() => {
    try {
      return formatInTimeZone(new Date(), tz, {
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }, [tz]);

  const tzShort = formatCommunityTimezoneShort(tz);

  function onContinueForm(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setFormError("Enter your first and last name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFormError("Enter a valid email address.");
      return;
    }
    setStep("book");
  }

  async function confirmBooking() {
    if (!selectedSlot || !meta) return;
    setSubmitting(true);
    setBookError(null);
    const res = await fetch(`/api/public/book/${encodeURIComponent(slug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        starts_at: selectedSlot.starts_at,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        prospect_timezone: tz,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      starts_at?: string;
      ends_at?: string;
      display?: {
        date: string;
        time: string;
        time_range?: string;
        timezone: string;
      };
      title?: string;
      coach_name?: string;
      guest_email?: string;
    };
    setSubmitting(false);
    if (!res.ok) {
      setBookError(body.error ?? "Could not book.");
      void loadSlots();
      return;
    }
    setSuccess({
      date: body.display?.date ?? "",
      time: body.display?.time ?? "",
      time_range:
        body.display?.time_range ??
        body.display?.time ??
        "",
      timezone: body.display?.timezone ?? tz,
      title: body.title ?? meta.title,
      coach_name: body.coach_name ?? meta.display_name,
      guest_email: body.guest_email ?? email.trim(),
      starts_at: body.starts_at ?? selectedSlot.starts_at,
      ends_at: body.ends_at ?? selectedSlot.ends_at,
    });
  }

  if (metaError) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-rose-600">{metaError}</p>
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-slate-600">Loading…</p>
      </div>
    );
  }

  if (!meta.is_enabled) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">{meta.display_name}</h1>
        <p className="mt-2 text-sm text-slate-600">
          Online booking is not enabled yet for this coach.
        </p>
      </div>
    );
  }

  if (success) {
    const googleUrl = buildGoogleCalendarUrl({
      title: success.title,
      startsAt: success.starts_at,
      endsAt: success.ends_at,
      details: `With ${success.coach_name}`,
    });
    const outlookUrl = buildOutlookCalendarUrl({
      title: success.title,
      startsAt: success.starts_at,
      endsAt: success.ends_at,
      details: `With ${success.coach_name}`,
    });
    const tzLabel =
      accountTimezoneOptionLabel(success.timezone).split(" ").slice(1).join(" ") ||
      success.timezone;

    return (
      <div className="mx-auto w-full max-w-lg rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8">
        <h1 className="text-center text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          Thank you! Your meeting is confirmed.
        </h1>

        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-900">
          Booking confirmed for <strong>{success.guest_email}</strong>. Keep this
          page or add it to your calendar below.
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 px-4 py-4">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <p className="text-sm text-slate-500">Your meeting is scheduled with:</p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                {success.coach_name}
              </p>
            </div>
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-semibold text-white"
              aria-hidden
            >
              {success.coach_name
                .split(/\s+/)
                .map((p) => p[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            <div className="flex items-start justify-between gap-4 py-3.5">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <ClockIcon />
                Time
              </div>
              <div className="text-right text-sm font-medium text-slate-900">
                <div>{success.date}</div>
                <div className="mt-0.5 text-slate-600">
                  {success.time_range} ({tzLabel || success.timezone})
                </div>
              </div>
            </div>
            <div className="flex items-start justify-between gap-4 py-3.5">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <PinIcon />
                Where
              </div>
              <div className="text-right text-sm font-medium text-slate-900">
                Details by email
              </div>
            </div>
            <div className="flex items-start justify-between gap-4 py-3.5">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <PersonIcon />
                Guest
              </div>
              <div className="text-right text-sm font-medium text-slate-900">
                {success.guest_email}
              </div>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-sm font-medium text-slate-700">
          Add to calendar
        </p>
        <div className="mt-3 flex items-center justify-center gap-3">
          <a
            href={googleUrl}
            target="_blank"
            rel="noreferrer"
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
            title="Google Calendar"
            aria-label="Add to Google Calendar"
          >
            G
          </a>
          <a
            href={outlookUrl}
            target="_blank"
            rel="noreferrer"
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-bold text-[#0f6cbd] shadow-sm hover:bg-slate-50"
            title="Outlook"
            aria-label="Add to Outlook"
          >
            O
          </a>
          <button
            type="button"
            onClick={() =>
              downloadIcs({
                title: success.title,
                startsAt: success.starts_at,
                endsAt: success.ends_at,
                description: `With ${success.coach_name}`,
              })
            }
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
            title="Download .ics"
            aria-label="Download calendar file"
          >
            <CalDownloadIcon />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-center gap-6 border-b border-slate-100 px-4 py-3 text-sm">
        <button
          type="button"
          onClick={() => setStep("form")}
          className={`inline-flex items-center gap-2 ${
            step === "form" ? "font-semibold text-slate-900" : "text-slate-400"
          }`}
        >
          <span
            className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
              step === "book"
                ? "bg-emerald-500 text-white"
                : step === "form"
                  ? "bg-sky-600 text-white"
                  : "bg-slate-200 text-slate-500"
            }`}
          >
            {step === "book" ? "✓" : "1"}
          </span>
          Fill out the form
        </button>
        <span
          className={`inline-flex items-center gap-2 ${
            step === "book" ? "font-semibold text-slate-900" : "text-slate-400"
          }`}
        >
          <span
            className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
              step === "book" ? "bg-sky-600 text-white" : "bg-slate-200 text-slate-500"
            }`}
          >
            2
          </span>
          Book your event
        </span>
      </div>

      {step === "form" ? (
        <form
          onSubmit={onContinueForm}
          className="mx-auto max-w-md space-y-4 px-6 py-8"
        >
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {meta.title}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              with {meta.display_name} · {meta.meeting_duration_minutes} minutes
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              required
              placeholder="First name"
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-500"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
            />
            <input
              required
              placeholder="Last name"
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-500"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
            />
          </div>
          <input
            required
            type="email"
            placeholder="Email"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <input
            type="tel"
            placeholder="Phone (optional)"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-500"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
          />
          {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
          <button
            type="submit"
            className="w-full rounded-xl bg-sky-600 py-3 text-sm font-semibold text-white hover:bg-sky-700"
          >
            Continue
          </button>
        </form>
      ) : (
        <div className="grid md:grid-cols-[minmax(200px,0.9fr)_minmax(240px,1.1fr)_minmax(180px,0.85fr)]">
          {/* Left: event meta */}
          <div className="border-b border-slate-100 p-6 md:border-b-0 md:border-r">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {meta.title}
            </h1>
            <ul className="mt-5 space-y-3 text-sm text-slate-600">
              <li className="flex items-center gap-2.5">
                <VideoIcon />
                Video call
              </li>
              <li className="flex items-center gap-2.5">
                <ClockIcon />
                {meta.meeting_duration_minutes} minutes
              </li>
              <li className="relative">
                <button
                  type="button"
                  onClick={() => setTzOpen((o) => !o)}
                  className="flex w-full items-start gap-2.5 rounded-lg text-left hover:bg-slate-50"
                >
                  <GlobeIcon />
                  <span>
                    <span className="block font-medium text-slate-800">
                      {accountTimezoneOptionLabel(tz)}
                    </span>
                    <span className="text-xs text-slate-500">
                      {tzShort}
                      {nowLabel ? ` (${nowLabel})` : ""}
                    </span>
                  </span>
                </button>
                {tzOpen ? (
                  <div className="absolute left-0 right-0 z-20 mt-2 max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                    {ACCOUNT_SETTING_TIMEZONES.map((z) => (
                      <button
                        key={z}
                        type="button"
                        className={`block w-full rounded-lg px-3 py-2 text-left text-xs ${
                          z === tz
                            ? "bg-sky-50 font-semibold text-sky-900"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                        onClick={() => {
                          setTz(z);
                          setTzOpen(false);
                        }}
                      >
                        {accountTimezoneOptionLabel(z)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </li>
            </ul>
            <p className="mt-6 text-xs text-slate-400">
              Booking as {firstName} {lastName}
            </p>
          </div>

          {/* Middle: month calendar */}
          <div className="border-b border-slate-100 p-6 md:border-b-0 md:border-r">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                {new Date(Date.UTC(viewYear, viewMonth, 1)).toLocaleString(
                  "en-GB",
                  { month: "long", year: "numeric", timeZone: "UTC" }
                )}
              </h2>
              <div className="flex gap-1">
                <button
                  type="button"
                  aria-label="Previous month"
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                  onClick={() => {
                    const d = new Date(Date.UTC(viewYear, viewMonth - 1, 1));
                    setViewYear(d.getUTCFullYear());
                    setViewMonth(d.getUTCMonth());
                  }}
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Next month"
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                  onClick={() => {
                    const d = new Date(Date.UTC(viewYear, viewMonth + 1, 1));
                    setViewYear(d.getUTCFullYear());
                    setViewMonth(d.getUTCMonth());
                  }}
                >
                  ›
                </button>
              </div>
            </div>

            {slotsLoading ? (
              <p className="mt-8 text-sm text-slate-500">Loading availability…</p>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-slate-400">
                  {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
                    <div key={d}>{d}</div>
                  ))}
                </div>
                <div className="mt-1 grid grid-cols-7 gap-1">
                  {monthMatrix(viewYear, viewMonth).flatMap((row, ri) =>
                    row.map((day, ci) => {
                      if (day == null) {
                        return <div key={`${ri}-${ci}`} className="aspect-square" />;
                      }
                      const ymd = ymdFromParts(viewYear, viewMonth, day);
                      const available = availableSet.has(ymd);
                      const selected = selectedDate === ymd;
                      return (
                        <button
                          key={ymd}
                          type="button"
                          disabled={!available}
                          onClick={() => {
                            setSelectedDate(ymd);
                            setSelectedSlot(null);
                          }}
                          className={`relative flex aspect-square items-center justify-center rounded-full text-sm transition ${
                            selected
                              ? "bg-sky-700 font-semibold text-white"
                              : available
                                ? "bg-sky-100 font-medium text-sky-900 hover:bg-sky-200"
                                : "text-slate-300"
                          }`}
                        >
                          {day}
                          {selected ? (
                            <span className="absolute bottom-1 h-1 w-1 rounded-full bg-white" />
                          ) : null}
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>

          {/* Right: times */}
          <div className="flex max-h-[420px] flex-col p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900">
                {selectedDay
                  ? selectedDay.label
                  : selectedDate
                    ? selectedDate
                    : "Pick a day"}
              </h2>
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  className={`rounded-md px-2 py-1 ${
                    hour12 ? "bg-sky-600 text-white" : "text-slate-500"
                  }`}
                  onClick={() => setHour12(true)}
                >
                  12h
                </button>
                <button
                  type="button"
                  className={`rounded-md px-2 py-1 ${
                    !hour12 ? "bg-sky-600 text-white" : "text-slate-500"
                  }`}
                  onClick={() => setHour12(false)}
                >
                  24h
                </button>
              </div>
            </div>

            <div className="mt-4 flex-1 space-y-2 overflow-y-auto pr-1">
              {!selectedDay ? (
                <p className="text-sm text-slate-500">Select an available day.</p>
              ) : selectedDay.slots.length === 0 ? (
                <p className="text-sm text-slate-500">No times this day.</p>
              ) : (
                selectedDay.slots.map((slot) => {
                  const active = selectedSlot?.starts_at === slot.starts_at;
                  return (
                    <button
                      key={slot.starts_at}
                      type="button"
                      onClick={() =>
                        setSelectedSlot({
                          starts_at: slot.starts_at,
                          ends_at: slot.ends_at,
                        })
                      }
                      className={`w-full rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                        active
                          ? "border-sky-600 bg-sky-50 text-sky-900"
                          : "border-slate-200 text-slate-800 hover:border-slate-300"
                      }`}
                    >
                      {formatSlotLabel(slot.starts_at, tz, hour12)}
                    </button>
                  );
                })
              )}
            </div>

            {selectedSlot ? (
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                {bookError ? (
                  <p className="text-sm text-rose-600">{bookError}</p>
                ) : null}
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void confirmBooking()}
                  className="w-full rounded-xl bg-sky-600 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
                >
                  {submitting ? "Booking…" : "Confirm"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 7v5.2l3.2 1.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="mt-0.5 shrink-0">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M3 12h18M12 3c2.5 2.8 3.8 5.8 3.8 9s-1.3 6.2-3.8 9c-2.5-2.8-3.8-5.8-3.8-9s1.3-6.2 3.8-9Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="6" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15 10.5 21 7v10l-6-3.5V10.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="11" r="2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5 19c1.5-3 4-4.5 7-4.5S17.5 16 19 19"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CalDownloadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
