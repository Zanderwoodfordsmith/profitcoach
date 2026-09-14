export type CalendarViewType = "all" | "appointments" | "blocked";

export type CalendarFilterItem = {
  name: string;
  enabled: boolean;
};

export type CalendarBusyBlock = {
  id: string;
  starts_at: string;
  ends_at: string;
  title: string;
  all_day: boolean;
};

export const CALENDAR_VIEW_TYPES: {
  id: CalendarViewType;
  label: string;
  hint: string;
}[] = [
  {
    id: "all",
    label: "All",
    hint: "Bookings and events from connected calendars",
  },
  {
    id: "appointments",
    label: "Appointments",
    hint: "Calls booked through your calendars",
  },
  {
    id: "blocked",
    label: "Blocked slots",
    hint: "Events from connected calendars",
  },
];

export function parseCalendarViewType(raw: string | null): CalendarViewType {
  if (raw === "appointments" || raw === "blocked") return raw;
  return "all";
}
