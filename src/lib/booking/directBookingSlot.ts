import { intervalsOverlapWithBuffer } from "@/lib/booking/computeBookingSlots";
import type { ExistingBookingInterval } from "@/lib/booking/computeBookingSlots";

export const BOOKING_DURATION_MIN_MINUTES = 5;
export const BOOKING_DURATION_MAX_MINUTES = 180;
/** Staff can place a one-off call this far ahead. */
export const DIRECT_BOOKING_MAX_AHEAD_DAYS = 180;

export function clampBookingDurationMinutes(
  value: number | null | undefined,
  fallback: number
): number {
  const raw =
    value == null || !Number.isFinite(value) ? fallback : Math.floor(value);
  const base = Number.isFinite(raw) ? raw : 20;
  return Math.min(
    BOOKING_DURATION_MAX_MINUTES,
    Math.max(BOOKING_DURATION_MIN_MINUTES, base)
  );
}

export function directBookingWindow(input: {
  startsAt: string;
  durationMinutes: number;
  now?: Date;
}):
  | { ok: true; start: Date; end: Date }
  | { ok: false; status: number; error: string } {
  const start = new Date(input.startsAt);
  if (Number.isNaN(start.getTime())) {
    return { ok: false, status: 400, error: "Invalid starts_at." };
  }
  const now = input.now ?? new Date();
  if (start.getTime() < now.getTime() - 2 * 60_000) {
    return { ok: false, status: 400, error: "That time has already passed." };
  }
  const max =
    now.getTime() + DIRECT_BOOKING_MAX_AHEAD_DAYS * 24 * 60 * 60 * 1000;
  if (start.getTime() > max) {
    return {
      ok: false,
      status: 400,
      error: "Pick a time within the next 6 months.",
    };
  }
  const end = new Date(start.getTime() + input.durationMinutes * 60_000);
  return { ok: true, start, end };
}

export function directSlotConflicts(input: {
  start: Date;
  end: Date;
  existing: ExistingBookingInterval[];
  bufferMinutes: number;
}): boolean {
  return intervalsOverlapWithBuffer(
    input.start.getTime(),
    input.end.getTime(),
    input.existing,
    input.bufferMinutes
  );
}
