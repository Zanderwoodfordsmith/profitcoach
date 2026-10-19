"use client";

import { useSyncExternalStore } from "react";

/**
 * A page that has Ava built in (the Blueprint, with her beside the document)
 * registers here. While it does, the top-bar Ava button opens the page's own
 * Ava instead of the app-wide panel, so there is never a second Ava on top.
 */

export type AvaPageHost = { open: boolean; toggle: () => void };

let host: AvaPageHost | null = null;
const listeners = new Set<() => void>();

export function setAvaPageHost(next: AvaPageHost | null): void {
  host = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAvaPageHost(): AvaPageHost | null {
  return useSyncExternalStore(
    subscribe,
    () => host,
    () => null
  );
}
