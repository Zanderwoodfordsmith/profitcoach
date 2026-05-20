"use client";

export const WINS_QUEUE_DISMISSED_SESSION_KEY =
  "community:admin:winsQueue:sessionDismissed";

export function isWinsQueueDismissedThisSession(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(WINS_QUEUE_DISMISSED_SESSION_KEY) === "1";
}

export function dismissWinsQueueForSession(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(WINS_QUEUE_DISMISSED_SESSION_KEY, "1");
}

/** Fresh login / new tab should be allowed to show the queue again. */
export function clearWinsQueueSessionDismiss(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(WINS_QUEUE_DISMISSED_SESSION_KEY);
}
