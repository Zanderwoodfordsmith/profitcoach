"use client";

import {
  ACCOUNT_SETTING_TIMEZONES,
  accountTimezoneOptionLabel,
} from "@/lib/accountProfileTimezones";
import type { AvailabilityRuleRow } from "@/lib/booking/computeBookingSlots";

export const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
] as const;

export function WeeklyHoursEditor({
  title,
  hint,
  timezone,
  onTimezoneChange,
  rules,
  onRulesChange,
  onSave,
  saving,
  saveLabel = "Save hours",
  defaultStartTime = "09:00",
  defaultEndTime = "17:00",
  hideTimezone = false,
  plain = false,
}: {
  title: string;
  hint?: string;
  timezone: string;
  onTimezoneChange: (timezone: string) => void;
  rules: AvailabilityRuleRow[];
  onRulesChange: (rules: AvailabilityRuleRow[]) => void;
  onSave: () => void;
  saving?: boolean;
  saveLabel?: string;
  defaultStartTime?: string;
  defaultEndTime?: string;
  /** The parent already shows the time zone. */
  hideTimezone?: boolean;
  /** No card, title, or full-width button. For a page that already has a heading. */
  plain?: boolean;
}) {
  function toggleWeekday(weekday: number) {
    const has = rules.some((r) => r.weekday === weekday);
    if (has) {
      onRulesChange(rules.filter((r) => r.weekday !== weekday));
      return;
    }
    onRulesChange(
      [
        ...rules,
        {
          weekday,
          start_time: defaultStartTime,
          end_time: defaultEndTime,
        },
      ].sort((a, b) => a.weekday - b.weekday)
    );
  }

  function patchDay(
    weekday: number,
    patch: Partial<Pick<AvailabilityRuleRow, "start_time" | "end_time">>
  ) {
    onRulesChange(
      rules.map((r) => (r.weekday === weekday ? { ...r, ...patch } : r))
    );
  }

  return (
    <div className={plain ? "" : "rounded-xl border border-slate-200/80 bg-white p-4"}>
      {plain ? null : <h3 className="text-sm font-semibold text-slate-900">{title}</h3>}
      {!plain && hint ? (
        <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
      ) : null}

      {hideTimezone ? null : (
        <label className="mt-4 block text-sm">
          <span className="font-medium text-slate-700">Timezone</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={timezone}
            onChange={(e) => onTimezoneChange(e.target.value)}
          >
            {ACCOUNT_SETTING_TIMEZONES.map((z) => (
              <option key={z} value={z}>
                {accountTimezoneOptionLabel(z)}
              </option>
            ))}
          </select>
        </label>
      )}

      <ul className={`${hideTimezone ? "mt-1" : "mt-3"} space-y-1.5`}>
        {WEEKDAYS.map((day) => {
          const rule = rules.find((r) => r.weekday === day.value);
          return (
            <li
              key={day.value}
              className="flex flex-wrap items-center gap-2 rounded-lg px-1 py-1"
            >
              <label
                className={`inline-flex items-center gap-2 font-semibold text-slate-700 ${
                  plain ? "w-16 text-sm" : "w-10 gap-1.5 text-xs"
                }`}
              >
                <input
                  type="checkbox"
                  className={`rounded border-slate-300 text-sky-600 ${plain ? "h-4 w-4" : "h-3.5 w-3.5"}`}
                  checked={Boolean(rule)}
                  onChange={() => toggleWeekday(day.value)}
                />
                {day.label}
              </label>
              {rule ? (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <input
                    type="time"
                    className={`w-full min-w-0 rounded border border-slate-200 text-slate-900 ${
                      plain ? "px-2 py-1.5 text-sm" : "px-1.5 py-1 text-xs"
                    }`}
                    value={rule.start_time.slice(0, 5)}
                    onChange={(e) =>
                      patchDay(day.value, { start_time: e.target.value })
                    }
                  />
                  <span className="text-xs text-slate-400">to</span>
                  <input
                    type="time"
                    className={`w-full min-w-0 rounded border border-slate-200 text-slate-900 ${
                      plain ? "px-2 py-1.5 text-sm" : "px-1.5 py-1 text-xs"
                    }`}
                    value={rule.end_time.slice(0, 5)}
                    onChange={(e) =>
                      patchDay(day.value, { end_time: e.target.value })
                    }
                  />
                </div>
              ) : (
                <span className={plain ? "text-sm text-slate-400" : "text-[11px] text-slate-400"}>Off</span>
              )}
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        disabled={saving}
        onClick={onSave}
        className={
          plain
            ? "mt-4 rounded-full bg-[#051e36] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0c5290] disabled:opacity-60"
            : "mt-4 w-full rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
        }
      >
        {saving ? "Saving…" : saveLabel}
      </button>
    </div>
  );
}
