"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  where_label: string;
  join_url: string | null;
};

export type NativeBookingContact = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
};

type Props = {
  slug: string;
  /** Calendar book slug, e.g. discovery */
  calendarSlug?: string;
  contact: NativeBookingContact;
  /** Compact layout inside Let’s Talk unlock panel. */
  embedded?: boolean;
  /** Confirm CTA label (default: Confirm). */
  confirmLabel?: string;
  /** Called after a successful booking. */
  onBooked?: () => void;
  /** When true, skip the full success panel and rely on the parent. */
  hideSuccessPanel?: boolean;
  /** Hide the “Thanks {name}” line above the question. */
  hideThanks?: boolean;
  /** Override the question under Thanks (default: What time works best for you?). */
  question?: string;
};

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

/**
 * Native day / time / confirmation UI (iClosed-style).
 * Contact details come from Let’s Talk form — no second form step.
 */
export function NativeBookingEmbed({
  slug,
  calendarSlug = "discovery",
  contact,
  embedded = false,
  confirmLabel = "Confirm",
  onBooked,
  hideSuccessPanel = false,
  hideThanks = false,
  question = "What time works best for you?",
}: Props) {
  const calPath = `${encodeURIComponent(slug)}/${encodeURIComponent(calendarSlug)}`;
  const [meta, setMeta] = useState<BookMeta | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [tz, setTz] = useState(() => defaultCommunityCalendarTimezone());
  const [days, setDays] = useState<DaySlots[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{
    starts_at: string;
    ends_at: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [tzOpen, setTzOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/public/book/${calPath}`);
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
  }, [calPath]);

  const loadSlots = useCallback(async () => {
    if (!meta?.is_enabled) {
      setDays([]);
      return;
    }
    setSlotsLoading(true);
    const res = await fetch(
      `/api/public/book/${calPath}/slots?tz=${encodeURIComponent(tz)}`
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
  }, [meta?.is_enabled, calPath, tz]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

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

  async function confirmBooking() {
    if (!selectedSlot || !meta) return;
    if (!contact.firstName.trim() || !contact.email.trim()) {
      setBookError("Name and email are required.");
      return;
    }
    setSubmitting(true);
    setBookError(null);
    const res = await fetch(`/api/public/book/${calPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        starts_at: selectedSlot.starts_at,
        first_name: contact.firstName.trim(),
        last_name: contact.lastName.trim(),
        email: contact.email.trim(),
        phone: contact.phone?.trim() || undefined,
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
      location?: {
        label?: string;
        join_url?: string | null;
      };
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
      time_range: body.display?.time_range ?? body.display?.time ?? "",
      timezone: body.display?.timezone ?? tz,
      title: body.title ?? meta.title,
      coach_name: body.coach_name ?? meta.display_name,
      guest_email: body.guest_email ?? contact.email.trim(),
      starts_at: body.starts_at ?? selectedSlot.starts_at,
      ends_at: body.ends_at ?? selectedSlot.ends_at,
      where_label: body.location?.label ?? "Details by email",
      join_url: body.location?.join_url ?? null,
    });
    onBooked?.();
  }

  if (metaError) {
    return <p className="p-6 text-sm text-rose-600">{metaError}</p>;
  }

  if (!meta) {
    return <p className="p-6 text-sm text-slate-600">Loading calendar…</p>;
  }

  if (!meta.is_enabled) {
    return (
      <p className="p-6 text-sm text-slate-600">
        Online booking is not enabled yet for this coach.
      </p>
    );
  }

  if (success) {
    if (hideSuccessPanel) {
      return (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-center text-sm text-emerald-900">
          <p className="font-semibold">Orientation call booked</p>
          <p className="mt-1 text-emerald-800/90">
            {success.date} · {success.time_range}
          </p>
        </div>
      );
    }

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
      <div className="mx-auto w-full max-w-lg bg-white px-5 py-8 sm:px-8">
        <h2 className="text-center text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          Thank you! Your meeting is confirmed.
        </h2>

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
                {success.join_url ? (
                  <a
                    href={success.join_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-700 hover:underline"
                  >
                    {success.where_label}
                  </a>
                ) : (
                  success.where_label
                )}
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
    <div className={`nb-embed${embedded ? " nb-embed--embedded" : ""}`}>
      <header className="nb-embed__head">
        {hideThanks ? null : (
          <h2 className="nb-embed__thanks">
            {contact.firstName.trim()
              ? `Thanks ${contact.firstName.trim()}`
              : "Thanks"}
          </h2>
        )}
        <p className={hideThanks ? "nb-embed__thanks" : "nb-embed__question"}>
          {question}
        </p>
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
            {submitting ? "Booking…" : confirmLabel}
          </button>
        </div>
      ) : null}
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
      <rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M3 10h18M8 3v4M16 3v4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
