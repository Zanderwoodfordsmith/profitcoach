"use client";

import { Calendar, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDaysYmd,
  formatInTimeZone,
  utcToZonedParts,
  ymdInTimeZone,
  zonedLocalToUtc,
} from "@/lib/booking/bookingTime";
import { formatCommunityTimezoneShort } from "@/lib/communityCalendarTimezones";
import {
  SUPPORT_CALL_HOSTS,
  supportCallHostDisplayName,
  type SupportCallHostSlug,
} from "@/lib/support/supportCallHosts";
import { supabaseClient } from "@/lib/supabaseClient";

type SlotDay = {
  date: string;
  label: string;
  slots: { starts_at: string; ends_at: string; label: string }[];
};

const DURATION_PRESETS = [20, 30, 45, 60];
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

type Props = {
  ticketId: string;
  defaultHost: SupportCallHostSlug;
  guestLabel: string;
  guestEmail: string | null;
  onOpenSettings: () => void;
  onBooked: () => void;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function monthMatrix(year: number, monthIndex0: number): (number | null)[][] {
  const first = new Date(Date.UTC(year, monthIndex0, 1));
  const startPad = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1 + delta, 1));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}`;
}

function monthTitle(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function SupportTicketBookCall({
  ticketId,
  defaultHost,
  guestLabel,
  guestEmail,
  onOpenSettings,
  onBooked,
}: Props) {
  const [host, setHost] = useState<SupportCallHostSlug>(defaultHost);
  const [duration, setDuration] = useState(20);
  const durationTouched = useRef(false);
  const [timezone, setTimezone] = useState("Europe/London");
  const [days, setDays] = useState<SlotDay[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState<string | null>(null);
  const [timeValue, setTimeValue] = useState("");
  const [slotStartsAt, setSlotStartsAt] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<{
    when: string;
    email: string;
  } | null>(null);

  useEffect(() => {
    durationTouched.current = false;
    setTimeValue("");
    setSlotStartsAt(null);
    setConfirming(false);
    setBooked(null);
    setOpen(false);
    setError(null);
  }, [ticketId]);

  useEffect(() => {
    setTimeValue("");
    setSlotStartsAt(null);
    setConfirming(false);
    setError(null);
  }, [host]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      setSlotsLoading(true);
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token || cancelled) {
        if (!cancelled) setSlotsLoading(false);
        return;
      }
      const res = await fetch(
        `/api/admin/support/hosts/${encodeURIComponent(host)}/slots?duration=${duration}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      ).catch(() => null);
      if (!res || cancelled) {
        if (!cancelled) setSlotsLoading(false);
        return;
      }
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        timezone?: string;
        default_duration_minutes?: number;
        days?: SlotDay[];
      };
      if (!res.ok) {
        if (!cancelled) {
          const tz = "Europe/London";
          setError(body.error ?? "Could not load times.");
          setDays([]);
          setSelectedDate((current) => current ?? ymdInTimeZone(new Date(), tz));
          setViewMonth(
            (current) => current ?? ymdInTimeZone(new Date(), tz).slice(0, 7)
          );
          setSlotsLoading(false);
        }
        return;
      }
      if (cancelled) return;
      const tz = body.timezone || "Europe/London";
      setTimezone(tz);
      setDays(body.days ?? []);
      setSelectedDate((current) => current ?? ymdInTimeZone(new Date(), tz));
      setViewMonth(
        (current) => current ?? ymdInTimeZone(new Date(), tz).slice(0, 7)
      );
      if (
        !durationTouched.current &&
        body.default_duration_minutes &&
        body.default_duration_minutes !== duration
      ) {
        setDuration(body.default_duration_minutes);
      }
      setSlotsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [host, duration, ticketId, open]);

  const today = ymdInTimeZone(new Date(), timezone);
  const maxDate = addDaysYmd(today, 180);
  const slotsByDate = useMemo(() => {
    const map = new Map<string, SlotDay["slots"]>();
    for (const day of days) map.set(day.date, day.slots);
    return map;
  }, [days]);

  const month = viewMonth ?? today.slice(0, 7);
  const [year, monthNum] = month.split("-").map(Number);
  const grid = monthMatrix(year, (monthNum ?? 1) - 1);
  const daySlots = selectedDate ? (slotsByDate.get(selectedDate) ?? []) : [];

  const startsAt = useMemo(() => {
    if (!selectedDate || !timeValue) return null;
    if (slotStartsAt) {
      const parts = utcToZonedParts(new Date(slotStartsAt), timezone);
      const slotTime = `${pad2(parts.hour)}:${pad2(parts.minute)}`;
      const slotDate = ymdInTimeZone(new Date(slotStartsAt), timezone);
      if (slotTime === timeValue && slotDate === selectedDate) return slotStartsAt;
    }
    const [y, m, d] = selectedDate.split("-").map(Number);
    const [hh, mm] = timeValue.split(":").map(Number);
    if (!y || !m || !d || !Number.isFinite(hh) || !Number.isFinite(mm)) return null;
    return zonedLocalToUtc({
      year: y,
      month: m,
      day: d,
      hour: hh,
      minute: mm,
      timeZone: timezone,
    }).toISOString();
  }, [selectedDate, slotStartsAt, timeValue, timezone]);

  const listed =
    startsAt != null &&
    daySlots.some(
      (slot) => new Date(slot.starts_at).getTime() === new Date(startsAt).getTime()
    );

  const whenLabel = useMemo(() => {
    if (!startsAt) return null;
    const start = new Date(startsAt);
    const end = new Date(start.getTime() + duration * 60_000);
    const date = formatInTimeZone(start, timezone, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const startTime = formatInTimeZone(start, timezone, {
      hour: "numeric",
      minute: "2-digit",
    });
    const endTime = formatInTimeZone(end, timezone, {
      hour: "numeric",
      minute: "2-digit",
    });
    return { date, range: `${startTime}–${endTime}` };
  }, [duration, startsAt, timezone]);

  function pickDuration(next: number) {
    durationTouched.current = true;
    setDuration(Math.min(180, Math.max(5, Math.floor(next) || 20)));
    setConfirming(false);
  }

  function pickDay(ymd: string) {
    if (ymd < today || ymd > maxDate) return;
    setSelectedDate(ymd);
    setViewMonth(ymd.slice(0, 7));
    setTimeValue("");
    setSlotStartsAt(null);
    setConfirming(false);
    setError(null);
  }

  async function book() {
    if (!startsAt || !guestEmail || submitting) return;
    setSubmitting(true);
    setError(null);
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) {
      setSubmitting(false);
      setError("You need to be signed in.");
      return;
    }
    const res = await fetch(
      `/api/admin/support/tickets/${encodeURIComponent(ticketId)}/book-call`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          host_slug: host,
          starts_at: startsAt,
          duration_minutes: duration,
        }),
      }
    );
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      display?: { date?: string; time_range?: string };
      guest_email?: string;
    };
    setSubmitting(false);
    if (!res.ok) {
      setError(body.error ?? "Could not book that time.");
      setConfirming(false);
      return;
    }
    const when = [body.display?.date, body.display?.time_range]
      .filter(Boolean)
      .join(", ");
    setBooked({
      when: when || whenLabel?.date || "Booked",
      email: body.guest_email || guestEmail,
    });
    setConfirming(false);
    setOpen(false);
    setTimeValue("");
    setSlotStartsAt(null);
    onBooked();
  }

  const tzShort = formatCommunityTimezoneShort(timezone);
  const canGoPrev = shiftMonth(month, -1) >= today.slice(0, 7);
  const canGoNext = `${shiftMonth(month, 1)}-01` <= maxDate;

  return (
    <section className="mt-6 border-t border-slate-100 pt-4">
      {booked ? (
        <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
          <p className="text-sm font-medium text-emerald-950">Call booked</p>
          <p className="mt-1 text-xs leading-snug text-emerald-900">
            {booked.when}. Invite sent to {booked.email}.
          </p>
          <button
            type="button"
            onClick={() => {
              setBooked(null);
              setOpen(true);
            }}
            className="mt-2 text-xs font-semibold text-emerald-800 hover:underline"
          >
            Book another
          </button>
        </div>
      ) : null}

      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
      >
        <Calendar className="h-3.5 w-3.5" aria-hidden />
        {open ? "Hide booking" : "Book a support call"}
      </button>

      {open ? (
        <div className="mt-3">
      <p className="text-xs leading-snug text-slate-600">
        Book a time for {guestLabel}. They get the same calendar invite and
        confirmation as if they booked it themselves.
      </p>

      <div className="mt-3 inline-flex w-full rounded-lg border border-slate-200 bg-white p-0.5">
        {SUPPORT_CALL_HOSTS.map((item) => (
          <button
            key={item.slug}
            type="button"
            onClick={() => setHost(item.slug)}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold ${
              host === item.slug
                ? "bg-sky-700 text-white"
                : "text-slate-800 hover:bg-slate-50"
            }`}
          >
            {item.displayName}
          </button>
        ))}
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-700">Length</span>
          <span className="text-[11px] text-slate-600">{duration} min</span>
        </div>
        <div className="flex gap-1">
          {DURATION_PRESETS.map((mins) => (
            <button
              key={mins}
              type="button"
              onClick={() => pickDuration(mins)}
              className={`flex-1 rounded-md px-1 py-1 text-xs font-semibold ring-1 ring-inset ${
                duration === mins
                  ? "bg-sky-700 text-white ring-sky-700"
                  : "bg-white text-slate-800 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {mins}
            </button>
          ))}
        </div>
        <label className="mt-1.5 block">
          <span className="sr-only">Custom length in minutes</span>
          <input
            type="number"
            min={5}
            max={180}
            value={duration}
            onChange={(e) => pickDuration(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900"
          />
        </label>
      </div>

      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between">
          <button
            type="button"
            disabled={!canGoPrev}
            aria-label="Previous month"
            onClick={() => setViewMonth(shiftMonth(month, -1))}
            className="rounded-md p-1 text-slate-700 hover:bg-slate-100 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <p className="text-xs font-semibold text-slate-900">
            {monthTitle(month)}
          </p>
          <button
            type="button"
            disabled={!canGoNext}
            aria-label="Next month"
            onClick={() => setViewMonth(shiftMonth(month, 1))}
            className="rounded-md p-1 text-slate-700 hover:bg-slate-100 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {WEEKDAYS.map((label, index) => (
            <span
              key={`${label}-${index}`}
              className="py-1 text-[10px] font-semibold text-slate-600"
            >
              {label}
            </span>
          ))}
          {grid.flatMap((row, rowIndex) =>
            row.map((day, colIndex) => {
              if (!day) {
                return <span key={`e-${rowIndex}-${colIndex}`} />;
              }
              const ymd = `${year}-${pad2(monthNum ?? 1)}-${pad2(day)}`;
              const disabled = ymd < today || ymd > maxDate;
              const selected = ymd === selectedDate;
              const hasSlots = (slotsByDate.get(ymd)?.length ?? 0) > 0;
              return (
                <button
                  key={ymd}
                  type="button"
                  disabled={disabled}
                  onClick={() => pickDay(ymd)}
                  className={`relative mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs tabular-nums ${
                    selected
                      ? "bg-sky-700 font-semibold text-white"
                      : disabled
                        ? "text-slate-300"
                        : hasSlots
                          ? "font-semibold text-slate-950 hover:bg-slate-100"
                          : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {day}
                  {hasSlots && !selected ? (
                    <span className="absolute bottom-1 h-1 w-1 rounded-full bg-sky-600" />
                  ) : null}
                </button>
              );
            })
          )}
        </div>
        <p className="mt-1.5 text-[11px] text-slate-600">
          {slotsLoading ? "Loading open times…" : `Times in ${tzShort}`}
        </p>
      </div>

      {selectedDate ? (
        <div className="mt-2">
          {daySlots.length > 0 ? (
            <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
              {daySlots.map((slot) => {
                const active = slot.starts_at === slotStartsAt;
                return (
                  <button
                    key={slot.starts_at}
                    type="button"
                    onClick={() => {
                      const parts = utcToZonedParts(
                        new Date(slot.starts_at),
                        timezone
                      );
                      setTimeValue(`${pad2(parts.hour)}:${pad2(parts.minute)}`);
                      setSlotStartsAt(slot.starts_at);
                      setConfirming(false);
                      setError(null);
                    }}
                    className={`rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                      active
                        ? "bg-sky-700 text-white ring-sky-700"
                        : "bg-white text-slate-800 ring-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {slot.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs leading-snug text-slate-700">
              Nothing on the public hours this day. You can still book a time.
            </p>
          )}

          <label className="mt-2 block">
            <span className="mb-1 block text-xs font-semibold text-slate-700">
              Time
            </span>
            <input
              type="time"
              step={300}
              value={timeValue}
              onChange={(e) => {
                setTimeValue(e.target.value);
                setSlotStartsAt(null);
                setConfirming(false);
                setError(null);
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900"
            />
          </label>
        </div>
      ) : null}

      {startsAt && !listed ? (
        <p className="mt-2 text-[11px] leading-snug text-slate-700">
          This isn&apos;t on the public hours. Only this call is added. The
          booking page stays the same.
        </p>
      ) : null}

      {!guestEmail ? (
        <p className="mt-2 text-xs text-amber-800">
          This ticket has no email, so the invite can&apos;t be sent.
        </p>
      ) : null}

      {error ? (
        <p className="mt-2 text-xs text-rose-700" role="alert">
          {error}
        </p>
      ) : null}

      {confirming && whenLabel ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
          <p className="text-xs leading-snug text-slate-800">
            Book {duration} min with {supportCallHostDisplayName(host)} on{" "}
            {whenLabel.date}, {whenLabel.range}
            {guestEmail ? `. Invite goes to ${guestEmail}.` : "."}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={submitting || !guestEmail}
              onClick={() => void book()}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-sky-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : null}
              {submitting ? "Sending…" : "Send invite"}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => setConfirming(false)}
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              Back
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={!startsAt || !guestEmail || submitting}
          onClick={() => setConfirming(true)}
          className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-sky-700 px-2.5 py-2 text-xs font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Book call
        </button>
      )}

      <button
        type="button"
        onClick={onOpenSettings}
        className="mt-2 text-[11px] font-medium text-sky-800 hover:underline"
      >
        Weekly hours are in Settings
      </button>
        </div>
      ) : null}
    </section>
  );
}
