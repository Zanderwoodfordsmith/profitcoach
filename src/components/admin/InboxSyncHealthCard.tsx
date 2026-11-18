"use client";

import { useEffect, useState } from "react";
import { cardClass } from "@/components/ui/Card";
import { getValidSupabaseAccessToken } from "@/lib/supabaseAccessToken";

type StaleRow = {
  accountId: string;
  coachName: string;
  provider: string;
  account: string | null;
  lastFinishedAt: string | null;
  lastError: string | null;
  pausedUntil: string | null;
};

type Health = {
  connected: number;
  stale: StaleRow[];
  last24h: {
    runs: number;
    outcomes: Record<string, number>;
    slowestMs: number;
  };
};

function providerLabel(provider: string): string {
  const p = provider.toUpperCase();
  if (p === "LINKEDIN") return "LinkedIn";
  if (p === "GOOGLE" || p === "GOOGLE_OAUTH") return "Gmail";
  if (p === "OUTLOOK" || p === "MICROSOFT") return "Outlook";
  if (p === "WHATSAPP") return "WhatsApp";
  if (p === "INSTAGRAM") return "Instagram";
  if (p === "MESSENGER") return "Messenger";
  return provider;
}

function ago(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/** Admin → Links: connected inboxes that have not finished a sync in 3 hours. */
export function InboxSyncHealthCard() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await getValidSupabaseAccessToken();
      if (!token) return;
      const res = await fetch("/api/admin/inbox-sync-health", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json().catch(() => ({}))) as Health & {
        error?: string;
      };
      if (cancelled) return;
      if (!res.ok) {
        setError(body.error || "Could not load inbox sync health.");
        return;
      }
      setHealth(body);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const outcomes = health?.last24h.outcomes ?? {};
  const finished = outcomes.done ?? 0;
  const carriedOn = outcomes.more ?? 0;
  const failed = outcomes.error ?? 0;
  const paused = outcomes.backoff ?? 0;
  const reconnect = outcomes.reconnect ?? 0;

  return (
    <div className={cardClass("plain")}>
      <h2 className="border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Inbox sync
      </h2>
      <div className="flex flex-col gap-3 px-4 py-3 text-sm">
        {error ? <p className="text-rose-600">{error}</p> : null}
        {!health && !error ? (
          <p className="text-slate-500">Loading…</p>
        ) : null}
        {health ? (
          <>
            <p className="text-slate-600">
              Last 24 hours: {health.last24h.runs} syncs · {finished} finished ·{" "}
              {carriedOn} carried on · {failed} failed · {paused} paused ·{" "}
              {reconnect} need reconnecting · slowest{" "}
              {Math.round(health.last24h.slowestMs / 1000)}s
            </p>
            {health.stale.length === 0 ? (
              <p className="font-medium text-emerald-700">
                All {health.connected} connected channels finished a sync in
                the last 3 hours.
              </p>
            ) : (
              <>
                <p className="font-medium text-rose-600">
                  {health.stale.length} of {health.connected} connected
                  channels have not finished a sync in 3 hours.
                </p>
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                  {health.stale.map((row) => (
                    <li
                      key={row.accountId}
                      className="flex flex-col gap-0.5 px-3 py-2"
                    >
                      <span className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-slate-900">
                          {row.coachName} · {providerLabel(row.provider)}
                        </span>
                        <span className="text-xs text-slate-500">
                          Last finished {ago(row.lastFinishedAt)}
                        </span>
                      </span>
                      {row.pausedUntil ? (
                        <span className="text-xs text-slate-500">
                          Paused: the provider asked us to slow down.
                        </span>
                      ) : null}
                      {row.lastError ? (
                        <span className="truncate text-xs text-slate-500" title={row.lastError}>
                          {row.lastError}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
