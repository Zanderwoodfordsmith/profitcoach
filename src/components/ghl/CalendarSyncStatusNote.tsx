import type { CalendarSyncStatus } from "@/lib/ghlCalendarSync";

export const CALENDAR_SYNC_TONE_SHELL: Record<CalendarSyncStatus["tone"], string> = {
  success: "border-emerald-200 bg-emerald-50/90",
  warning: "border-amber-200 bg-amber-50/90",
  neutral: "border-slate-200 bg-slate-50/90",
};

const TONE_CLASS: Record<CalendarSyncStatus["tone"], string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
};

export function CalendarSyncStatusNote({
  status,
  className = "",
}: {
  status: CalendarSyncStatus;
  className?: string;
}) {
  return (
    <p
      className={`rounded-md border px-3 py-2 text-sm ${TONE_CLASS[status.tone]} ${className}`}
      role="status"
    >
      {status.ready ? "✓ " : null}
      {status.message}
    </p>
  );
}
