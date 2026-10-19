"use client";

import { useCallback, useEffect, useState } from "react";
import type { LinkedInHistoryPayload } from "@/lib/linkedinHistory/loadHistory";

type Headers = () => Promise<Record<string, string> | null>;

/**
 * A coach's imported LinkedIn posts, newsletter issues and BCA's drafts.
 * `getHeaders` decides whose: the signed-in coach, or a coach an admin passes
 * with x-impersonate-coach-id.
 */
export function useLinkedInHistory(getHeaders: Headers) {
  const [data, setData] = useState<LinkedInHistoryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const headers = await getHeaders();
      if (!headers) throw new Error("Please sign in again.");
      const res = await fetch("/api/linkedin/history", { headers });
      const body = (await res.json().catch(() => null)) as (LinkedInHistoryPayload & { error?: string }) | null;
      if (!res.ok || !body) throw new Error(body?.error || "Could not load LinkedIn history.");
      setData(body);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load LinkedIn history.");
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const runImport = useCallback(async (): Promise<string | null> => {
    setImporting(true);
    try {
      const headers = await getHeaders();
      if (!headers) throw new Error("Please sign in again.");
      const res = await fetch("/api/linkedin/history/import", { method: "POST", headers });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Import failed.");
      await reload();
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Import failed.";
    } finally {
      setImporting(false);
    }
  }, [getHeaders, reload]);

  return { data, loading, error, importing, reload, runImport };
}

export function daysAgoLabel(days: number | null): string {
  if (days == null) return "never";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 60) return `${days} days ago`;
  return `${Math.round(days / 30)} months ago`;
}
