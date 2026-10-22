"use client";

import { useEffect } from "react";

/** Counts one open per visit. Skipped for the coach's own preview. */
export function ProposalOpenBeacon({ token }: { token: string }) {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("preview") === "1") return;
    const key = `proposal-open-${token}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      // Private mode: count it anyway.
    }
    void fetch(`/api/proposal/${token}/open`, { method: "POST", keepalive: true }).catch(() => undefined);
  }, [token]);
  return null;
}
