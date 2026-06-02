export type TimeBlockRating = "good" | "bad" | "neutral" | "unset";

export const TIME_BLOCK_RATINGS: TimeBlockRating[] = [
  "good",
  "bad",
  "neutral",
  "unset",
];

export type TimeBlockPriority = "high" | "medium" | "low" | "none";

export const TIME_BLOCK_PRIORITIES: TimeBlockPriority[] = [
  "high",
  "medium",
  "low",
  "none",
];

export type TimeTrackerSettings = {
  dayStartMin: number;
  visibleHours: number;
  slotMinutes: number;
};

export const DEFAULT_TIME_TRACKER_SETTINGS: TimeTrackerSettings = {
  dayStartMin: 6 * 60,
  visibleHours: 18,
  slotMinutes: 15,
};

export type TimeTrackerBlock = {
  id: string;
  userId: string;
  dayDate: string; // YYYY-MM-DD
  startMin: number;
  endMin: number;
  title: string;
  notes: string;
  rating: TimeBlockRating;
  priority: TimeBlockPriority;
  category: string;
  createdAt: string;
  updatedAt: string;
};

export type TimeTrackerAdmin = {
  id: string;
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
};
