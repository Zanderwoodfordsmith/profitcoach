"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

type TrackEventType = "page_view" | "heartbeat";

const HEARTBEAT_MS = 60_000;

export function UsageTracker() {
  const pathname = usePathname();
  const sessionIdRef = useRef<string | null>(null);
  const latestPathRef = useRef<string>("/");

  async function sendUsageEvent(eventType: TrackEventType, path: string) {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    const token = session?.access_token;
    if (!token) return;

    const response = await fetch("/api/usage/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        sessionId: sessionIdRef.current,
        eventType,
        path,
      }),
      keepalive: true,
    });

    if (!response.ok) return;
    const body = (await response.json().catch(() => ({}))) as {
      sessionId?: string;
    };
    if (body.sessionId) {
      sessionIdRef.current = body.sessionId;
    }
  }

  useEffect(() => {
    const currentPath = pathname || "/";
    latestPathRef.current = currentPath;
    void sendUsageEvent("page_view", currentPath);
  }, [pathname]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      void sendUsageEvent("heartbeat", latestPathRef.current);
    }, HEARTBEAT_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
