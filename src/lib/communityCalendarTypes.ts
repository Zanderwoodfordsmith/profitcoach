export type CommunityCalendarLocationKind = "link" | "in_person";

/** Mon = 0 … Sun = 6 (matches UI checkboxes). */
export type WeekdayMon0Sun6 = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type RecurrencePayload = {
  interval: number;
  unit: "week" | "month";
  weekdays: WeekdayMon0Sun6[];
  end: "never" | "on" | "after";
  /** yyyy-MM-dd interpreted in display_timezone */
  endDate?: string;
  maxOccurrences?: number;
};

export type CommunityCalendarEventRow = {
  id: string;
  created_by: string;
  title: string;
  description: string;
  cover_image_url: string | null;
  starts_at: string;
  ends_at: string;
  display_timezone: string;
  location_kind: CommunityCalendarLocationKind;
  location_url: string | null;
  is_recurring: boolean;
  recurrence: RecurrencePayload | null;
  created_at: string;
  updated_at: string;
};

export type CommunityCalendarOccurrence = {
  eventId: string;
  title: string;
  description: string;
  cover_image_url: string | null;
  startsAtIso: string;
  endsAtIso: string;
  display_timezone: string;
  location_kind: CommunityCalendarLocationKind;
  location_url: string | null;
};
