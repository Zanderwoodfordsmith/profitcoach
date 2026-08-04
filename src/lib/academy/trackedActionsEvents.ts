/** Browser event so the lesson Action items panel refreshes after community activity. */

export const ACADEMY_TRACKED_ACTIONS_CHANGED = "academy-tracked-actions-changed";

export function notifyAcademyTrackedActionsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ACADEMY_TRACKED_ACTIONS_CHANGED));
}
