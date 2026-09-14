"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, Clock, Loader2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookingDateTimePicker } from "@/components/booking/BookingDateTimePicker";
import { Modal } from "@/components/ui/Modal";
import { formatCommunityTimezoneShort } from "@/lib/communityCalendarTimezones";
import { callsCalendarsHref } from "@/lib/booking/callsCalendarsPath";
import type { CoachCalendarRow } from "@/lib/booking/coachCalendars";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import { formatInTimeZone } from "@/lib/booking/bookingTime";
import { formatProspectPersonName } from "@/lib/prospectDisplayFormat";
import type { ProspectNextCall } from "@/lib/prospectNextCall";
import type { ProspectRow } from "@/lib/prospectRow";

type SlotDay = {
  date: string;
  label: string;
  slots: { starts_at: string; ends_at: string; label: string }[];
};

type Props = {
  prospect: ProspectRow | null;
  onClose: () => void;
  onBooked: (row: ProspectRow, nextCall: ProspectNextCall) => void;
};

export function BookProspectModal({ prospect, onClose, onBooked }: Props) {
  const pathname = usePathname() ?? "";
  const isAdmin = pathname.startsWith("/admin");
  const { impersonatingCoachId } = useImpersonation();
  const [calendars, setCalendars] = useState<CoachCalendarRow[]>([]);
  const [timezone, setTimezone] = useState("Europe/London");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCalendar, setSelectedCalendar] =
    useState<CoachCalendarRow | null>(null);
  const [days, setDays] = useState<SlotDay[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{
    starts_at: string;
    ends_at: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const name = prospect
    ? formatProspectPersonName(prospect.full_name) || prospect.full_name
    : "";

  const loadCalendars = useCallback(async () => {
    if (!prospect) return;
    setLoading(true);
    setError(null);
    setSelectedCalendar(null);
    setDays([]);
    setSelectedSlot(null);
    const headers = await getCoachAuthHeaders(impersonatingCoachId);
    if (!headers) {
      setError("You must be signed in to book a call.");
      setLoading(false);
      return;
    }
    const res = await fetch("/api/coach/calendars", { headers });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      timezone?: string;
      calendars?: CoachCalendarRow[];
    };
    if (!res.ok) {
      setError(body.error ?? "Could not load calendars.");
      setLoading(false);
      return;
    }
    const enabled = (body.calendars ?? []).filter((c) => c.is_enabled);
    setTimezone(body.timezone ?? "Europe/London");
    setCalendars(enabled);
    if (enabled.length === 1) {
      setSelectedCalendar(enabled[0]!);
    }
    setLoading(false);
  }, [impersonatingCoachId, prospect]);

  useEffect(() => {
    if (!prospect) return;
    void loadCalendars();
  }, [prospect, loadCalendars]);

  const loadSlots = useCallback(async () => {
    if (!prospect || !selectedCalendar) {
      setDays([]);
      return;
    }
    setSlotsLoading(true);
    setError(null);
    setSelectedSlot(null);
    const headers = await getCoachAuthHeaders(impersonatingCoachId);
    if (!headers) {
      setSlotsLoading(false);
      return;
    }
    const res = await fetch(
      `/api/coach/calendars/${encodeURIComponent(selectedCalendar.id)}/slots?tz=${encodeURIComponent(timezone)}`,
      { headers }
    );
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      days?: SlotDay[];
      timezone?: string;
    };
    setSlotsLoading(false);
    if (!res.ok) {
      setError(body.error ?? "Could not load times.");
      setDays([]);
      return;
    }
    const nextDays = body.days ?? [];
    setDays(nextDays);
    setSelectedDate(nextDays[0]?.date ?? null);
  }, [impersonatingCoachId, prospect, selectedCalendar, timezone]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  const nowLabel = useMemo(() => {
    try {
      return formatInTimeZone(new Date(), timezone, {
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }, [timezone]);

  async function confirmBooking() {
    if (!prospect || !selectedCalendar || !selectedSlot) return;
    setSubmitting(true);
    setError(null);
    const headers = await getCoachAuthHeaders(impersonatingCoachId);
    if (!headers) {
      setError("You must be signed in to book a call.");
      setSubmitting(false);
      return;
    }
    const res = await fetch("/api/coach/bookings", {
      method: "POST",
      headers,
      body: JSON.stringify({
        prospect_id: prospect.id,
        calendar_id: selectedCalendar.id,
        starts_at: selectedSlot.starts_at,
        prospect_timezone: timezone,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      next_call?: ProspectNextCall;
    };
    setSubmitting(false);
    if (!res.ok || !body.next_call) {
      setError(body.error ?? "Could not book that time.");
      return;
    }
    onBooked(prospect, body.next_call);
    onClose();
  }

  const showBack = calendars.length > 1 && selectedCalendar;

  return (
    <Modal
      open={Boolean(prospect)}
      onClose={onClose}
      busy={submitting}
      title="Book a call"
      titleId="book-prospect-title"
      subtitle={name || undefined}
      maxWidthClassName="max-w-lg"
      overlayClassName="z-[80]"
      footer={
        selectedCalendar && selectedSlot ? (
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
            <button
              type="button"
              disabled={submitting}
              onClick={() => void confirmBooking()}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              {submitting ? "Booking…" : "Confirm"}
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="max-h-[calc(90vh-8rem)] overflow-y-auto px-5 py-4">
        {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}

        {loading ? (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading calendars…
          </p>
        ) : !selectedCalendar ? (
          calendars.length === 0 ? (
            <p className="text-sm text-slate-600">
              No calendars are on for the account you are booking with.{" "}
              <Link
                href={callsCalendarsHref(isAdmin)}
                className="font-medium text-sky-700 hover:text-sky-900"
              >
                Turn one on in Calls → Settings
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-2">
              {calendars.map((cal) => (
                <li key={cal.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedCalendar(cal)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left hover:border-sky-300 hover:bg-sky-50/60"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">
                        {cal.name}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <Clock className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                        {cal.meeting_duration_minutes} min
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : (
          <div>
            {showBack ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedCalendar(null);
                  setDays([]);
                  setSelectedSlot(null);
                }}
                className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Calendars
              </button>
            ) : null}
            <p className="mb-3 text-sm font-medium text-slate-800">
              {selectedCalendar.name}
              <span className="ml-1.5 font-normal text-slate-500">
                {selectedCalendar.meeting_duration_minutes} min
              </span>
            </p>
            <BookingDateTimePicker
              timezone={timezone}
              meetingDurationMinutes={selectedCalendar.meeting_duration_minutes}
              days={days}
              loading={slotsLoading}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              selectedSlot={selectedSlot}
              onSelectSlot={setSelectedSlot}
              nowLabel={nowLabel}
              timezoneShort={formatCommunityTimezoneShort(timezone)}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
