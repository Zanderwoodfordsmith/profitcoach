"use client";

import { useEffect, useState, type ReactNode } from "react";

import { badgeClass, type BadgeTone } from "@/components/ui/Badge";
import type { CoachHealthRow, HealthLevel } from "@/lib/coachHealth";
import { supabaseClient } from "@/lib/supabaseClient";

const LEVEL_TONE: Record<HealthLevel, BadgeTone> = { red: "red", amber: "amber", green: "green" };
const LEVEL_LABEL: Record<HealthLevel, string> = { red: "Stuck", amber: "Needs help", green: "On track" };

/** Getting clients numbers per coach id, for the Coaches list (moved from the old Getting clients tab, 23 Nov). Active coaches only. */
export function useCoachHealth(enabled: boolean): Map<string, CoachHealthRow> {
  const [rows, setRows] = useState<Map<string, CoachHealthRow>>(new Map());
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch("/api/admin/coach-health", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = (await res.json().catch(() => null)) as { coaches?: CoachHealthRow[] } | null;
      if (cancelled || !res.ok || !body?.coaches) return;
      setRows(new Map(body.coaches.map((row) => [row.coach_id, row])));
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return rows;
}

export function CoachHealthStatus({ row }: { row: CoachHealthRow | undefined }) {
  if (!row) return <span className="text-slate-400">—</span>;
  return <span className={badgeClass(LEVEL_TONE[row.level])}>{LEVEL_LABEL[row.level]}</span>;
}

/** The first thing holding them back; the next step shows on hover. */
export function CoachHealthFixFirst({ row }: { row: CoachHealthRow | undefined }) {
  if (!row) return <span className="text-slate-400">—</span>;
  return (
    <span className="whitespace-nowrap text-slate-700" title={row.next_step}>
      {row.stuck_at}
    </span>
  );
}

const dash = "–";
const daysAgo = (d: number | null) => (d == null ? dash : d === 0 ? "today" : `${d}d ago`);

/** The number columns, in table order. Last 30 days unless the label says otherwise. */
export const COACH_HEALTH_NUMBER_COLUMNS = [
  { key: "invites", label: "Invites 7d / 30d", title: "LinkedIn invites sent in the last 7 and 30 days", value: (r) => `${r.invites_7d} / ${r.invites_30d}` },
  { key: "acceptRate", label: "Accepted", title: "Share of invites accepted, last 30 days", value: (r) => (r.accept_rate == null ? dash : `${Math.round(r.accept_rate * 100)}%`) },
  { key: "replies", label: "Replies", title: "Prospects who replied, last 30 days", value: (r) => r.replies_30d },
  { key: "interested", label: "Interested", title: "Prospects marked interested, last 30 days", value: (r) => r.interested_30d },
  {
    key: "calls",
    label: "Calls",
    title: "Prospect calls booked in the last 30 days, and how many came from a campaign",
    value: (r) => (
      <>
        {r.calls_30d}
        {r.campaign_calls_30d ? <span className="text-slate-500"> ({r.campaign_calls_30d} from campaigns)</span> : null}
      </>
    ),
  },
  { key: "firstCall", label: "First call", title: "Days from joining (Stripe start, or first payment) to the first prospect call", value: (r) => (r.days_to_first_call == null ? dash : `${r.days_to_first_call}d`) },
  { key: "firstClient", label: "First client", title: "Days from joining to the first client (marked client, or first coaching session)", value: (r) => (r.days_to_first_client == null ? dash : `${r.days_to_first_client}d`) },
  {
    key: "replyTime",
    label: "Reply time",
    title: "How long they usually take to reply to a prospect, last 30 days",
    value: (r) => (r.median_reply_hours == null ? dash : r.median_reply_hours < 1 ? "< 1h" : `${Math.round(r.median_reply_hours)}h`),
  },
  { key: "posts", label: "Posts 30d", title: "LinkedIn posts in the last 30 days, from their imported history", value: (r) => r.posts_30d ?? dash },
  { key: "lastPost", label: "Last post", title: "Their last LinkedIn post, from their imported history", value: (r) => daysAgo(r.last_post_days) },
  { key: "newsletters", label: "Newsletters 90d", title: "Newsletter issues in the last 90 days", value: (r) => r.issues_90d ?? dash },
  { key: "ssi", label: "SSI", title: "Their LinkedIn Social Selling Index, out of 100. It loads when they connect LinkedIn and updates when they open it in the app. Needs Sales Navigator.", value: (r) => (r.ssi == null ? dash : Math.round(Number(r.ssi))) },
] as const satisfies ReadonlyArray<{ key: string; label: string; title: string; value: (r: CoachHealthRow) => ReactNode }>;

export type CoachHealthNumberKey = (typeof COACH_HEALTH_NUMBER_COLUMNS)[number]["key"];

const NUMBER_COLUMN_BY_KEY = new Map<string, (typeof COACH_HEALTH_NUMBER_COLUMNS)[number]>(
  COACH_HEALTH_NUMBER_COLUMNS.map((col) => [col.key, col])
);

export function isCoachHealthNumberKey(key: string): key is CoachHealthNumberKey {
  return NUMBER_COLUMN_BY_KEY.has(key);
}

export function CoachHealthNumberHeader({ columnKey }: { columnKey: CoachHealthNumberKey }) {
  const col = NUMBER_COLUMN_BY_KEY.get(columnKey)!;
  return (
    <th className="sticky top-0 z-10 whitespace-nowrap bg-slate-50 px-2 py-2" title={col.title}>
      {col.label}
    </th>
  );
}

export function CoachHealthNumberCell({ columnKey, row }: { columnKey: CoachHealthNumberKey; row: CoachHealthRow | undefined }) {
  const col = NUMBER_COLUMN_BY_KEY.get(columnKey)!;
  return (
    <td className="whitespace-nowrap px-2 py-2 align-middle text-xs tabular-nums text-slate-700">
      {row ? col.value(row) : <span className="text-slate-400">—</span>}
    </td>
  );
}
