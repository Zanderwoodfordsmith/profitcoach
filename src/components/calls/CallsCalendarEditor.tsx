"use client";

import Link from "next/link";
import { ChevronLeft, Copy } from "lucide-react";
import { BookingReminderSequenceCard } from "@/components/calls/BookingReminderSequenceCard";
import type { CoachCalendarRow } from "@/lib/booking/coachCalendars";
import type { BookingReminderStep } from "@/lib/booking/reminderSequence";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { fieldClass } from "@/components/ui/Field";
import { badgeClass } from "@/components/ui/Badge";

type Props = {
  calendar: CoachCalendarRow;
  onChange: (next: CoachCalendarRow) => void;
  onSave: () => void;
  saving: boolean;
  backHref: string;
  bookUrl: string | null;
  copied: boolean;
  onCopyLink: () => void;
  hideReminders?: boolean;
};

export function CallsCalendarEditor({
  calendar,
  onChange,
  onSave,
  saving,
  backHref,
  bookUrl,
  copied,
  onCopyLink,
  hideReminders = false,
}: Props) {
  function patch(next: Partial<CoachCalendarRow>) {
    onChange({ ...calendar, ...next });
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={backHref}
          scroll={false}
          className="inline-flex items-center gap-0.5 text-xs font-medium text-slate-500 transition hover:text-sky-700"
        >
          <ChevronLeft className="-ml-1 h-3.5 w-3.5 shrink-0" aria-hidden />
          Booking calendars
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                {calendar.name}
              </h2>
              <span
                className={badgeClass(calendar.is_enabled ? "green" : "grey")}
              >
                {calendar.is_enabled ? "Active" : "Off"}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Length, buffers, the public link, and reminders for this calendar
              only.
            </p>
          </div>
          {calendar.is_public && calendar.is_enabled && bookUrl ? (
            <button
              type="button"
              className={buttonClass("quiet", "small", "shrink-0")}
              onClick={onCopyLink}
            >
              {copied ? (
                "Copied"
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                  Copy link
                </>
              )}
            </button>
          ) : null}
        </div>
      </div>

      <section className={cardClass("plain", "space-y-4 px-4 py-4")}>
        <h3 className="text-sm font-semibold text-slate-900">Meeting</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-slate-700">Name</span>
            <input
              className={fieldClass("input", "normal", "mt-1")}
              value={calendar.name}
              onChange={(e) => patch({ name: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Duration (min)</span>
            <input
              type="number"
              min={5}
              max={180}
              className={fieldClass("input", "normal", "mt-1")}
              value={calendar.meeting_duration_minutes}
              onChange={(e) =>
                patch({
                  meeting_duration_minutes: Number(e.target.value) || 15,
                })
              }
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Buffer (min)</span>
            <input
              type="number"
              min={0}
              max={120}
              className={fieldClass("input", "normal", "mt-1")}
              value={calendar.buffer_minutes}
              onChange={(e) =>
                patch({ buffer_minutes: Number(e.target.value) || 0 })
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
              className={fieldClass("input", "normal", "mt-1")}
              value={calendar.min_notice_hours}
              onChange={(e) =>
                patch({ min_notice_hours: Number(e.target.value) || 0 })
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
              className={fieldClass("input", "normal", "mt-1")}
              value={calendar.booking_window_days}
              onChange={(e) =>
                patch({
                  booking_window_days: Number(e.target.value) || 14,
                })
              }
            />
          </label>
          <label className="inline-flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-sky-600"
              checked={calendar.is_enabled}
              onChange={(e) =>
                patch({
                  is_enabled: e.target.checked,
                  is_public: e.target.checked ? calendar.is_public : false,
                })
              }
            />
            Enabled
          </label>
          <label className="inline-flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-sky-600"
              checked={calendar.is_public}
              disabled={!calendar.is_enabled}
              onChange={(e) => patch({ is_public: e.target.checked })}
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
                  ["zoom", "Zoom"],
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
                    name={`loc-${calendar.id}`}
                    checked={calendar.location_mode === value}
                    onChange={() => patch({ location_mode: value })}
                  />
                  {label}
                </label>
              ))}
            </div>
            {calendar.location_mode === "zoom" ? (
              <p className="mt-2 text-xs text-slate-500">
                Each booking creates a unique Zoom meeting and records it to
                the cloud when Zoom recording is available on the account.
              </p>
            ) : null}
            {calendar.location_mode === "phone" ? (
              <input
                className={fieldClass("input", "normal", "mt-2")}
                placeholder="Phone number"
                value={calendar.location_phone ?? ""}
                onChange={(e) => patch({ location_phone: e.target.value })}
              />
            ) : null}
            {calendar.location_mode === "custom" ? (
              <input
                className={fieldClass("input", "normal", "mt-2")}
                placeholder="Custom link or note"
                value={calendar.location_custom ?? ""}
                onChange={(e) => patch({ location_custom: e.target.value })}
              />
            ) : null}
          </fieldset>
        </div>
      </section>

      {!hideReminders ? (
        <BookingReminderSequenceCard
          sequence={calendar.reminder_sequence}
          onChange={(reminder_sequence: BookingReminderStep[]) =>
            patch({ reminder_sequence })
          }
          calendarName={calendar.name}
        />
      ) : null}

      <button
        type="button"
        disabled={saving}
        className={buttonClass("main")}
        onClick={onSave}
      >
        {saving ? "Saving…" : "Save calendar"}
      </button>
    </div>
  );
}
