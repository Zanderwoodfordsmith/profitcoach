"use client";

import { useEffect } from "react";

/** Opens the print dialog once the sheets and fonts have loaded, so "Save as PDF" is one step. */
export function PrintOnLoad() {
  useEffect(() => {
    let cancelled = false;
    const go = () => {
      if (!cancelled) window.setTimeout(() => window.print(), 300);
    };
    void document.fonts.ready.then(() => (document.readyState === "complete" ? go() : window.addEventListener("load", go, { once: true })));
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
