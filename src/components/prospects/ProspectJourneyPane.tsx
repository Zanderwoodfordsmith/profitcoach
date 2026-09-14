"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ClipboardList,
  Gauge,
  Megaphone,
  Phone,
  Play,
  RefreshCw,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { LinkedInSolidIcon } from "@/components/icons/LinkedInSolidIcon";
import { BookProspectModal } from "@/components/prospects/BookProspectModal";
import { prospectInitials } from "@/components/prospects/ProspectTableAvatar";
import {
  formatDayLabel,
  formatRelativeAgo,
  formatShortDateTime,
  formatShortTime,
} from "@/lib/formatShortDate";
import { PROSPECT_INTERNAL_NOTE_EVENT } from "@/lib/messaging/internalNoteEvent";
import { isStoredReactionEventMessage } from "@/lib/messaging/messageReactions";
import { supabaseClient } from "@/lib/supabaseClient";
import { getValidSupabaseAccessToken } from "@/lib/supabaseAccessToken";
import type { ProspectNextCall } from "@/lib/prospectNextCall";
import type { ProspectRow } from "@/lib/prospectRow";

type PaneTab = "activity" | "calls" | "notes";

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
  metadata?: Record<string, unknown> | null;
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

type CallRow = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  status: string | null;
  meetingJoinUrl: string | null;
};

type Props = {
  contactId: string;
  impersonateCoachId?: string | null;
  prospect?: ProspectRow | null;
  onProspectBooked?: (row: ProspectRow, nextCall: ProspectNextCall) => void;
};

const TABS: { id: PaneTab; label: string }[] = [
  { id: "activity", label: "Activity" },
  { id: "calls", label: "Calls" },
  { id: "notes", label: "Notes" },
];

function eventIcon(type: string): ReactNode {
  const className = "h-3 w-3";
  switch (type) {
    case "boss_score_completed":
    case "boss_pro_completed":
      return <Gauge className={className} aria-hidden />;
    case "call_booked":
      return <Phone className={className} aria-hidden />;
    case "form_filled":
      return <ClipboardList className={className} aria-hidden />;
    case "assessment_started":
      return <Play className={className} aria-hidden />;
    case "prospect_created":
      return <UserPlus className={className} aria-hidden />;
    case "campaign_added":
    case "campaign_left":
      return <Megaphone className={className} aria-hidden />;
    case "linkedin_connected":
      return <LinkedInSolidIcon className={className} />;
    default:
      return <Sparkles className={className} aria-hidden />;
  }
}

function groupByDay<T extends { at: string }>(
  items: T[],
  newestFirst: boolean
): { label: string; items: T[] }[] {
  const sorted = [...items].sort((a, b) => {
    const delta = new Date(a.at).getTime() - new Date(b.at).getTime();
    return newestFirst ? -delta : delta;
  });
  const groups: { label: string; items: T[] }[] = [];
  for (const item of sorted) {
    const label = formatDayLabel(item.at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

function noteAuthor(
  message: MessageRow,
  fallback: { name: string; avatarUrl: string | null }
): { name: string; avatarUrl: string | null } {
  const meta = message.metadata || {};
  const name =
    (typeof meta.author_name === "string" && meta.author_name.trim()) ||
    fallback.name;
  const avatarUrl =
    (typeof meta.author_avatar_url === "string" &&
      meta.author_avatar_url.trim()) ||
    fallback.avatarUrl;
  return { name, avatarUrl };
}

function callStatusLabel(status: string | null): string {
  const s = (status || "").toLowerCase();
  if (s === "booked" || s === "confirmed") return "Confirmed";
  if (s === "cancelled") return "Cancelled";
  if (s === "completed" || s === "showed") return "Completed";
  if (s === "noshow" || s === "no_show") return "No-show";
  if (!s) return "Scheduled";
  return s.replace(/_/g, " ");
}

function PaneSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex gap-3">
          <div className="h-7 w-7 shrink-0 rounded-full bg-slate-100" />
          <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
            <div className="h-3 w-3/5 rounded bg-slate-100" />
            <div className="h-3 w-2/5 rounded bg-slate-50" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProspectJourneyPane({
  contactId,
  impersonateCoachId = null,
  prospect = null,
  onProspectBooked,
}: Props) {
  const tabId = useId();
  const [tab, setTab] = useState<PaneTab>("activity");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [author, setAuthor] = useState<{
    name: string;
    avatarUrl: string | null;
  }>({ name: "You", avatarUrl: null });

  const authHeaders = useCallback(async () => {
    const token = await getValidSupabaseAccessToken();
    if (!token) return null;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    if (impersonateCoachId) {
      headers["x-impersonate-coach-id"] = impersonateCoachId;
    }
    return headers;
  }, [impersonateCoachId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) {
        setError("Sign in again, then retry.");
        return;
      }
      const res = await fetch(
        `/api/messaging/contacts/${encodeURIComponent(contactId)}/feed`,
        { headers, cache: "no-store" }
      );
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        activity?: ActivityEvent[];
        messages?: MessageRow[];
        conversations?: ConversationRow[];
        calls?: CallRow[];
      };
      if (!res.ok) {
        setError(body.error || `Failed to load (${res.status}).`);
        setEvents([]);
        setMessages([]);
        setConversations([]);
        setCalls([]);
        return;
      }
      setEvents(Array.isArray(body.activity) ? body.activity : []);
      setMessages(Array.isArray(body.messages) ? body.messages : []);
      setConversations(
        Array.isArray(body.conversations) ? body.conversations : []
      );
      setCalls(Array.isArray(body.calls) ? body.calls : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed.");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, contactId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    async function loadAuthor() {
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
      setAuthor({
        name,
        avatarUrl: (data.avatar_url as string | null) ?? null,
      });
    }
    void loadAuthor();
    return () => {
      cancelled = true;
    };
  }, []);

  const notes = useMemo(
    () =>
      messages
        .filter(
          (message) =>
            (message.channel === "system" || message.channel === "comment") &&
            !isStoredReactionEventMessage({
              body_text: message.body_text,
              metadata: message.metadata,
            })
        )
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ),
    [messages]
  );

  const activityGroups = useMemo(
    () => groupByDay(events, false),
    [events]
  );

  const { upcomingCalls, pastCalls } = useMemo(() => {
    const nowMs = Date.now();
    const upcoming = calls.filter(
      (call) =>
        new Date(call.startsAt).getTime() >= nowMs &&
        (call.status || "").toLowerCase() !== "cancelled"
    );
    const past = [...calls]
      .filter((call) => !upcoming.some((row) => row.id === call.id))
      .reverse();
    return { upcomingCalls: upcoming, pastCalls: past };
  }, [calls]);

  const ensureConversationId = useCallback(async () => {
    const existing = conversations[0]?.id;
    if (existing) return existing;
    const headers = await authHeaders();
    if (!headers) throw new Error("Sign in again, then retry.");
    const res = await fetch("/api/messaging/conversations", {
      method: "POST",
      headers,
      body: JSON.stringify({ contact_id: contactId }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      conversation?: ConversationRow;
    };
    if (!res.ok || !body.conversation?.id) {
      throw new Error(body.error || "Could not open this conversation.");
    }
    setConversations([body.conversation]);
    return body.conversation.id;
  }, [authHeaders, contactId, conversations]);

  const saveNote = useCallback(async () => {
    const text = noteDraft.trim();
    if (!text || noteSaving) return;
    setNoteSaving(true);
    setNoteError(null);
    try {
      const conversationId = await ensureConversationId();
      const headers = await authHeaders();
      if (!headers) {
        setNoteError("Sign in again, then retry.");
        return;
      }
      const res = await fetch(
        `/api/messaging/conversations/${encodeURIComponent(conversationId)}`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ channel: "comment", body: text }),
        }
      );
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: MessageRow;
      };
      if (!res.ok || !body.message) {
        setNoteError(body.error || "Could not save note.");
        return;
      }
      const saved: MessageRow = {
        ...body.message,
        conversation_id: conversationId,
        channel: body.message.channel || "system",
      };
      setMessages((prev) => [...prev, saved]);
      setNoteDraft("");
      window.dispatchEvent(
        new CustomEvent(PROSPECT_INTERNAL_NOTE_EVENT, {
          detail: { conversationId, message: saved },
        })
      );
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : "Could not save note.");
    } finally {
      setNoteSaving(false);
    }
  }, [authHeaders, ensureConversationId, noteDraft, noteSaving]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-end justify-between gap-3 border-b border-slate-200 px-5">
        <nav
          className="flex min-w-0 flex-1 items-end gap-5"
          role="tablist"
          aria-label="Prospect record"
        >
          {TABS.map((item) => {
            const selected = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`${tabId}-${item.id}`}
                aria-selected={selected}
                aria-controls={`${tabId}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setTab(item.id)}
                className={`-mb-px shrink-0 border-b-2 pb-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                  selected
                    ? "border-sky-600 text-sky-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={() => void load()}
          aria-label="Refresh"
          className="mb-2.5 inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-50 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-40"
          disabled={loading}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            aria-hidden
          />
        </button>
      </div>

      <div
        id={`${tabId}-panel`}
        role="tabpanel"
        aria-labelledby={`${tabId}-${tab}`}
        className="flex min-h-0 flex-1 flex-col"
      >
        {tab === "notes" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 border-b border-slate-100 px-5 py-4">
              <label className="sr-only" htmlFor={`${tabId}-note`}>
                Add a note
              </label>
              <textarea
                id={`${tabId}-note`}
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    void saveNote();
                  }
                }}
                rows={3}
                placeholder="Add a private note…"
                className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-400"
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                {noteError ? (
                  <p className="min-w-0 text-xs text-rose-600">{noteError}</p>
                ) : (
                  <p className="text-[11px] text-slate-400">
                    Internal only. ⌘↵ to save
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => void saveNote()}
                  disabled={noteSaving || !noteDraft.trim()}
                  className="shrink-0 rounded-md bg-sky-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {noteSaving ? "Saving…" : "Add note"}
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-3">
              {loading ? (
                <PaneSkeleton />
              ) : error ? (
                <p className="text-sm text-rose-600">{error}</p>
              ) : notes.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No notes yet. Add a private note about this prospect.
                </p>
              ) : (
                <ul>
                  {notes.map((note) => {
                    const writtenBy = noteAuthor(note, author);
                    return (
                    <li
                      key={note.id}
                      className="flex gap-3 border-b border-slate-100 py-3 last:border-b-0"
                    >
                      {writtenBy.avatarUrl ? (
                        <img
                          src={writtenBy.avatarUrl}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-slate-200/80"
                        />
                      ) : (
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-[10px] font-semibold text-sky-800">
                          {prospectInitials(writtenBy.name)}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {writtenBy.name}
                          </p>
                          <p className="shrink-0 text-[11px] text-slate-400">
                            {formatRelativeAgo(note.created_at)}
                          </p>
                        </div>
                        <p className="mt-0.5 whitespace-pre-wrap text-sm leading-5 text-slate-700">
                          {(note.body_text || "").trim() || "(empty)"}
                        </p>
                      </div>
                    </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        ) : tab === "calls" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
              <p className="text-[13px] text-slate-500">
                {calls.length === 1 ? "1 call" : `${calls.length} calls`}
              </p>
              {prospect ? (
                <button
                  type="button"
                  onClick={() => setBookingOpen(true)}
                  className="rounded-md bg-sky-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-sky-700"
                >
                  Book a call
                </button>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
              {loading ? (
                <PaneSkeleton />
              ) : error ? (
                <p className="text-sm text-rose-600">{error}</p>
              ) : calls.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No calls yet. Book a discovery or follow-up from here.
                </p>
              ) : (
                <div className="space-y-5">
                  {upcomingCalls.length > 0 ? (
                    <section>
                      <p className="mb-2 text-[11px] font-medium text-slate-400">
                        Upcoming
                      </p>
                      <ul className="space-y-2">
                        {upcomingCalls.map((call) => (
                          <CallRowItem key={call.id} call={call} />
                        ))}
                      </ul>
                    </section>
                  ) : null}
                  {pastCalls.length > 0 ? (
                    <section>
                      <p className="mb-2 text-[11px] font-medium text-slate-400">
                        Past
                      </p>
                      <ul className="space-y-2">
                        {pastCalls.map((call) => (
                          <CallRowItem key={call.id} call={call} />
                        ))}
                      </ul>
                    </section>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
            {loading ? (
              <PaneSkeleton />
            ) : error ? (
              <p className="text-sm text-rose-600">{error}</p>
            ) : activityGroups.length === 0 ? (
              <p className="text-sm text-slate-500">
                No activity yet. Leads, campaigns, assessments, and bookings
                will show up here.
              </p>
            ) : (
              <div>
                {activityGroups.map((group, groupIndex) => (
                  <section
                    key={group.label}
                    className={groupIndex > 0 ? "mt-1" : undefined}
                  >
                    <p className="mb-2 pl-9 text-[11px] font-medium text-slate-400">
                      {group.label}
                    </p>
                    <ol>
                      {group.items.map((event, itemIndex) => {
                        const isLast =
                          groupIndex === activityGroups.length - 1 &&
                          itemIndex === group.items.length - 1;
                        const row = (
                          <>
                            <span className="flex w-6 shrink-0 flex-col items-center">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500">
                                {eventIcon(event.type)}
                              </span>
                              {!isLast ? (
                                <span
                                  className="mt-1 w-px flex-1 bg-slate-200"
                                  aria-hidden
                                />
                              ) : null}
                            </span>
                            <span
                              className={`min-w-0 flex-1 ${isLast ? "pb-0" : "pb-5"}`}
                            >
                              <span className="flex items-start justify-between gap-2">
                                <span className="min-w-0 pt-0.5 text-sm font-medium leading-5 text-slate-800">
                                  {event.title}
                                </span>
                                <span className="shrink-0 pt-0.5 text-[11px] tabular-nums text-slate-400">
                                  {formatShortTime(event.at)}
                                </span>
                              </span>
                              {event.detail ? (
                                <span className="mt-0.5 block text-xs text-slate-500">
                                  {event.detail}
                                </span>
                              ) : null}
                            </span>
                          </>
                        );
                        return (
                          <li key={event.id} className="flex">
                            {event.href ? (
                              <a
                                href={event.href}
                                target={
                                  event.href.startsWith("http")
                                    ? "_blank"
                                    : undefined
                                }
                                rel={
                                  event.href.startsWith("http")
                                    ? "noreferrer"
                                    : undefined
                                }
                                className="flex min-w-0 flex-1 gap-3 rounded-md hover:text-sky-800"
                              >
                                {row}
                              </a>
                            ) : (
                              <div className="flex min-w-0 flex-1 gap-3">
                                {row}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  </section>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {bookingOpen && prospect ? (
        <BookProspectModal
          prospect={prospect}
          onClose={() => setBookingOpen(false)}
          onBooked={(row, nextCall) => {
            setBookingOpen(false);
            onProspectBooked?.(row, nextCall);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}

function CallRowItem({ call }: { call: CallRow }) {
  return (
    <li className="rounded-lg border border-slate-200/80 bg-white px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-800">{call.title}</p>
        <p className="shrink-0 text-[11px] font-medium capitalize text-slate-500">
          {callStatusLabel(call.status)}
        </p>
      </div>
      <p className="mt-0.5 text-xs text-slate-500">
        {formatShortDateTime(call.startsAt)}
      </p>
      {call.meetingJoinUrl ? (
        <a
          href={call.meetingJoinUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-1.5 inline-block text-xs font-medium text-sky-700 hover:text-sky-800"
        >
          Join meeting
        </a>
      ) : null}
    </li>
  );
}
