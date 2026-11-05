"use client";

import { useSyncExternalStore } from "react";

import type { AgentShow } from "@/lib/agent/types";

/**
 * What the page under Ava tells her (4 Nov: one Ava, opened from the top bar,
 * everywhere, the Blueprint included). The Blueprint registers here: which
 * page is open, whose Blueprint it is, its starter buttons, and how to
 * reload or move the document when she writes or shows a section. Pages can
 * also ask Ava to open, and BCA's waiting work is drawn into a slot in her
 * panel (a portal, so it keeps the Blueprint's data).
 */

export type AvaPageStarter = {
  key: string;
  label: string;
  primary?: boolean;
  /** Sent to Ava as if typed. */
  prompt?: string;
  /** Or start the voice call on the page instead. */
  call?: boolean;
};

export type AvaPageContext = {
  /** The path Ava is told is open, e.g. /coach/blueprint/linkedin. */
  screenPath: string;
  /** Whose Blueprint it is. For BCA, Ava works on this coach. */
  coach: { id: string; name: string } | null;
  /** BCA looking at a coach's page: Ava's panel holds the slot for waiting work. */
  bcaWork: boolean;
  starters: AvaPageStarter[];
  greeting: string;
  intro: string;
};

export type AvaPageHandlers = {
  /** Ava saved something: reload what the page shows. */
  onWrote?: () => void;
  /** Ava pointed at a page or section: move the document there. */
  onShow?: (show: AgentShow) => void;
  /** The "Start the call" button: the page opens the voice call. */
  onCall?: () => void;
};

type Store<T> = { value: T; listeners: Set<() => void> };

function store<T>(value: T): Store<T> {
  return { value, listeners: new Set() };
}
function set<T>(s: Store<T>, value: T) {
  s.value = value;
  s.listeners.forEach((listener) => listener());
}
function use<T>(s: Store<T>, server: T): T {
  return useSyncExternalStore(
    (listener) => {
      s.listeners.add(listener);
      return () => {
        s.listeners.delete(listener);
      };
    },
    () => s.value,
    () => server
  );
}

const context = store<AvaPageContext | null>(null);
const openNonce = store(0);
const turns = store(0);
const workSlot = store<HTMLElement | null>(null);
let handlers: AvaPageHandlers = {};

export function setAvaPageContext(next: AvaPageContext | null): void {
  set(context, next);
}
export function useAvaPageContext(): AvaPageContext | null {
  return use(context, null);
}

/** Read when they're needed, so a new function each render never re-renders Ava. */
export function setAvaPageHandlers(next: AvaPageHandlers): void {
  handlers = next;
}
export function avaPageHandlers(): AvaPageHandlers {
  return handlers;
}

/** A page's "Ask Ava": the layout opens her panel. */
export function requestAvaOpen(): void {
  set(openNonce, openNonce.value + 1);
}
export function useAvaOpenRequests(): number {
  return use(openNonce, 0);
}

/** Ava finished a turn: what's waiting for BCA may have changed. */
export function bumpAvaTurns(): void {
  set(turns, turns.value + 1);
}
export function useAvaTurns(): number {
  return use(turns, 0);
}

/** Ava's panel offers this element; the Blueprint draws BCA's waiting work into it. */
export function setAvaWorkSlot(el: HTMLElement | null): void {
  if (workSlot.value !== el) set(workSlot, el);
}
export function useAvaWorkSlot(): HTMLElement | null {
  return use(workSlot, null);
}

/** The last page before Ava's own page, so "Move to the side" goes back there with her open. */
let returnPath: string | null = null;
export function rememberAvaReturn(path: string): void {
  returnPath = path;
}
export function avaReturnPath(): string | null {
  return returnPath;
}
