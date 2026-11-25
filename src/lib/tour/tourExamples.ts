"use client";

import { useEffect, useState } from "react";

/**
 * While a page tour runs, empty pages show example rows so the tour has
 * something to point at. Examples are never saved and can't be acted on.
 * Set and cleared by the section guide (components/layout/SectionTour).
 */
const KEY = "bca.sectionTour.examples";
const EVENT = "bca:tour-examples";

export function setTourExamples(on: boolean) {
  try {
    if (on) window.sessionStorage.setItem(KEY, "1");
    else window.sessionStorage.removeItem(KEY);
  } catch {
    // Storage blocked: the event below still reaches this page.
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: on }));
}

export function useTourExamples(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    try {
      setOn(window.sessionStorage.getItem(KEY) === "1");
    } catch {
      setOn(false);
    }
    const onChange = (e: Event) => setOn(Boolean((e as CustomEvent<boolean>).detail));
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return on;
}
