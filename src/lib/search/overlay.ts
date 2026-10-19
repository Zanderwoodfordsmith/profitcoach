"use client";

/** Fired by the top bar; the layout's SearchOverlay listens and opens. */
export const OPEN_SEARCH_EVENT = "pc-open-search";

export function openSearchOverlay(): void {
  window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
}
