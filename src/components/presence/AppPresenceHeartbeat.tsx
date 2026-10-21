"use client";

import { useEffect } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { getSessionUser } from "@/lib/supabaseAccessToken";

const HEARTBEAT_MS = 60_000;

/**
 * Marks the signed-in member as online while any app page is open and visible.
 * Writes the auth user's own row (the table only allows that), so an admin
 * using the app as a coach never makes that coach look online.
 */
export function AppPresenceHeartbeat() {
  useEffect(() => {
    let stopped = false;
    const touch = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      const user = await getSessionUser();
      if (!user || stopped) return;
      await supabaseClient
        .from("community_presence")
        .upsert({ user_id: user.id, last_seen_at: new Date().toISOString() }, { onConflict: "user_id" });
    };
    const onVisible = () => void touch();
    void touch();
    const id = window.setInterval(() => void touch(), HEARTBEAT_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
