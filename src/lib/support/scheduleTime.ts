/** Matches the messaging inbox: don't schedule into the past minute. */
export const SUPPORT_SCHEDULE_MIN_LEAD_MS = 60_000;

/**
 * A schedule time at least a minute ahead, or throws. Kept apart from
 * scheduledReplies (server cron code) so the reply composer can use it.
 */
export function assertFutureSchedule(iso: string, now = Date.now()): Date {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) {
    throw new Error("Invalid schedule time.");
  }
  if (when.getTime() < now + SUPPORT_SCHEDULE_MIN_LEAD_MS) {
    throw new Error("Schedule at least one minute in the future.");
  }
  return when;
}
