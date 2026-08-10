"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatDayLabel, formatShortTime } from "@/lib/formatShortDate";
import { getValidSupabaseAccessToken } from "@/lib/supabaseAccessToken";

type MessageRow = {
  id: string;
  conversation_id?: string;
  channel: string;
  direction: string;
  status: string;
  subject: string | null;
  body_text: string | null;
  from_address: string | null;
  to_address: string | null;
  provider_error: string | null;
  created_at: string;
};

type ActivityEvent = {
  id: string;
  type: string;
  at: string;
  title: string;
  detail?: string | null;
  href?: string | null;
};

type ConversationRow = {
  id: string;
  subject: string | null;
};

type FeedItem =
  | { kind: "message"; at: string; message: MessageRow }
  | { kind: "activity"; at: string; activity: ActivityEvent };

function previewText(body: string | null | undefined, max = 96): string {
  const compact = (body || "").replace(/\s+/g, " ").trim();
  if (!compact) return "";
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max).trimEnd()}…`;
}

function activityGlyph(type: string): string {
  switch (type) {
    case "boss_score_completed":
    case "boss_pro_completed":
    case "assessment_started":
      return "◎";
    case "call_booked":
      return "◷";
    case "form_filled":
      return "▣";
    case "prospect_created":
      return "✦";
    default:
      return "•";
  }
}

type Props = {
  contactId: string;
  conversationsHref: string;
  isAdmin?: boolean;
  impersonateCoachId?: string | null;
};

export function ProspectActivityFeed({
  contactId,
  conversationsHref,
  isAdmin = false,
  impersonateCoachId = null,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getValidSupabaseAccessToken();
      if (!token) {
        setError("Sign in again, then retry.");
        return;
      }
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };
      if (!isAdmin && impersonateCoachId) {
        headers["x-impersonate-coach-id"] = impersonateCoachId;
      }
      const res = await fetch(
        `/api/messaging/contacts/${encodeURIComponent(contactId)}/feed`,
        { headers, cache: "no-store" }
      );
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        messages?: MessageRow[];
        activity?: ActivityEvent[];
        conversations?: ConversationRow[];
      };
      if (!res.ok) {
        setError(body.error || `Failed to load (${res.status}).`);
        setMessages([]);
        setActivity([]);
        setConversations([]);
        return;
      }
      const list = Array.isArray(body.messages) ? body.messages : [];
      setMessages(list);
      setActivity(Array.isArray(body.activity) ? body.activity : []);
      setConversations(
        Array.isArray(body.conversations) ? body.conversations : []
      );
      const newest = list[list.length - 1];
      setExpandedIds(newest ? new Set([newest.id]) : new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed.");
    } finally {
      setLoading(false);
    }
  }, [contactId, impersonateCoachId, isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const feedByDay = useMemo(() => {
    const items: FeedItem[] = [
      ...messages.map(
        (message): FeedItem => ({
          kind: "message",
          at: message.created_at,
          message,
        })
      ),
      ...activity.map(
        (event): FeedItem => ({
          kind: "activity",
          at: event.at,
          activity: event,
        })
      ),
    ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    const groups: { label: string; items: FeedItem[] }[] = [];
    for (const item of items) {
      const label = formatDayLabel(item.at);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(item);
      else groups.push({ label, items: [item] });
    }
    return groups;
  }, [messages, activity]);

  const primaryConversationId = conversations[0]?.id ?? null;

  return (
    <div className="flex h-full min-h-[28rem] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Activity & conversations
          </h2>
          <p className="text-[11px] text-slate-500">
            Messages, assessments, bookings, and form activity
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="text-xs font-medium text-slate-500 hover:text-slate-800"
            disabled={loading}
          >
            {loading ? "…" : "Refresh"}
          </button>
          <Link
            href={
              primaryConversationId
                ? `${conversationsHref}?c=${encodeURIComponent(primaryConversationId)}`
                : conversationsHref
            }
            className="rounded-md bg-sky-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-sky-700"
          >
            Open inbox
          </Link>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto bg-[#f7f8fa] px-3 py-4 sm:px-4">
        {loading ? (
          <p className="text-sm text-slate-500">Loading timeline…</p>
        ) : error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : feedByDay.length === 0 ? (
          <p className="text-sm text-slate-500">
            No activity yet for this prospect.
          </p>
        ) : (
          feedByDay.map((group) => (
            <div key={group.label} className="space-y-2.5">
              <div className="flex justify-center py-1">
                <span className="rounded-full bg-white/90 px-3 py-0.5 text-[11px] font-medium text-slate-500 shadow-sm ring-1 ring-slate-200/80">
                  {group.label}
                </span>
              </div>
              {group.items.map((item) => {
                if (item.kind === "activity") {
                  const a = item.activity;
                  const row = (
                    <>
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200/80 text-[10px] font-semibold text-slate-600">
                        {activityGlyph(a.type)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="font-medium text-slate-700">
                          {a.title}
                        </span>
                        {a.detail ? (
                          <span className="text-slate-500"> · {a.detail}</span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-[10px] tabular-nums text-slate-400">
                        {formatShortTime(a.at)}
                      </span>
                    </>
                  );
                  return (
                    <div key={a.id} className="flex justify-center">
                      {a.href ? (
                        <a
                          href={a.href}
                          target={
                            a.href.startsWith("http") ? "_blank" : undefined
                          }
                          rel={
                            a.href.startsWith("http") ? "noreferrer" : undefined
                          }
                          className="flex w-full max-w-[min(88%,40rem)] items-center gap-2 rounded-lg border border-slate-200/80 bg-white/70 px-3 py-2 text-left text-xs text-slate-600 shadow-sm hover:border-sky-200 hover:bg-white"
                        >
                          {row}
                        </a>
                      ) : (
                        <div className="flex w-full max-w-[min(88%,40rem)] items-center gap-2 rounded-lg border border-slate-200/80 bg-white/70 px-3 py-2 text-xs text-slate-600 shadow-sm">
                          {row}
                        </div>
                      )}
                    </div>
                  );
                }

                const m = item.message;
                const open = expandedIds.has(m.id);
                const outbound = m.direction === "outbound";
                const isComment = m.channel === "system";
                const body = (m.body_text || "").trim() || "(empty)";
                const subject = m.subject?.trim();
                const failed =
                  m.status === "failed" || Boolean(m.provider_error);

                if (isComment) {
                  return (
                    <div key={m.id} className="flex justify-center">
                      <div className="w-full max-w-[min(88%,40rem)] rounded-xl border border-dashed border-amber-200 bg-amber-50/80 px-3.5 py-2.5 text-sm text-amber-950">
                        <div className="mb-1 text-[11px] font-medium text-amber-700">
                          Internal note · {formatShortTime(m.created_at)}
                        </div>
                        <div className="whitespace-pre-wrap">{body}</div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={m.id}
                    className={`flex ${outbound ? "justify-end" : "justify-start"}`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(m.id)) next.delete(m.id);
                          else next.add(m.id);
                          return next;
                        })
                      }
                      className={`w-full max-w-[min(84%,36rem)] rounded-2xl px-3.5 py-2.5 text-left text-sm shadow-sm ring-1 ${
                        outbound
                          ? failed
                            ? "rounded-br-md bg-sky-50 ring-amber-300/80"
                            : "rounded-br-md bg-sky-100/90 ring-sky-200/70"
                          : failed
                            ? "rounded-bl-md bg-white ring-amber-300/80"
                            : "rounded-bl-md bg-white ring-slate-200/80"
                      }`}
                    >
                      <div className="mb-1 flex items-center gap-2 text-[11px] text-slate-500">
                        <span className="uppercase tracking-wide">
                          {m.channel}
                        </span>
                        <span>{outbound ? "Sent" : "Received"}</span>
                        <span className="ml-auto tabular-nums">
                          {formatShortTime(m.created_at)}
                        </span>
                      </div>
                      {subject ? (
                        <div className="mb-1 truncate text-xs font-semibold text-slate-800">
                          {subject}
                        </div>
                      ) : null}
                      <div className="whitespace-pre-wrap leading-relaxed text-slate-800">
                        {open ? body : previewText(body, 180)}
                      </div>
                      {!open && body.length > 180 ? (
                        <div className="mt-1 text-[11px] font-medium text-sky-700">
                          Show more
                        </div>
                      ) : null}
                      {failed && m.provider_error ? (
                        <div
                          className="mt-1.5 truncate text-[11px] text-amber-700"
                          title={m.provider_error}
                        >
                          Delivery issue
                        </div>
                      ) : null}
                    </button>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
