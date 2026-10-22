"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import type { Gaps } from "./slots";

/**
 * What the coach types into the scripts' [gaps], like the owner's name or a
 * day and time. Kept in this browser and shared by every script, so a name
 * typed in No-shows also fills Booking objections. Falls back to memory when
 * storage is blocked.
 */
const KEY = "scripts:gaps";
const listeners = new Set<() => void>();
let memory = "{}";

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
}

function write(next: Record<string, string>) {
  memory = JSON.stringify(next);
  try {
    localStorage.setItem(KEY, memory);
  } catch {
    /* memory keeps it for this visit */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function useGaps(): Gaps & { filled: number; clearAll: () => void } {
  const raw = useSyncExternalStore(subscribe, read, () => "{}");
  const values = useMemo<Record<string, string>>(() => {
    try {
      return JSON.parse(raw) as Record<string, string>;
    } catch {
      return {};
    }
  }, [raw]);
  const set = useCallback(
    (key: string, value: string) => {
      const next = { ...values };
      if (value) next[key] = value;
      else delete next[key];
      write(next);
    },
    [values],
  );
  const clearAll = useCallback(() => write({}), []);
  return { values, set, filled: Object.keys(values).length, clearAll };
}
