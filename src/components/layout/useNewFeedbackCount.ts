"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

export const FEEDBACK_COUNTS_CHANGED = "pc-feedback-counts-changed";
export const SUPPORT_COUNTS_CHANGED = FEEDBACK_COUNTS_CHANGED;
export const COACH_SUPPORT_READ_CHANGED = "pc-coach-support-read-changed";

export function notifySupportCountsChanged() {
  notifyFeedbackCountsChanged();
}

export function notifyCoachSupportReadChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(COACH_SUPPORT_READ_CHANGED));
}

export function notifyFeedbackCountsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(FEEDBACK_COUNTS_CHANGED));
}

export function useNewFeedbackCount(enabled: boolean) {
  const [count, setCount] = useState(0);

  const loadCount = useCallback(async () => {
    if (!enabled) {
      setCount(0);
      return;
    }

    const { count: nextCount, error } = await supabaseClient
      .from("community_feedback_reports")
      .select("*", { count: "exact", head: true })
      .eq("status", "new");

    if (error) {
      setCount(0);
      return;
    }

    setCount(nextCount ?? 0);
  }, [enabled]);

  useEffect(() => {
    void loadCount();
  }, [loadCount]);

  useEffect(() => {
    if (!enabled) return;

    const onRefresh = () => void loadCount();
    window.addEventListener("focus", onRefresh);
    window.addEventListener(FEEDBACK_COUNTS_CHANGED, onRefresh);
    return () => {
      window.removeEventListener("focus", onRefresh);
      window.removeEventListener(FEEDBACK_COUNTS_CHANGED, onRefresh);
    };
  }, [enabled, loadCount]);

  return count;
}

export function useCoachUnreadSupportCount(enabled: boolean) {
  const [count, setCount] = useState(0);

  const loadCount = useCallback(async () => {
    if (!enabled) {
      setCount(0);
      return;
    }

    const { data, error } = await supabaseClient.rpc(
      "coach_unread_support_reply_count"
    );

    if (error) {
      setCount(0);
      return;
    }

    setCount(typeof data === "number" ? data : Number(data ?? 0));
  }, [enabled]);

  useEffect(() => {
    void loadCount();
  }, [loadCount]);

  useEffect(() => {
    if (!enabled) return;

    const onRefresh = () => void loadCount();
    window.addEventListener("focus", onRefresh);
    window.addEventListener(COACH_SUPPORT_READ_CHANGED, onRefresh);
    window.addEventListener(FEEDBACK_COUNTS_CHANGED, onRefresh);
    return () => {
      window.removeEventListener("focus", onRefresh);
      window.removeEventListener(COACH_SUPPORT_READ_CHANGED, onRefresh);
      window.removeEventListener(FEEDBACK_COUNTS_CHANGED, onRefresh);
    };
  }, [enabled, loadCount]);

  return count;
}
