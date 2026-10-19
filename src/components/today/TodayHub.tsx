"use client";

import { useCallback, useEffect, useState } from "react";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import { LinkedInSolidIcon } from "@/components/icons/LinkedInSolidIcon";
import { ConnectGate, LINKEDIN_CONNECT_DETAILS } from "@/components/ui/ConnectGate";
import { AvaRepliesCard } from "@/components/today/AvaRepliesCard";

type HabitDay = { day: string; posts: number; comments: number; conversations: number; postsLogged: number };
type Signal = {
  id: string;
  kind: "post_comment" | "post_reaction" | "invite_received";
  name: string | null;
  headline: string | null;
  profile_url: string | null;
  context: string | null;
  signal_at: string | null;
  opener: string | null;
};
type TodayData = {
  targets: { posts: number; comments: number; conversations: number };
  habit: { today: string; days: HabitDay[] };
  signals: Signal[];
  refreshError: string | null;
  linkedInConnected?: boolean;
};

const KIND_LABEL: Record<Signal["kind"], string> = {
  post_comment: "Commented on your post",
  post_reaction: "Reacted to your post",
  invite_received: "Sent you a connection request",
};

/** Shown blurred under the connect card, so the section has a shape. */
const SAMPLE_SIGNALS: Signal[] = [
  {
    id: "sample-1",
    kind: "post_comment",
    name: "Sarah Mitchell",
    headline: "Owner, Mitchell & Co Accountants",
    profile_url: null,
    context: "Pricing is the lever most owners never pull.",
    signal_at: null,
    opener: "Thanks for the comment, Sarah. Is pricing on your list this year?",
  },
  {
    id: "sample-2",
    kind: "invite_received",
    name: "James Okafor",
    headline: "Managing Director, Okafor Build",
    profile_url: null,
    context: "Loved your post on cash flow.",
    signal_at: null,
    opener: "Good to connect, James. What made the cash flow post land?",
  },
];

function weekday(day: string) {
  return new Date(`${day}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short" });
}

export function TodayHub() {
  const { impersonatingCoachId } = useImpersonation();
  const [data, setData] = useState<TodayData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const load = useCallback(
    async (refresh = false) => {
      const headers = await getCoachAuthHeaders(impersonatingCoachId);
      if (!headers) {
        setError("Sign in again to load Today.");
        return;
      }
      const res = await fetch(`/api/coach/today${refresh ? "?refresh=force" : ""}`, { headers });
      const body = (await res.json().catch(() => null)) as (TodayData & { error?: string }) | null;
      if (!res.ok || !body?.habit) setError(body?.error ?? "Could not load Today.");
      else {
        setError(body.refreshError);
        setData(body);
      }
      setRefreshing(false);
    },
    [impersonatingCoachId]
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const headers = await getCoachAuthHeaders(impersonatingCoachId);
      if (!headers || cancelled) return;
      // Paint what we have straight away, then check LinkedIn for new signals
      // (the server skips that if it checked in the last 15 minutes).
      const res = await fetch("/api/coach/today", { headers });
      const body = (await res.json().catch(() => null)) as (TodayData & { error?: string }) | null;
      if (cancelled) return;
      if (!res.ok || !body?.habit) {
        setError(body?.error ?? "Could not load Today.");
        return;
      }
      setData(body);
      setRefreshing(true);
      const fresh = await fetch("/api/coach/today?refresh=1", { headers });
      const freshBody = (await fresh.json().catch(() => null)) as (TodayData & { error?: string }) | null;
      if (cancelled) return;
      setRefreshing(false);
      if (fresh.ok && freshBody?.habit) {
        setError(freshBody.refreshError);
        setData(freshBody);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [impersonatingCoachId]);

  const patch = async (payload: Record<string, unknown>) => {
    const headers = await getCoachAuthHeaders(impersonatingCoachId);
    if (!headers) return false;
    const res = await fetch("/api/coach/today", { method: "PATCH", headers, body: JSON.stringify(payload) });
    return res.ok;
  };

  const logHabit = async (field: "comments" | "posts", delta: number) => {
    if (await patch({ log: field, delta })) void load();
  };

  const markSignal = async (signal: Signal, status: "messaged" | "dismissed") => {
    if (await patch({ signalId: signal.id, status })) {
      setData((d) => (d ? { ...d, signals: d.signals.filter((s) => s.id !== signal.id) } : d));
      if (status === "messaged") void load();
    }
  };

  const copy = async (signal: Signal) => {
    try {
      await navigator.clipboard.writeText(signal.opener || "");
      setCopied(signal.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  };

  const connectLinkedIn = async () => {
    setConnecting(true);
    try {
      const headers = await getCoachAuthHeaders(impersonatingCoachId);
      if (!headers) throw new Error("Sign in again to connect LinkedIn.");
      const res = await fetch("/api/coach/linkedin-outreach/accounts", {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !body.url) throw new Error(body.error || "Could not start LinkedIn connect.");
      window.location.assign(body.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start LinkedIn connect.");
      setConnecting(false);
    }
  };

  const linkedInLocked = data?.linkedInConnected === false;
  const today = data?.habit.days.find((d) => d.day === data.habit.today);
  const t = data?.targets;

  return (
    <div className="space-y-8">
      <AvaRepliesCard />
      <section>
        <h2 className="text-lg font-semibold text-slate-900">Your daily 1-10-10</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Every weekday: 1 post, 10 comments on other people&apos;s posts, 10 real conversations. Coaches who keep this up
          for months are the ones whose diaries fill. Conversations count when you reply to someone or message a person
          below. Automated campaign messages don&apos;t count.
        </p>
        {today && t ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {(
              [
                ["Post", today.posts, t.posts, "posts"],
                ["Comments", today.comments, t.comments, "comments"],
                ["Conversations", today.conversations, t.conversations, null],
              ] as const
            ).map(([label, value, target, field]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium text-slate-700">{label}</span>
                  <span className={`text-xl font-semibold tabular-nums ${value >= target ? "text-emerald-700" : "text-slate-900"}`}>
                    {value}/{target}
                  </span>
                </div>
                <div className="mt-2 h-1.5 rounded bg-slate-100">
                  <div className="h-1.5 rounded bg-sky-600" style={{ width: `${Math.min(100, (100 * value) / target)}%` }} />
                </div>
                {field ? (
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => logHabit(field, 1)} className="rounded border border-slate-300 px-2 py-1 text-sm">
                      +1
                    </button>
                    {field === "comments" ? (
                      <button type="button" onClick={() => logHabit(field, 5)} className="rounded border border-slate-300 px-2 py-1 text-sm">
                        +5
                      </button>
                    ) : null}
                    <button type="button" onClick={() => logHabit(field, -1)} className="rounded border border-slate-300 px-2 py-1 text-sm text-slate-500">
                      Undo
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
        {data ? (
          <div className="mt-4 overflow-x-auto">
            <table className="text-sm tabular-nums">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="pr-4 font-medium">This week</th>
                  {data.habit.days.map((d) => (
                    <th key={d.day} className="px-2 font-medium">
                      {weekday(d.day)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {(["posts", "comments", "conversations"] as const).map((k) => (
                  <tr key={k}>
                    <td className="pr-4 capitalize">{k}</td>
                    {data.habit.days.map((d) => (
                      <td key={d.day} className={`px-2 text-center ${d[k] >= data.targets[k] ? "text-emerald-700" : ""}`}>
                        {d[k]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">People showing interest</h2>
          {linkedInLocked ? null : (
          <button
            type="button"
            onClick={() => {
              setRefreshing(true);
              void load(true);
            }}
            disabled={refreshing}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {refreshing ? "Checking LinkedIn…" : "Check again"}
          </button>
          )}
        </div>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          They engaged with your posts or asked to connect in the last three weeks. These are the easiest conversations
          to start. Ask about the thing they did, then copy the opener, edit it and send it on LinkedIn yourself.
        </p>
        {/* Locked, the card below says it better than "Connect LinkedIn first". */}
        {error && !(linkedInLocked && error === data?.refreshError) ? (
          <p className="mt-3 text-sm text-amber-800">{error}</p>
        ) : null}
        {data && data.signals.length === 0 && !linkedInLocked ? (
          <p className="mt-4 text-sm text-slate-500">
            No one new yet. Posting every weekday is what creates these. Profile viewers aren&apos;t available here, so
            check those on LinkedIn.
          </p>
        ) : null}
        <ConnectGate
          locked={linkedInLocked}
          className="mt-4 rounded-2xl"
          icon={<LinkedInSolidIcon className="h-full w-full" />}
          title="Connect LinkedIn"
          description="See who comments on your posts, reacts, or sends you an invite, each with an opener ready to send."
          action={{
            label: "Connect LinkedIn",
            onClick: () => void connectLinkedIn(),
            busy: connecting,
            busyLabel: "Opening LinkedIn…",
          }}
          details={LINKEDIN_CONNECT_DETAILS}
        >
        <ul className={`space-y-3 ${linkedInLocked ? "" : "mt-4"}`}>
          {(linkedInLocked ? SAMPLE_SIGNALS : data?.signals ?? []).map((s) => (
            <li key={s.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{s.name || "Someone"}</p>
                  {s.headline ? <p className="truncate text-sm text-slate-500">{s.headline}</p> : null}
                </div>
                <span className="text-xs text-slate-500">
                  {KIND_LABEL[s.kind]}
                  {s.signal_at ? ` · ${new Date(s.signal_at).toLocaleDateString("en-GB")}` : ""}
                </span>
              </div>
              {s.context ? <p className="mt-2 text-sm text-slate-600">{s.kind === "invite_received" ? `Their note: ${s.context}` : `Post: ${s.context}`}</p> : null}
              {s.opener ? <p className="mt-2 rounded bg-slate-50 p-2 text-sm text-slate-800">{s.opener}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => copy(s)} className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white">
                  {copied === s.id ? "Copied" : "Copy opener"}
                </button>
                {s.profile_url ? (
                  <a href={s.profile_url} target="_blank" rel="noreferrer" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">
                    Open on LinkedIn
                  </a>
                ) : null}
                <button type="button" onClick={() => markSignal(s, "messaged")} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">
                  I messaged them
                </button>
                <button type="button" onClick={() => markSignal(s, "dismissed")} className="rounded-md px-3 py-1.5 text-sm text-slate-500">
                  Not a fit
                </button>
              </div>
            </li>
          ))}
        </ul>
        </ConnectGate>
      </section>
    </div>
  );
}
