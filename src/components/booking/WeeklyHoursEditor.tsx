"use client";

import {
  ACCOUNT_SETTING_TIMEZONES,
  accountTimezoneOptionLabel,
} from "@/lib/accountProfileTimezones";
import type { AvailabilityRuleRow } from "@/lib/booking/computeBookingSlots";
import { Plus, X } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { fieldClass } from "@/components/ui/Field";

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
  multiple = false,
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
  /** More than one time slot a day, e.g. 09:00 to 11:00 and 15:00 to 16:00. */
  multiple?: boolean;
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

  function patchSlot(
    index: number,
    patch: Partial<Pick<AvailabilityRuleRow, "start_time" | "end_time">>
  ) {
    onRulesChange(rules.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeSlot(index: number) {
    onRulesChange(rules.filter((_, i) => i !== index));
  }

  /** A new slot an hour long, starting where the day's last slot ends. */
  function addSlot(weekday: number) {
    const day = rules.filter((r) => r.weekday === weekday);
    const last = day[day.length - 1];
    const [h, m] = (last?.end_time ?? defaultEndTime).slice(0, 5).split(":").map(Number);
    const startMin = Math.min(h * 60 + m + 60, 22 * 60);
    const fmt = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
    onRulesChange([...rules, { weekday, start_time: fmt(startMin), end_time: fmt(startMin + 60) }]);
  }

  const timeClass = fieldClass("input", "small", "min-w-0");

  return (
    <div className={plain ? "" : cardClass("plain", "p-4")}>
      {plain ? null : <h3 className="text-sm font-semibold text-slate-900">{title}</h3>}
      {!plain && hint ? (
        <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
      ) : null}

      {hideTimezone ? null : (
        <label className="mt-4 block text-sm">
          <span className="font-medium text-slate-700">Timezone</span>
          <select
            className={fieldClass("select", "normal", "mt-1")}
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
          const slots = rules
            .map((rule, index) => ({ rule, index }))
            .filter(({ rule }) => rule.weekday === day.value);
          return (
            <li
              key={day.value}
              className="flex flex-wrap items-start gap-2 rounded-lg px-1 py-1"
            >
              <label
                className={`inline-flex items-center gap-2 font-medium text-slate-700 ${
                  plain ? "w-16 py-1.5 text-sm" : "w-10 gap-1.5 py-1 text-xs"
                }`}
              >
                <input
                  type="checkbox"
                  className={`rounded border-slate-300 text-sky-600 ${plain ? "h-4 w-4" : "h-3.5 w-3.5"}`}
                  checked={slots.length > 0}
                  onChange={() => toggleWeekday(day.value)}
                />
                {day.label}
              </label>
              {slots.length ? (
                <div className="min-w-0 flex-1 space-y-1.5">
                  {slots.map(({ rule, index }) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="time"
                        aria-label={`${day.label} from`}
                        className={timeClass}
                        value={rule.start_time.slice(0, 5)}
                        onChange={(e) => patchSlot(index, { start_time: e.target.value })}
                      />
                      <span className="text-xs text-slate-400">to</span>
                      <input
                        type="time"
                        aria-label={`${day.label} to`}
                        className={timeClass}
                        value={rule.end_time.slice(0, 5)}
                        onChange={(e) => patchSlot(index, { end_time: e.target.value })}
                      />
                      {multiple ? (
                        <span className="flex w-14 shrink-0 items-center gap-0.5">
                          {slots.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => removeSlot(index)}
                              aria-label={`Remove this ${day.label} time`}
                              title="Remove this time"
                              className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                              <X className="h-4 w-4" aria-hidden />
                            </button>
                          ) : (
                            <span aria-hidden className="w-7" />
                          )}
                          {index === slots[slots.length - 1].index ? (
                            <button
                              type="button"
                              onClick={() => addSlot(day.value)}
                              aria-label={`Add another ${day.label} time`}
                              title="Add another time"
                              className="flex h-7 w-7 items-center justify-center rounded-full text-sky-700 hover:bg-sky-50"
                            >
                              <Plus className="h-4 w-4" aria-hidden />
                            </button>
                          ) : null}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <span className={plain ? "py-1.5 text-sm text-slate-400" : "py-1 text-caption text-slate-400"}>Off</span>
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
            ? buttonClass("main", "small", "mt-4")
            : buttonClass("main", "normal", "mt-4 w-full")
        }
      >
        {saving ? "Saving…" : saveLabel}
      </button>
    </div>
  );
}
