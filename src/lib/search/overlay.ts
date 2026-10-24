"use client";

/** Fired by the top bar; the layout's SearchOverlay listens and opens. */
export const OPEN_SEARCH_EVENT = "pc-open-search";

export function openSearchOverlay(): void {
  window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
}

/** The missing page the next open is for; the overlay takes it when it opens. */
let pendingLostPath: string | null = null;

/** Opens search as the 404 helper for `path`. */
export function openLostSearch(path: string): void {
  pendingLostPath = path;
  openSearchOverlay();
}

export function takeLostSearchPath(): string | null {
  const path = pendingLostPath;
  pendingLostPath = null;
  return path;
}
