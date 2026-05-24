"use client";

import { useEffect, useState } from "react";
import { DateTime } from "luxon";
import { X } from "lucide-react";

import type {
  CommunityCalendarEventRow,
  CommunityCalendarOccurrence,
} from "@/lib/communityCalendarTypes";

export type CommunityCalendarCancelScope = "occurrence" | "series";

const REASON_MAX = 500;

type Props = {
  occurrence: CommunityCalendarOccurrence;
  eventRow: CommunityCalendarEventRow;
  saving?: boolean;
  onClose: () => void;
  onConfirm: (
    scope: CommunityCalendarCancelScope,
    cancellationReason?: string | null
  ) => void | Promise<void>;
};

function formatOccurrenceWhen(occurrence: CommunityCalendarOccurrence): string {
  const tz = occurrence.display_timezone || "UTC";
  const start = DateTime.fromISO(occurrence.startsAtIso, { zone: "utc" }).setZone(
    tz
  );
  const end = DateTime.fromISO(occurrence.endsAtIso, { zone: "utc" }).setZone(tz);
  const sameDay = start.toISODate() === end.toISODate();
  if (sameDay) {
    return `${start.toFormat("cccc, MMM d")} · ${start.toFormat("h:mm a")} – ${end.toFormat("h:mm a")}`;
  }
  return `${start.toFormat("ccc h:mm a")} – ${end.toFormat("ccc h:mm a")}`;
}

export function CommunityCalendarCancelModal({
  occurrence,
  eventRow,
  saving = false,
  onClose,
  onConfirm,
}: Props) {
  const isRecurring = eventRow.is_recurring && Boolean(eventRow.recurrence);
  const whenLabel = formatOccurrenceWhen(occurrence);
  const [reason, setReason] = useState("");

  useEffect(() => {
    setReason("");
  }, [occurrence]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, saving]);

  const trimmedReason = reason.trim() || null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/55 p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close cancel dialog"
        onClick={() => {
          if (!saving) onClose();
        }}
        className="absolute inset-0 cursor-default"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="community-calendar-cancel-title"
        className="relative z-[131] w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <button
          type="button"
          onClick={() => {
            if (!saving) onClose();
          }}
          aria-label="Close"
          disabled={saving}
          className="absolute right-3 top-3 rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="space-y-4 p-5 pt-6">
          <div className="space-y-2 pr-8">
            <h2
              id="community-calendar-cancel-title"
              className="text-lg font-bold text-slate-900"
            >
              Cancel session?
            </h2>
            <p className="text-sm font-semibold text-slate-900">
              {occurrence.title}
            </p>
            <p className="text-sm text-slate-600">{whenLabel}</p>
            {isRecurring ? (
              <p className="text-sm text-slate-600">
                This is a recurring event. Cancel just this session, or the
                entire series?
              </p>
            ) : (
              <p className="text-sm text-slate-600">
                This session will stay on the calendar but be marked as
                cancelled.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="community-calendar-cancel-reason"
              className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Reason (optional)
            </label>
            <textarea
              id="community-calendar-cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={REASON_MAX}
              rows={3}
              placeholder="e.g. Coach unavailable — rescheduled to next week"
              disabled={saving}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200 disabled:opacity-50"
            />
            <p className="text-right text-xs text-slate-400">
              {reason.length} / {REASON_MAX}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                if (!saving) onClose();
              }}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Keep session
            </button>
            {isRecurring ? (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void onConfirm("occurrence", trimmedReason)}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {saving ? "Cancelling…" : "This session only"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void onConfirm("series")}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50"
                >
                  {saving ? "Cancelling…" : "Entire series"}
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={() => void onConfirm("occurrence", trimmedReason)}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {saving ? "Cancelling…" : "Cancel session"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
