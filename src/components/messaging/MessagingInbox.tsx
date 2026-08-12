"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  formatDayLabel,
  formatShortDate,
  formatShortDateTime,
  formatShortTime,
} from "@/lib/formatShortDate";
import { supabaseClient } from "@/lib/supabaseClient";

type InboxTab = "unread" | "all" | "recent" | "starred";
type ReplyChannel = "email" | "sms" | "whatsapp" | "comment";

type ConversationRow = {
  id: string;
  subject: string | null;
  prospect_name: string | null;
  prospect_email: string | null;
  prospect_phone: string | null;
  last_message_at: string;
  contact_id?: string | null;
  booking_id?: string | null;
  starred?: boolean;
  unread_count?: number;
  last_preview?: string | null;
  last_channel?: string | null;
};

type MessageRow = {
  id: string;
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

type ProspectDetails = {
  id: string;
  full_name: string;
  job_title: string | null;
  email: string | null;
  business_name: string | null;
  linkedin_url?: string | null;
  phone: string | null;
  prospect_status: string | null;
  boss_score: number | null;
  boss_score_at: string | null;
  boss_score_premium: number | null;
  boss_score_premium_at: string | null;
  boss_level: string | null;
  revenue: string | null;
  team_size: string | null;
};

type BookingDetails = {
  id: string;
  starts_at: string;
  ends_at: string | null;
  status: string | null;
  prospect_timezone: string | null;
  meeting_join_url: string | null;
  meeting_location_type: string | null;
};

type ActivityEvent = {
  id: string;
  type: string;
  at: string;
  title: string;
  detail?: string | null;
  href?: string | null;
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

function initials(name: string | null | undefined): string {
  const parts = (name || "?").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function Avatar({
  name,
  url,
  size = "sm",
  tone = "neutral",
}: {
  name: string | null | undefined;
  url?: string | null;
  size?: "sm" | "md" | "lg";
  tone?: "neutral" | "sky";
}) {
  const sizeClass =
    size === "lg" ? "h-16 w-16 text-lg" : size === "md" ? "h-8 w-8 text-[11px]" : "h-7 w-7 text-[10px]";
  const toneClass =
    tone === "sky"
      ? "bg-sky-100 text-sky-800 ring-sky-200/80"
      : "bg-slate-200 text-slate-700 ring-slate-200/80";
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className={`${sizeClass} shrink-0 rounded-full object-cover ring-1 ${tone === "sky" ? "ring-sky-200/80" : "ring-slate-200/80"}`}
      />
    );
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-1 ${sizeClass} ${toneClass}`}
    >
      {initials(name)}
    </span>
  );
}

function ChannelIcon({
  channel,
  className = "",
}: {
  channel: string | null | undefined;
  className?: string;
}) {
  const c = (channel || "").toLowerCase();
  const title =
    c === "sms"
      ? "SMS"
      : c === "whatsapp"
        ? "WhatsApp"
        : c === "system"
          ? "Note"
          : "Email";
  const icon =
    c === "sms" || c === "whatsapp" ? (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.92L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    ) : c === "system" ? (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
      />
    ) : (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    );

  return (
    <span
      title={title}
      className={`inline-flex h-3.5 w-3.5 items-center justify-center text-slate-400 ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="h-3.5 w-3.5"
        aria-hidden
      >
        {icon}
      </svg>
      <span className="sr-only">{title}</span>
    </span>
  );
}

function MessageErrorBadge({
  message,
  align = "left",
}: {
  message: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className={`relative inline-flex ${align === "right" ? "ml-auto" : ""}`}>
      <button
        type="button"
        title={message}
        aria-label="Delivery error"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onBlur={() => setOpen(false)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-amber-600 hover:bg-amber-50 hover:text-amber-700"
      >
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-3.5 w-3.5"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 10-2 0 1 1 0 002 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open ? (
        <span
          role="tooltip"
          className={`absolute z-20 mt-1 w-56 rounded-md bg-slate-900 px-2.5 py-2 text-[11px] leading-snug text-white shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          } top-full`}
        >
          {message}
        </span>
      ) : null}
    </span>
  );
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

const TABS: { id: InboxTab; label: string }[] = [
  { id: "unread", label: "Unread" },
  { id: "all", label: "All" },
  { id: "recent", label: "Recent" },
  { id: "starred", label: "Starred" },
];

export function MessagingInbox() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [prospectDetails, setProspectDetails] = useState<ProspectDetails | null>(
    null
  );
  const [bookingDetails, setBookingDetails] = useState<BookingDetails | null>(
    null
  );
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [tab, setTab] = useState<InboxTab>("all");
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());
  const [composerOpen, setComposerOpen] = useState(false);
  const [channelMenuOpen, setChannelMenuOpen] = useState(false);
  const [replyChannel, setReplyChannel] = useState<ReplyChannel>("email");
  const [replyBody, setReplyBody] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [fromName, setFromName] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [coachProfile, setCoachProfile] = useState<{
    name: string;
    avatarUrl: string | null;
  }>({ name: "You", avatarUrl: null });

  const selected = useMemo(
    () =>
      conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  const unreadTotal = useMemo(
    () =>
      conversations.reduce((sum, c) => sum + (c.unread_count && c.unread_count > 0 ? 1 : 0), 0),
    [conversations]
  );

  const filtered = useMemo(() => {
    const sorted = [...conversations].sort(
      (a, b) =>
        new Date(b.last_message_at).getTime() -
        new Date(a.last_message_at).getTime()
    );
    if (tab === "unread") return sorted.filter((c) => (c.unread_count ?? 0) > 0);
    if (tab === "starred") return sorted.filter((c) => !!c.starred);
    if (tab === "recent") return sorted.slice(0, 20);
    return sorted;
  }, [conversations, tab]);

  const authHeaders = useCallback(async () => {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) return null;
    return {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    };
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) {
        setError("Sign in again, then retry.");
        return;
      }
      const res = await fetch("/api/messaging/conversations", { headers });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        conversations?: ConversationRow[];
      };
      if (!res.ok) {
        setError(body.error || `Request failed (${res.status}).`);
        setConversations([]);
        return;
      }
      const list = Array.isArray(body.conversations) ? body.conversations : [];
      setConversations(list);
      setSelectedId((prev) => {
        if (prev && list.some((c) => c.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed.");
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  const loadThread = useCallback(
    async (id: string) => {
      setLoadingThread(true);
      setProspectDetails(null);
      setBookingDetails(null);
      setActivityEvents([]);
      try {
        const headers = await authHeaders();
        if (!headers) return;
        const res = await fetch(
          `/api/messaging/conversations/${encodeURIComponent(id)}`,
          { headers }
        );
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          conversation?: ConversationRow;
          messages?: MessageRow[];
          prospect?: ProspectDetails | null;
          booking?: BookingDetails | null;
          activity?: ActivityEvent[];
        };
        if (!res.ok) {
          setError(body.error || `Thread failed (${res.status}).`);
          setMessages([]);
          setProspectDetails(null);
          setBookingDetails(null);
          setActivityEvents([]);
          setExpandedIds(new Set());
          return;
        }
        const list = Array.isArray(body.messages) ? body.messages : [];
        setMessages(list);
        setProspectDetails(body.prospect ?? null);
        setBookingDetails(body.booking ?? null);
        setActivityEvents(Array.isArray(body.activity) ? body.activity : []);
        const newest = list[list.length - 1];
        setExpandedIds(newest ? new Set([newest.id]) : new Set());
        if (body.conversation) {
          setConversations((prev) =>
            prev.map((c) =>
              c.id === id
                ? { ...c, ...body.conversation, unread_count: 0 }
                : c
            )
          );
          if (body.conversation.subject) {
            setReplySubject((s) => s || `Re: ${body.conversation!.subject}`);
          }
        } else {
          setConversations((prev) =>
            prev.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c))
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Thread load failed.");
      } finally {
        setLoadingThread(false);
      }
    },
    [authHeaders]
  );

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleChecked = useCallback((id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setCheckedIds((prev) => {
      if (filtered.every((c) => prev.has(c.id)) && filtered.length > 0) {
        return new Set();
      }
      return new Set(filtered.map((c) => c.id));
    });
  }, [filtered]);

  const patchConversation = useCallback(
    async (id: string, patch: { starred?: boolean; unread_count?: number }) => {
      const headers = await authHeaders();
      if (!headers) return;
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
      );
      await fetch(`/api/messaging/conversations/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(patch),
      });
    },
    [authHeaders]
  );

  const sendReply = useCallback(async () => {
    if (!selected?.id || !replyBody.trim()) return;
    if (replyChannel === "whatsapp") {
      setSendError("WhatsApp is not connected yet.");
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      const headers = await authHeaders();
      if (!headers) {
        setSendError("Sign in again, then retry.");
        return;
      }
      const channel =
        replyChannel === "comment" ? "comment" : replyChannel;
      const res = await fetch(
        `/api/messaging/conversations/${encodeURIComponent(selected.id)}`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            channel,
            body: replyBody,
            subject: replySubject || undefined,
            fromName: fromName || undefined,
          }),
        }
      );
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: MessageRow;
      };
      if (!res.ok) {
        setSendError(body.error || `Send failed (${res.status}).`);
        if (body.message) {
          setMessages((prev) => [...prev, body.message!]);
        }
        return;
      }
      if (body.message) {
        setMessages((prev) => [...prev, body.message!]);
        setExpandedIds((prev) => new Set(prev).add(body.message!.id));
      }
      setReplyBody("");
      setComposerOpen(false);
      await loadList();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Send failed.");
    } finally {
      setSending(false);
    }
  }, [
    authHeaders,
    fromName,
    loadList,
    replyBody,
    replyChannel,
    replySubject,
    selected?.id,
  ]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    let cancelled = false;
    async function loadCoach() {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabaseClient
        .from("profiles")
        .select("full_name, first_name, last_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled || !data) return;
      const name =
        (data.full_name as string | null)?.trim() ||
        [data.first_name, data.last_name].filter(Boolean).join(" ").trim() ||
        "You";
      setCoachProfile({
        name,
        avatarUrl: (data.avatar_url as string | null) ?? null,
      });
      setFromName((prev) => prev || name);
    }
    void loadCoach();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const headers = await authHeaders();
        if (!headers || cancelled) return;
        const [, inboundRes] = await Promise.all([
          fetch("/api/cron/booking-reminders", { headers }),
          fetch("/api/cron/bird-inbound", { headers }),
        ]);
        const inbound = (await inboundRes.json().catch(() => ({}))) as {
          ingested?: number;
        };
        if (!cancelled && (inbound.ingested ?? 0) > 0) {
          await loadList();
          if (selectedId) await loadThread(selectedId);
        }
      } catch {
        /* ignore */
      }
    }
    void tick();
    const id = window.setInterval(() => void tick(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [authHeaders, loadList, loadThread, selectedId]);

  useEffect(() => {
    if (selected?.id) {
      setComposerOpen(false);
      setChannelMenuOpen(false);
      setSendError(null);
      setReplyBody("");
      setReplySubject(
        selected.subject ? `Re: ${selected.subject}` : ""
      );
      void loadThread(selected.id);
    }
  }, [selected?.id, loadThread, selected?.subject]);

  useEffect(() => {
    if (!selected) return;
    if (replyChannel === "sms" && !selected.prospect_phone) {
      setReplyChannel("email");
    }
    if (replyChannel === "email" && !selected.prospect_email && selected.prospect_phone) {
      setReplyChannel("sms");
    }
  }, [selected, replyChannel]);

  const feedByDay = useMemo(() => {
    const items: FeedItem[] = [
      ...messages.map(
        (message): FeedItem => ({
          kind: "message",
          at: message.created_at,
          message,
        })
      ),
      ...activityEvents.map(
        (activity): FeedItem => ({
          kind: "activity",
          at: activity.at,
          activity,
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
  }, [messages, activityEvents]);

  const channelLabel =
    replyChannel === "email"
      ? "Email"
      : replyChannel === "sms"
        ? "SMS"
        : replyChannel === "whatsapp"
          ? "WhatsApp"
          : "Internal Comment";

  const noteCount = useMemo(
    () => messages.filter((m) => m.channel === "system").length,
    [messages]
  );

  const channelsUsed = useMemo(() => {
    const set = new Set<string>();
    for (const m of messages) {
      if (m.channel && m.channel !== "system") set.add(m.channel);
    }
    return Array.from(set);
  }, [messages]);

  const displayName =
    prospectDetails?.full_name ||
    selected?.prospect_name ||
    selected?.prospect_email ||
    "Unknown contact";

  const subtitle =
    [prospectDetails?.job_title?.trim(), prospectDetails?.business_name?.trim()]
      .filter(Boolean)
      .join(" · ") || null;

  const email =
    prospectDetails?.email || selected?.prospect_email || null;
  const phone =
    prospectDetails?.phone || selected?.prospect_phone || null;
  const linkedIn = prospectDetails?.linkedin_url?.trim() || null;

  const prospectHref = selected?.contact_id
    ? pathname?.startsWith("/admin")
      ? `/admin/prospects/${selected.contact_id}`
      : `/coach/prospects/${selected.contact_id}`
    : null;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:-mr-6 lg:-mr-10">
      <div className="grid min-h-[calc(100vh-11rem)] grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        {/* Left: team inbox list */}
        <aside className="flex flex-col border-b border-slate-200 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Team inbox</h2>
            <button
              type="button"
              onClick={() => void loadList()}
              className="text-xs font-medium text-slate-500 hover:text-slate-800"
              disabled={loading}
            >
              {loading ? "…" : "Refresh"}
            </button>
          </div>

          <div className="flex gap-1 border-b border-slate-100 px-2 pt-2">
            {TABS.map((t) => {
              const active = tab === t.id;
              const badge =
                t.id === "unread" && unreadTotal > 0 ? unreadTotal : null;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`relative rounded-t-md px-3 py-2 text-xs font-medium ${
                    active
                      ? "bg-slate-50 text-slate-900"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {t.label}
                  {badge != null ? (
                    <span className="ml-1.5 inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-sky-600 px-1 text-[10px] font-semibold text-white">
                      {badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2 text-xs text-slate-500">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={
                  filtered.length > 0 &&
                  filtered.every((c) => checkedIds.has(c.id))
                }
                onChange={toggleSelectAll}
                className="h-3.5 w-3.5 rounded border-slate-300"
              />
              Select all
            </label>
            {error ? <span className="text-red-600">{error}</span> : null}
          </div>

          <ul className="max-h-[50vh] flex-1 overflow-y-auto lg:max-h-none">
            {filtered.length === 0 && !loading ? (
              <li className="px-4 py-8 text-sm text-slate-500">
                {tab === "unread"
                  ? "No unread conversations."
                  : tab === "starred"
                    ? "No starred conversations."
                    : "No conversations yet. Book a call to create the first thread."}
              </li>
            ) : null}
            {filtered.map((c) => {
              const active = selected?.id === c.id;
              const unread = (c.unread_count ?? 0) > 0;
              return (
                <li key={c.id} className="border-b border-slate-100">
                  <div
                    className={`flex items-start gap-2 px-3 py-2.5 ${
                      active
                        ? "border-r-2 border-r-sky-500 bg-sky-50/80"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checkedIds.has(c.id)}
                      onChange={() => toggleChecked(c.id)}
                      className="mt-2.5 h-3.5 w-3.5 shrink-0 rounded border-slate-300"
                      aria-label={`Select ${c.prospect_name || "conversation"}`}
                    />
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-start gap-2.5">
                        <Avatar
                          name={c.prospect_name || c.prospect_email}
                          size="md"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span
                              className={`truncate text-sm ${
                                unread
                                  ? "font-semibold text-slate-900"
                                  : "font-medium text-slate-800"
                              }`}
                            >
                              {c.prospect_name || c.prospect_email || "Unknown"}
                            </span>
                            <ChannelIcon channel={c.last_channel} />
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">
                            {previewText(c.last_preview || c.subject, 72) ||
                              "No messages yet"}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-[11px] text-slate-400">
                            {formatShortDate(c.last_message_at)}
                          </span>
                          <span className="flex items-center gap-1">
                            {unread ? (
                              <span className="inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-sky-600 px-1 text-[10px] font-semibold text-white">
                                {c.unread_count}
                              </span>
                            ) : null}
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                void patchConversation(c.id, {
                                  starred: !c.starred,
                                });
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  void patchConversation(c.id, {
                                    starred: !c.starred,
                                  });
                                }
                              }}
                              className={`text-sm ${
                                c.starred
                                  ? "text-amber-500"
                                  : "text-slate-300 hover:text-slate-500"
                              }`}
                              aria-label={c.starred ? "Unstar" : "Star"}
                            >
                              {c.starred ? "★" : "☆"}
                            </span>
                          </span>
                        </span>
                      </div>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Center: thread + composer */}
        <section className="flex min-h-[480px] flex-col border-b border-slate-200 xl:border-b-0">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            {selected ? (
              <>
                <div className="flex min-w-0 items-center gap-3">
                  <span className="xl:hidden">
                    <Avatar
                      name={selected.prospect_name || selected.prospect_email}
                      size="md"
                    />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">
                      {displayName}
                    </div>
                    <div className="truncate text-xs text-slate-500 xl:hidden">
                      {[selected.prospect_email, selected.prospect_phone]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    {selected.subject ? (
                      <div className="hidden truncate text-xs text-slate-500 xl:block">
                        {selected.subject}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {(selected.unread_count ?? 0) === 0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        void patchConversation(selected.id, { unread_count: 1 })
                      }
                      className="rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                    >
                      Mark unread
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() =>
                      void patchConversation(selected.id, {
                        starred: !selected.starred,
                      })
                    }
                    className={`rounded-md px-2 py-1 text-lg ${
                      selected.starred ? "text-amber-500" : "text-slate-300"
                    }`}
                    aria-label={selected.starred ? "Unstar" : "Star"}
                  >
                    {selected.starred ? "★" : "☆"}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-500">Select a conversation</div>
            )}
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto bg-[#f7f8fa] px-3 py-4 sm:px-4">
            {!selected ? null : loadingThread ? (
              <p className="text-sm text-slate-500">Loading thread…</p>
            ) : feedByDay.length === 0 ? (
              <p className="text-sm text-slate-500">
                No messages or activity yet.
              </p>
            ) : (
              feedByDay.map((group) => (
                <div key={group.label} className="space-y-3">
                  <div className="flex justify-center py-1">
                    <span className="rounded-full bg-white/90 px-3 py-0.5 text-[11px] font-medium text-slate-500 shadow-sm ring-1 ring-slate-200/80">
                      {group.label}
                    </span>
                  </div>
                  {group.items.map((item) => {
                    if (item.kind === "activity") {
                      const a = item.activity;
                      const icon = activityGlyph(a.type);
                      const body = (
                        <>
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200/80 text-[10px] font-semibold text-slate-600">
                            {icon}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="font-medium text-slate-700">
                              {a.title}
                            </span>
                            {a.detail ? (
                              <span className="text-slate-500">
                                {" "}
                                · {a.detail}
                              </span>
                            ) : null}
                          </span>
                          <span className="shrink-0 text-[10px] tabular-nums text-slate-400">
                            {formatShortTime(a.at)}
                          </span>
                        </>
                      );
                      return (
                        <div key={a.id} className="flex justify-center px-2">
                          {a.href ? (
                            <a
                              href={a.href}
                              target={
                                a.href.startsWith("http") ? "_blank" : undefined
                              }
                              rel={
                                a.href.startsWith("http")
                                  ? "noreferrer"
                                  : undefined
                              }
                              className="flex w-full max-w-[min(84%,36rem)] items-center gap-2 rounded-lg border border-slate-200/80 bg-white/70 px-3 py-2 text-left text-xs text-slate-600 shadow-sm hover:border-sky-200 hover:bg-white"
                            >
                              {body}
                            </a>
                          ) : (
                            <div className="flex w-full max-w-[min(84%,36rem)] items-center gap-2 rounded-lg border border-slate-200/80 bg-white/70 px-3 py-2 text-xs text-slate-600 shadow-sm">
                              {body}
                            </div>
                          )}
                        </div>
                      );
                    }

                    const m = item.message;
                    const open = expandedIds.has(m.id);
                    const outbound = m.direction === "outbound";
                    const isComment = m.channel === "system";
                    const isEmail = (m.channel || "").toLowerCase() === "email";
                    const body = (m.body_text || "").trim() || "(empty)";
                    const subject = m.subject?.trim() || null;
                    const failed =
                      m.status === "failed" || Boolean(m.provider_error);
                    // Emails (and notes) always collapse; SMS only if very long.
                    const collapsible =
                      isComment || isEmail || body.length > 280;
                    const showFull = open || !collapsible;

                    if (isComment) {
                      return (
                        <div key={m.id} className="flex justify-center px-4">
                          <div className="w-full max-w-[min(84%,36rem)] overflow-hidden rounded-xl border border-dashed border-amber-200 bg-amber-50/80 text-sm text-amber-950">
                            <button
                              type="button"
                              onClick={() => toggleExpanded(m.id)}
                              aria-expanded={open}
                              className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left hover:bg-amber-50"
                            >
                              <span className="text-[10px] text-amber-600/80">
                                {open ? "▾" : "▸"}
                              </span>
                              <ChannelIcon
                                channel="system"
                                className="text-amber-600"
                              />
                              <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-amber-800">
                                Internal note
                                {!open ? (
                                  <span className="font-normal text-amber-700/70">
                                    {" · "}
                                    {previewText(body, 72)}
                                  </span>
                                ) : null}
                              </span>
                              <span className="shrink-0 text-[10px] tabular-nums text-amber-600/70">
                                {formatShortTime(m.created_at)}
                              </span>
                            </button>
                            {open ? (
                              <div className="border-t border-amber-200/60 px-3.5 py-2.5 whitespace-pre-wrap">
                                {body}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    }

                    // Emails: wider card with subject header + collapse.
                    // SMS/etc: chat bubble; collapse only when very long.
                    if (isEmail) {
                      return (
                        <div
                          key={m.id}
                          className={`flex items-end gap-2 ${
                            outbound ? "justify-end" : "justify-start"
                          }`}
                        >
                          {!outbound ? (
                            <Avatar
                              name={
                                selected?.prospect_name ||
                                selected?.prospect_email
                              }
                              size="sm"
                            />
                          ) : null}
                          <div
                            className={`w-full max-w-[min(84%,36rem)] overflow-hidden rounded-2xl text-sm shadow-sm ring-1 ${
                              outbound
                                ? failed
                                  ? "rounded-br-md bg-sky-50 ring-amber-300/80"
                                  : "rounded-br-md bg-sky-100/90 ring-sky-200/70"
                                : failed
                                  ? "rounded-bl-md bg-white ring-amber-300/80"
                                  : "rounded-bl-md bg-white ring-slate-200/80"
                            }`}
                          >
                            <div
                              className={`flex w-full items-start gap-2 px-3.5 py-2.5 ${
                                outbound
                                  ? "hover:bg-sky-100"
                                  : "hover:bg-slate-50"
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => toggleExpanded(m.id)}
                                aria-expanded={open}
                                className="mt-0.5 shrink-0 text-[10px] text-slate-400"
                              >
                                {open ? "▾" : "▸"}
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleExpanded(m.id)}
                                aria-expanded={open}
                                className="min-w-0 flex-1 text-left"
                              >
                                <span className="flex items-center gap-1.5">
                                  <ChannelIcon
                                    channel="email"
                                    className={
                                      outbound
                                        ? "text-sky-700/70"
                                        : "text-slate-400"
                                    }
                                  />
                                  <span
                                    className={`truncate text-sm font-semibold ${
                                      outbound
                                        ? "text-sky-950"
                                        : "text-slate-900"
                                    }`}
                                  >
                                    {subject || "Email"}
                                  </span>
                                  <span
                                    className={`ml-auto shrink-0 text-[10px] tabular-nums ${
                                      outbound
                                        ? "text-sky-800/55"
                                        : "text-slate-400"
                                    }`}
                                  >
                                    {formatShortTime(m.created_at)}
                                  </span>
                                </span>
                                {!open ? (
                                  <span
                                    className={`mt-0.5 block truncate text-xs ${
                                      outbound
                                        ? "text-sky-900/55"
                                        : "text-slate-500"
                                    }`}
                                  >
                                    {previewText(body, 110)}
                                  </span>
                                ) : null}
                              </button>
                              {failed ? (
                                <MessageErrorBadge
                                  message={
                                    m.provider_error || "Failed to send"
                                  }
                                  align="right"
                                />
                              ) : null}
                            </div>
                            {open ? (
                              <div
                                className={`border-t px-3.5 py-3 ${
                                  outbound
                                    ? "border-sky-200/60"
                                    : "border-slate-100"
                                }`}
                              >
                                {(m.from_address || m.to_address) && (
                                  <div className="mb-2.5 space-y-0.5 text-[11px] text-slate-500">
                                    {m.from_address ? (
                                      <div>
                                        <span className="text-slate-400">
                                          From{" "}
                                        </span>
                                        {m.from_address}
                                      </div>
                                    ) : null}
                                    {m.to_address ? (
                                      <div>
                                        <span className="text-slate-400">
                                          To{" "}
                                        </span>
                                        {m.to_address}
                                      </div>
                                    ) : null}
                                  </div>
                                )}
                                <div className="whitespace-pre-wrap leading-relaxed text-slate-800">
                                  {body}
                                </div>
                              </div>
                            ) : null}
                          </div>
                          {outbound ? (
                            <Avatar
                              name={coachProfile.name}
                              url={coachProfile.avatarUrl}
                              size="sm"
                              tone="sky"
                            />
                          ) : null}
                        </div>
                      );
                    }

                    // SMS / WhatsApp-style bubble
                    return (
                      <div
                        key={m.id}
                        className={`flex items-end gap-2 ${
                          outbound ? "justify-end" : "justify-start"
                        }`}
                      >
                        {!outbound ? (
                          <Avatar
                            name={
                              selected?.prospect_name ||
                              selected?.prospect_email
                            }
                            size="sm"
                          />
                        ) : null}
                        <div
                          className={`max-w-[min(70%,26rem)] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ring-1 ${
                            outbound
                              ? failed
                                ? "rounded-br-md bg-sky-50 text-slate-900 ring-amber-300/80"
                                : "rounded-br-md bg-sky-100/90 text-slate-900 ring-sky-200/70"
                              : failed
                                ? "rounded-bl-md bg-white text-slate-900 ring-amber-300/80"
                                : "rounded-bl-md bg-white text-slate-900 ring-slate-200/80"
                          }`}
                        >
                          {failed ? (
                            <div
                              className={`mb-1.5 flex ${
                                outbound ? "justify-end" : "justify-start"
                              }`}
                            >
                              <MessageErrorBadge
                                message={
                                  m.provider_error || "Failed to send"
                                }
                                align={outbound ? "right" : "left"}
                              />
                            </div>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => {
                              if (collapsible) toggleExpanded(m.id);
                            }}
                            aria-expanded={collapsible ? open : undefined}
                            className={`w-full text-left ${
                              collapsible ? "" : "cursor-default"
                            }`}
                          >
                            <div className="whitespace-pre-wrap leading-relaxed">
                              {showFull ? body : previewText(body, 240)}
                            </div>
                            {collapsible && !open ? (
                              <div className="mt-1 text-[11px] font-medium text-sky-700">
                                Show more
                              </div>
                            ) : null}
                          </button>
                          <div
                            className={`mt-1.5 flex items-center gap-1.5 ${
                              outbound ? "justify-end" : "justify-start"
                            }`}
                          >
                            <ChannelIcon
                              channel={m.channel}
                              className={
                                outbound
                                  ? "text-sky-700/60"
                                  : "text-slate-400"
                              }
                            />
                            <span
                              className={`text-[10px] tabular-nums ${
                                outbound
                                  ? "text-sky-800/55"
                                  : "text-slate-400"
                              }`}
                            >
                              {formatShortTime(m.created_at)}
                            </span>
                          </div>
                        </div>
                        {outbound ? (
                          <Avatar
                            name={coachProfile.name}
                            url={coachProfile.avatarUrl}
                            size="sm"
                            tone="sky"
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Composer */}
          {selected ? (
            <div className="relative border-t border-slate-200 bg-white">
              {!composerOpen ? (
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setChannelMenuOpen((v) => !v)}
                      className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      {channelLabel}
                      <span className="text-slate-400">▾</span>
                    </button>
                    {channelMenuOpen ? (
                      <div className="absolute bottom-full left-0 z-20 mb-1 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                        {(
                          [
                            ["sms", "SMS", !!selected.prospect_phone],
                            ["whatsapp", "WhatsApp", false],
                            ["email", "Email", !!selected.prospect_email],
                            ["comment", "Internal Comment", true],
                          ] as const
                        ).map(([id, label, enabled]) => (
                          <button
                            key={id}
                            type="button"
                            disabled={!enabled}
                            onClick={() => {
                              if (!enabled) return;
                              setReplyChannel(id);
                              setChannelMenuOpen(false);
                              setComposerOpen(true);
                            }}
                            className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                              enabled
                                ? "text-slate-800 hover:bg-slate-50"
                                : "cursor-not-allowed text-slate-300"
                            } ${replyChannel === id ? "bg-slate-50 font-medium" : ""}`}
                          >
                            {label}
                            {replyChannel === id ? (
                              <span className="text-sky-600">✓</span>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setComposerOpen(true);
                      setChannelMenuOpen(false);
                    }}
                    className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-400 hover:border-slate-300"
                  >
                    Type a message
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setComposerOpen(true);
                      setChannelMenuOpen(false);
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-md bg-sky-600 text-white hover:bg-sky-700"
                    aria-label="Compose"
                  >
                    ✈
                  </button>
                </div>
              ) : (
                <div className="space-y-3 p-3">
                  <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setChannelMenuOpen((v) => !v)}
                        className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                      >
                        {channelLabel}
                        <span className="text-slate-400">▾</span>
                      </button>
                      {channelMenuOpen ? (
                        <div className="absolute bottom-full left-0 z-20 mb-1 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                          {(
                            [
                              ["sms", "SMS", !!selected.prospect_phone],
                              ["whatsapp", "WhatsApp", false],
                              ["email", "Email", !!selected.prospect_email],
                              ["comment", "Internal Comment", true],
                            ] as const
                          ).map(([id, label, enabled]) => (
                            <button
                              key={id}
                              type="button"
                              disabled={!enabled}
                              onClick={() => {
                                if (!enabled) return;
                                setReplyChannel(id);
                                setChannelMenuOpen(false);
                              }}
                              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                                enabled
                                  ? "text-slate-800 hover:bg-slate-50"
                                  : "cursor-not-allowed text-slate-300"
                              }`}
                            >
                              {label}
                              {replyChannel === id ? (
                                <span className="text-sky-600">✓</span>
                              ) : null}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setComposerOpen(false);
                        setChannelMenuOpen(false);
                      }}
                      className="ml-auto text-xs text-slate-500 hover:text-slate-800"
                    >
                      Collapse
                    </button>
                  </div>

                  {replyChannel === "email" ? (
                    <div className="space-y-2 text-sm">
                      <label className="flex items-center gap-2">
                        <span className="w-20 shrink-0 text-xs text-slate-500">
                          From name
                        </span>
                        <input
                          value={fromName}
                          onChange={(e) => setFromName(e.target.value)}
                          placeholder="Coach name"
                          className="flex-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-sm"
                        />
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="w-20 shrink-0 text-xs text-slate-500">
                          To
                        </span>
                        <span className="truncate text-sm text-slate-700">
                          {selected.prospect_email || "—"}
                        </span>
                      </div>
                      <label className="flex items-center gap-2">
                        <span className="w-20 shrink-0 text-xs text-slate-500">
                          Subject
                        </span>
                        <input
                          value={replySubject}
                          onChange={(e) => setReplySubject(e.target.value)}
                          className="flex-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-sm"
                        />
                      </label>
                    </div>
                  ) : null}

                  {replyChannel === "sms" ? (
                    <div className="text-xs text-slate-500">
                      To {selected.prospect_phone}
                    </div>
                  ) : null}

                  {replyChannel === "comment" ? (
                    <div className="text-xs text-amber-700">
                      Internal only — not sent to the contact.
                    </div>
                  ) : null}

                  <textarea
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    rows={replyChannel === "email" ? 6 : 3}
                    autoFocus
                    placeholder={
                      replyChannel === "comment"
                        ? "Add an internal note…"
                        : "Type a message"
                    }
                    className="w-full resize-y rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  />

                  {sendError ? (
                    <p className="text-xs text-red-600">{sendError}</p>
                  ) : null}

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setReplyBody("");
                        setComposerOpen(false);
                      }}
                      className="rounded-md px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
                    >
                      Discard
                    </button>
                    <button
                      type="button"
                      disabled={sending || !replyBody.trim()}
                      onClick={() => void sendReply()}
                      className="rounded-md bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                    >
                      {sending ? "Sending…" : "Send"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </section>

        {/* Right: contact / prospect details */}
        <aside className="hidden flex-col border-t border-slate-200 bg-white xl:flex xl:border-l xl:border-t-0">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Details</h2>
          </div>

          {!selected ? (
            <div className="flex flex-1 items-center justify-center px-6 py-10 text-center text-sm text-slate-400">
              Select a conversation to see contact details.
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-col items-center px-5 pb-5 pt-6 text-center">
                <Avatar
                  name={displayName}
                  size="lg"
                />
                <h3 className="mt-3 text-base font-semibold tracking-tight text-slate-900">
                  {displayName}
                </h3>
                {subtitle ? (
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                    {subtitle}
                  </p>
                ) : selected.subject ? (
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                    {selected.subject}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-slate-400">Prospect</p>
                )}
                {prospectHref ? (
                  <a
                    href={prospectHref}
                    className="mt-2 text-[11px] font-medium text-sky-700 hover:text-sky-800"
                  >
                    View prospect →
                  </a>
                ) : null}
              </div>

              <div className="flex justify-center gap-2 px-5 pb-5">
                {email ? (
                  <button
                    type="button"
                    title="Email"
                    onClick={() => {
                      setReplyChannel("email");
                      setComposerOpen(true);
                      setChannelMenuOpen(false);
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
                  >
                    ✉
                  </button>
                ) : null}
                {phone ? (
                  <button
                    type="button"
                    title="SMS"
                    onClick={() => {
                      setReplyChannel("sms");
                      setComposerOpen(true);
                      setChannelMenuOpen(false);
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
                  >
                    ☎
                  </button>
                ) : null}
                {linkedIn ? (
                  <a
                    href={linkedIn}
                    target="_blank"
                    rel="noreferrer"
                    title="LinkedIn"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
                  >
                    in
                  </a>
                ) : null}
                <button
                  type="button"
                  title={selected.starred ? "Unstar" : "Star"}
                  onClick={() =>
                    void patchConversation(selected.id, {
                      starred: !selected.starred,
                    })
                  }
                  className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${
                    selected.starred
                      ? "border-amber-200 bg-amber-50 text-amber-500"
                      : "border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600"
                  }`}
                >
                  {selected.starred ? "★" : "☆"}
                </button>
                <button
                  type="button"
                  title="Add note"
                  onClick={() => {
                    setReplyChannel("comment");
                    setComposerOpen(true);
                    setChannelMenuOpen(false);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
                >
                  ✎
                </button>
              </div>

              <div className="space-y-5 border-t border-slate-100 px-5 py-5">
                <section>
                  <h4 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Contact
                  </h4>
                  <dl className="space-y-3">
                    <div>
                      <dt className="text-[11px] text-slate-400">Email</dt>
                      <dd className="mt-0.5 break-all text-sm text-slate-800">
                        {email ? (
                          <a
                            href={`mailto:${email}`}
                            className="hover:text-sky-700"
                          >
                            {email}
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-400">Phone</dt>
                      <dd className="mt-0.5 text-sm text-slate-800">
                        {phone ? (
                          <a
                            href={`tel:${phone}`}
                            className="hover:text-sky-700"
                          >
                            {phone}
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-400">Business</dt>
                      <dd className="mt-0.5 text-sm text-slate-800">
                        {prospectDetails?.business_name?.trim() || (
                          <span className="text-slate-400">—</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-400">Title</dt>
                      <dd className="mt-0.5 text-sm text-slate-800">
                        {prospectDetails?.job_title?.trim() || (
                          <span className="text-slate-400">—</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-400">LinkedIn</dt>
                      <dd className="mt-0.5 text-sm text-slate-800">
                        {linkedIn ? (
                          <a
                            href={linkedIn}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-sky-700"
                          >
                            View profile
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-400">Status</dt>
                      <dd className="mt-0.5 text-sm capitalize text-slate-800">
                        {prospectDetails?.prospect_status ? (
                          prospectDetails.prospect_status.replace(/_/g, " ")
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </dd>
                    </div>
                    {!prospectDetails ? (
                      <p className="text-[11px] leading-snug text-slate-400">
                        No linked prospect record yet — fields above use inbox
                        details only.
                      </p>
                    ) : null}
                  </dl>
                </section>

                <section>
                  <h4 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Assessment
                  </h4>
                  <dl className="space-y-3">
                    <div>
                      <dt className="text-[11px] text-slate-400">Boss Score</dt>
                      <dd className="mt-0.5 text-sm text-slate-800">
                        {prospectDetails?.boss_score != null ? (
                          <>
                            {`${Math.round(prospectDetails.boss_score)}%`}
                            {prospectDetails.boss_score_at ? (
                              <span className="text-slate-400">
                                {" "}
                                ·{" "}
                                {formatShortDate(prospectDetails.boss_score_at)}
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-400">Boss Pro</dt>
                      <dd className="mt-0.5 text-sm text-slate-800">
                        {prospectDetails?.boss_score_premium != null ? (
                          <>
                            {Math.round(prospectDetails.boss_score_premium)}
                            {prospectDetails.boss_score_premium_at ? (
                              <span className="text-slate-400">
                                {" "}
                                ·{" "}
                                {formatShortDate(
                                  prospectDetails.boss_score_premium_at
                                )}
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-400">Boss level</dt>
                      <dd className="mt-0.5 text-sm text-slate-800">
                        {prospectDetails?.boss_level?.trim() || (
                          <span className="text-slate-400">—</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-400">Revenue</dt>
                      <dd className="mt-0.5 text-sm text-slate-800">
                        {prospectDetails?.revenue?.trim() || (
                          <span className="text-slate-400">—</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-400">Team size</dt>
                      <dd className="mt-0.5 text-sm text-slate-800">
                        {prospectDetails?.team_size?.trim() || (
                          <span className="text-slate-400">—</span>
                        )}
                      </dd>
                    </div>
                  </dl>
                </section>

                {bookingDetails ? (
                  <section>
                    <h4 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Booking
                    </h4>
                    <dl className="space-y-3">
                      <div>
                        <dt className="text-[11px] text-slate-400">When</dt>
                        <dd className="mt-0.5 text-sm text-slate-800">
                          {formatShortDateTime(bookingDetails.starts_at)}
                        </dd>
                      </div>
                      {bookingDetails.status ? (
                        <div>
                          <dt className="text-[11px] text-slate-400">Status</dt>
                          <dd className="mt-0.5 text-sm capitalize text-slate-800">
                            {bookingDetails.status.replace(/_/g, " ")}
                          </dd>
                        </div>
                      ) : null}
                      {bookingDetails.meeting_join_url ? (
                        <div>
                          <dt className="text-[11px] text-slate-400">Meeting</dt>
                          <dd className="mt-0.5 text-sm text-slate-800">
                            <a
                              href={bookingDetails.meeting_join_url}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:text-sky-700"
                            >
                              Join link
                            </a>
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  </section>
                ) : null}

                <section>
                  <h4 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Conversation
                  </h4>
                  <dl className="space-y-3">
                    <div>
                      <dt className="text-[11px] text-slate-400">Last activity</dt>
                      <dd className="mt-0.5 text-sm text-slate-800">
                        {formatShortDateTime(selected.last_message_at)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-400">Channels</dt>
                      <dd className="mt-1 flex flex-wrap gap-1.5">
                        {channelsUsed.length === 0 ? (
                          <span className="text-sm text-slate-400">—</span>
                        ) : (
                          channelsUsed.map((ch) => (
                            <span
                              key={ch}
                              className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium capitalize text-slate-600"
                            >
                              <ChannelIcon
                                channel={ch}
                                className="text-slate-500"
                              />
                              {ch}
                            </span>
                          ))
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-400">Messages</dt>
                      <dd className="mt-0.5 text-sm text-slate-800">
                        {messages.length}
                      </dd>
                    </div>
                  </dl>
                </section>
              </div>

              <div className="border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setReplyChannel("comment");
                    setComposerOpen(true);
                    setChannelMenuOpen(false);
                  }}
                  className="flex w-full items-center justify-between px-5 py-3.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <span className="font-medium">Notes</span>
                  <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-600">
                    {noteCount}
                  </span>
                </button>
              </div>
            </div>
          )}
        </aside>

        {/* Mobile / tablet details (below thread when no xl sidebar) */}
        {selected ? (
          <div className="col-span-full border-t border-slate-200 bg-white px-4 py-5 xl:hidden">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">Details</h2>
            <div className="flex items-start gap-3">
              <Avatar
                name={selected.prospect_name || selected.prospect_email}
                size="md"
              />
              <div className="min-w-0 flex-1 space-y-2 text-sm">
                <div className="font-semibold text-slate-900">{displayName}</div>
                {selected.prospect_email ? (
                  <a
                    href={`mailto:${selected.prospect_email}`}
                    className="block truncate text-slate-600 hover:text-sky-700"
                  >
                    {selected.prospect_email}
                  </a>
                ) : null}
                {selected.prospect_phone ? (
                  <a
                    href={`tel:${selected.prospect_phone}`}
                    className="block text-slate-600 hover:text-sky-700"
                  >
                    {selected.prospect_phone}
                  </a>
                ) : null}
                <div className="text-xs text-slate-400">
                  Last activity {formatShortDateTime(selected.last_message_at)}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
