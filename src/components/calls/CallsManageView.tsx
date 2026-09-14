"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import {
  CALENDAR_VIEW_TYPES,
  type CalendarFilterItem,
  type CalendarViewType,
} from "@/lib/calls/calendarView";
import { blockedSlotCalendarClass, callStatusCalendarClass } from "@/lib/callStatusUi";

type Props = {
  open: boolean;
  onClose: () => void;
  calendars: CalendarFilterItem[];
  calendarsLoading?: boolean;
  settingsHref?: string;
  selectedCalendars: Set<string>;
  onToggleCalendar: (name: string) => void;
  viewType: CalendarViewType;
  onViewTypeChange: (next: CalendarViewType) => void;
  showCoachFilter?: boolean;
  coachFilterOptions?: Array<{ id: string; label: string }>;
  coachFilter?: string | "all";
  onCoachFilterChange?: (coachId: string | "all") => void;
};

function FilterSection({
  id,
  title,
  open,
  onToggle,
  summary,
  children,
}: {
  id: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  summary?: string;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 py-2.5 text-left"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
      >
        <span className="text-sm font-semibold text-slate-900">{title}</span>
        <span className="flex min-w-0 items-center gap-2">
          {!open && summary ? (
            <span className="max-w-[8rem] truncate text-xs text-slate-500">
              {summary}
            </span>
          ) : null}
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
              open ? "rotate-180" : ""
            }`}
            aria-hidden
          />
        </span>
      </button>
      {open ? (
        <div id={id} className="pb-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}

const KEY_ITEMS: { label: string; swatchClass: string }[] = [
  { label: "Confirmed", swatchClass: callStatusCalendarClass("confirmed") },
  { label: "Completed", swatchClass: callStatusCalendarClass("completed") },
  { label: "No-show", swatchClass: callStatusCalendarClass("noshow") },
  { label: "Cancelled", swatchClass: callStatusCalendarClass("cancelled") },
  { label: "Blocked", swatchClass: blockedSlotCalendarClass },
];

export function CallsManageView({
  open,
  onClose,
  calendars,
  calendarsLoading = false,
  settingsHref,
  selectedCalendars,
  onToggleCalendar,
  viewType,
  onViewTypeChange,
  showCoachFilter = false,
  coachFilterOptions,
  coachFilter,
  onCoachFilterChange,
}: Props) {
  const [sections, setSections] = useState({
    calendars: true,
    type: true,
    coaches: false,
  });

  function toggleSection(key: keyof typeof sections) {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const enabledCount = calendars.filter((item) => item.enabled).length;
  const calendarSummary =
    calendars.length === 0
      ? calendarsLoading
        ? "Loading"
        : "None"
      : selectedCalendars.size === enabledCount &&
          enabledCount > 0 &&
          calendars.every((item) => !item.enabled || selectedCalendars.has(item.name))
        ? "On"
        : `${selectedCalendars.size} of ${calendars.length}`;

  const typeSummary =
    CALENDAR_VIEW_TYPES.find((item) => item.id === viewType)?.label ?? "All";

  return (
    <div className="flex w-full shrink-0 flex-col gap-3 lg:w-72">
      <aside
        className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${
          open ? "" : "hidden lg:block"
        }`}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Manage view</h3>
          <button
            type="button"
            className="text-xs text-slate-500 lg:hidden"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <FilterSection
          id="calls-filter-calendars"
          title="Calendars"
          open={sections.calendars}
          onToggle={() => toggleSection("calendars")}
          summary={calendarSummary}
        >
          <ul className="max-h-56 space-y-2 overflow-y-auto">
            {calendarsLoading && calendars.length === 0 ? (
              <li className="text-xs text-slate-500">Loading calendars…</li>
            ) : null}
            {calendars.map((item) => (
              <li key={item.name}>
                <label
                  className={`flex items-center gap-2 text-sm ${
                    item.enabled ? "text-slate-800" : "text-slate-400"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-sky-600 disabled:opacity-60"
                    checked={selectedCalendars.has(item.name)}
                    onChange={() => onToggleCalendar(item.name)}
                  />
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  {item.enabled ? null : (
                    <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Off
                    </span>
                  )}
                </label>
              </li>
            ))}
            {!calendarsLoading && calendars.length === 0 ? (
              <li className="text-xs text-slate-500">
                No booking calendars yet.
                {settingsHref ? (
                  <>
                    {" "}
                    <Link
                      href={settingsHref}
                      className="font-medium text-sky-700 hover:underline"
                    >
                      Add one in Settings
                    </Link>
                  </>
                ) : null}
              </li>
            ) : null}
          </ul>
          {settingsHref && calendars.length > 0 ? (
            <p className="mt-2 text-xs text-slate-500">
              <Link href={settingsHref} className="font-medium text-sky-700 hover:underline">
                Edit calendars
              </Link>
            </p>
          ) : null}
        </FilterSection>

        <FilterSection
          id="calls-filter-type"
          title="Type"
          open={sections.type}
          onToggle={() => toggleSection("type")}
          summary={typeSummary}
        >
          <div className="space-y-2" role="radiogroup" aria-label="Calendar type">
            {CALENDAR_VIEW_TYPES.map((item) => (
              <label
                key={item.id}
                className="flex cursor-pointer items-start gap-2 text-sm text-slate-800"
              >
                <input
                  type="radio"
                  name="calls-calendar-type"
                  className="mt-0.5 h-4 w-4 border-slate-300 text-sky-600"
                  checked={viewType === item.id}
                  onChange={() => onViewTypeChange(item.id)}
                />
                <span>
                  <span className="font-medium">{item.label}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-slate-500">
                    {item.hint}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </FilterSection>

        {showCoachFilter && coachFilterOptions && onCoachFilterChange ? (
          <FilterSection
            id="calls-filter-coaches"
            title="Coaches"
            open={sections.coaches}
            onToggle={() => toggleSection("coaches")}
            summary={
              coachFilter && coachFilter !== "all"
                ? coachFilterOptions.find((c) => c.id === coachFilter)?.label
                : "All coaches"
            }
          >
            <select
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              value={coachFilter ?? "all"}
              onChange={(e) =>
                onCoachFilterChange(
                  e.target.value === "all" ? "all" : e.target.value
                )
              }
            >
              <option value="all">All coaches</option>
              {coachFilterOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </FilterSection>
        ) : null}
      </aside>

      <section
        className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${
          open ? "" : "hidden lg:block"
        }`}
        aria-label="Calendar key"
      >
        <h3 className="text-sm font-semibold text-slate-900">Key</h3>
        <ul className="mt-3 space-y-2">
          {KEY_ITEMS.map((item) => (
            <li key={item.label} className="flex items-center gap-2.5 text-sm text-slate-700">
              <span
                className={`h-3.5 w-3.5 shrink-0 rounded-sm border ${item.swatchClass}`}
                aria-hidden
              />
              {item.label}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
