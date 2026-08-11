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
import { BookingDateTimePicker } from "@/components/booking/BookingDateTimePicker";
import "./native-booking.css";

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
  const [days, setDays] = useState<DaySlots[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
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
      setSelectedDate(nextDays[0]!.date);
    } else {
      setSelectedDate(null);
    }
  }, [meta?.is_enabled, slug, tz]);

  useEffect(() => {
    if (step === "book") void loadSlots();
  }, [step, loadSlots]);

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
        <div className="nb-embed">
          <header className="nb-embed__head">
            <h2 className="nb-embed__thanks">
              {firstName.trim() ? `Thanks ${firstName.trim()}` : "Thanks"}
            </h2>
            <p className="nb-embed__question">What time works best for you?</p>
          </header>
          <BookingDateTimePicker
            timezone={tz}
            meetingDurationMinutes={meta.meeting_duration_minutes}
            days={days}
            loading={slotsLoading}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            selectedSlot={selectedSlot}
            onSelectSlot={setSelectedSlot}
            nowLabel={nowLabel}
            timezoneShort={tzShort}
            timezoneControl={
              <span className="nb-tz">
                <button
                  type="button"
                  className="nb-tz__btn"
                  onClick={() => setTzOpen((o) => !o)}
                >
                  {accountTimezoneOptionLabel(tz)}
                  {nowLabel ? ` (${nowLabel})` : ""}
                  <span aria-hidden> ▾</span>
                </button>
                {tzOpen ? (
                  <div className="nb-tz__menu">
                    {ACCOUNT_SETTING_TIMEZONES.map((z) => (
                      <button
                        key={z}
                        type="button"
                        className={`nb-tz__option${z === tz ? " is-on" : ""}`}
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
              </span>
            }
          />

          {selectedSlot ? (
            <div className="nb-embed__confirm">
              {bookError ? <p className="nb-embed__error">{bookError}</p> : null}
              <button
                type="button"
                disabled={submitting}
                onClick={() => void confirmBooking()}
                className="nb-embed__book"
              >
                {submitting ? "Booking…" : "Confirm"}
              </button>
            </div>
          ) : null}
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
