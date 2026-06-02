import type {
  TimeBlockPriority,
  TimeBlockRating,
  TimeTrackerBlock,
  TimeTrackerSettings,
} from "./types";
import { DEFAULT_TIME_TRACKER_SETTINGS } from "./types";

export type TimeTrackerBlockRow = {
  id: string;
  user_id: string;
  day_date: string;
  start_min: number;
  end_min: number;
  title: string | null;
  notes: string | null;
  rating: string | null;
  priority: string | null;
  category: string | null;
  created_at: string;
  updated_at: string;
};

function normalizeRating(value: string | null): TimeBlockRating {
  if (value === "good" || value === "bad" || value === "neutral") return value;
  return "unset";
}

function normalizePriority(value: string | null): TimeBlockPriority {
  if (value === "high" || value === "medium" || value === "low") return value;
  return "none";
}

export function mapBlockRow(row: TimeTrackerBlockRow): TimeTrackerBlock {
  return {
    id: row.id,
    userId: row.user_id,
    dayDate: row.day_date,
    startMin: row.start_min,
    endMin: row.end_min,
    title: row.title ?? "",
    notes: row.notes ?? "",
    rating: normalizeRating(row.rating),
    priority: normalizePriority(row.priority),
    category: row.category ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type TimeTrackerSettingsRow = {
  user_id: string;
  day_start_min: number;
  visible_hours: number;
  slot_minutes: number;
};

export function mapSettingsRow(
  row: TimeTrackerSettingsRow | null
): TimeTrackerSettings {
  if (!row) return { ...DEFAULT_TIME_TRACKER_SETTINGS };
  return {
    dayStartMin: row.day_start_min,
    visibleHours: row.visible_hours,
    slotMinutes: row.slot_minutes,
  };
}
