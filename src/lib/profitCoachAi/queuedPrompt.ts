"use client";

import { useEffect, useRef } from "react";

const QUEUED_PROMPT_EVENT = "pc-ai-queued-prompt";

let queued: string | null = null;

/**
 * Hand text to the AI panel's composer (e.g. "Ask AI" on the search page).
 * Whichever composer is on screen picks it up, now or when it next mounts.
 */
export function queueAiPrompt(text: string): void {
  queued = text;
  window.dispatchEvent(new Event(QUEUED_PROMPT_EVENT));
}

/** Take queued text into this composer while it is the one on screen. */
export function useQueuedAiPrompt(
  onPrompt: (text: string) => void,
  enabled = true
): void {
  const handlerRef = useRef(onPrompt);
  useEffect(() => {
    handlerRef.current = onPrompt;
  });

  useEffect(() => {
    if (!enabled) return;
    const take = () => {
      const text = queued;
      if (!text) return;
      queued = null;
      handlerRef.current(text);
    };
    take();
    window.addEventListener(QUEUED_PROMPT_EVENT, take);
    return () => window.removeEventListener(QUEUED_PROMPT_EVENT, take);
  }, [enabled]);
}
