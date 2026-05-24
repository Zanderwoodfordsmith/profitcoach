"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

export function useCoachClientHubAccess(impersonatingCoachId: string | null) {
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setAllowed(false);
      setLoading(false);
      return;
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (impersonatingCoachId) {
      headers["x-impersonate-coach-id"] = impersonatingCoachId;
    }

    const res = await fetch("/api/coach/client-hub-access", { headers });
    const body = (await res.json().catch(() => ({}))) as { allowed?: boolean };
    setAllowed(Boolean(res.ok && body.allowed));
    setLoading(false);
  }, [impersonatingCoachId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { allowed, loading, refresh };
}
