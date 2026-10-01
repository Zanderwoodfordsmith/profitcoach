"use client";

import { useEffect, useState } from "react";

import { supabaseClient } from "@/lib/supabaseClient";

/**
 * Whether a signed-in coach (not an admin) has the AI Agent switched on.
 * Admins always have it inside the full AI panel, so they skip this check.
 */
export function useCoachAgentAccess(check: boolean): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!check) {
      setEnabled(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch("/api/agent/status", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).catch(() => null);
      const body = res?.ok
        ? ((await res.json().catch(() => null)) as { enabled?: boolean } | null)
        : null;
      if (!cancelled) setEnabled(body?.enabled === true);
    })();
    return () => {
      cancelled = true;
    };
  }, [check]);

  return enabled;
}
