"use client";

import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  MessageSquare,
  Plus,
  Send,
  Shield,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { notifyFeedbackCountsChanged } from "@/components/layout/useNewFeedbackCount";
import { profileInitialsFromName } from "@/lib/communityProfile";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  SUPPORT_STATUS_USER_LABELS,
  SUPPORT_TYPE_LABELS,
  authorDisplayName,
  formatSupportRelativeAgo,
  formatSupportTicketDate,
  formatSupportTicketId,
  isSupportStaffAuthor,
  type SupportReply,
  type SupportTicket,
  type SupportTicketStatus,
  type SupportTicketType,
} from "@/lib/support/tickets";

type SupportTicketsPageProps = {
  /** Base path prefix for this surface (`/coach` or `/admin`). */
  prefix?: "/coach" | "/admin";
};

type TicketWithReplies = SupportTicket & {
  replies: SupportReply[];
};

const TYPE_OPTIONS: { value: SupportTicketType; label: string }[] = [
  { value: "bug", label: "Bug report" },
  { value: "feature", label: "Feature request" },
  { value: "general", label: "General" },
];

function StatusBadge({ status }: { status: SupportTicketStatus }) {
  const label = SUPPORT_STATUS_USER_LABELS[status];
  if (status === "resolved") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200/80">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
        {label}
      </span>
    );
  }
  if (status === "in_review") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800 ring-1 ring-inset ring-sky-200/80">
        <Clock className="h-3.5 w-3.5" aria-hidden />
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 ring-1 ring-inset ring-amber-200/80">
      <Clock className="h-3.5 w-3.5" aria-hidden />
      {label}
    </span>
  );
}

function normalizeAuthor(
  author:
    | SupportReply["author"]
    | SupportReply["author"][]
    | null
    | undefined
): SupportReply["author"] {
  if (!author) return null;
  return Array.isArray(author) ? (author[0] ?? null) : author;
}

export function SupportTicketsPage(_props: SupportTicketsPageProps = {}) {
  const [tickets, setTickets] = useState<TicketWithReplies[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userInitials, setUserInitials] = useState("YO");
  const [composeOpen, setComposeOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [subject, setSubject] = useState("");
  const [type, setType] = useState<SupportTicketType>("bug");
  const [description, setDescription] = useState("");
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [draftByTicket, setDraftByTicket] = useState<Record<string, string>>({});
  const [replyBusyId, setReplyBusyId] = useState<string | null>(null);
  const [replyErrorByTicket, setReplyErrorByTicket] = useState<
    Record<string, string | null>
  >({});

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    if (!user?.id) {
      setTickets([]);
      setUserId(null);
      setError("Could not determine your account.");
      setLoading(false);
      return;
    }
    setUserId(user.id);

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("full_name, first_name, last_name")
      .eq("id", user.id)
      .maybeSingle();

    const name =
      profile?.full_name?.trim() ||
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
      user.email ||
      "You";
    setUserInitials(profileInitialsFromName(name));

    const { data: reports, error: reportsError } = await supabaseClient
      .from("community_feedback_reports")
      .select(
        "id, created_at, created_by, ticket_number, type, title, details, page_path, status"
      )
      .eq("created_by", user.id)
      .order("created_at", { ascending: false });

    if (reportsError) {
      setTickets([]);
      setError(reportsError.message);
      setLoading(false);
      return;
    }

    const list = (reports ?? []) as SupportTicket[];
    if (list.length === 0) {
      setTickets([]);
      setLoading(false);
      return;
    }

    const ids = list.map((t) => t.id);
    const { data: replies, error: repliesError } = await supabaseClient
      .from("community_feedback_replies")
      .select(
        `
        id,
        created_at,
        report_id,
        created_by,
        body,
        author:profiles!created_by ( id, full_name, first_name, last_name, role )
      `
      )
      .in("report_id", ids)
      .order("created_at", { ascending: true });

    if (repliesError) {
      setTickets([]);
      setError(repliesError.message);
      setLoading(false);
      return;
    }

    const repliesByReport = new Map<string, SupportReply[]>();
    for (const raw of replies ?? []) {
      const reply: SupportReply = {
        id: raw.id,
        created_at: raw.created_at,
        report_id: raw.report_id,
        created_by: raw.created_by,
        body: raw.body,
        author: normalizeAuthor(raw.author),
      };
      const bucket = repliesByReport.get(reply.report_id) ?? [];
      bucket.push(reply);
      repliesByReport.set(reply.report_id, bucket);
    }

    setTickets(
      list.map((ticket) => ({
        ...ticket,
        replies: repliesByReport.get(ticket.id) ?? [],
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const canSubmit = subject.trim().length > 0 && description.trim().length > 0;

  async function submitTicket(e: FormEvent) {
    e.preventDefault();
    if (submitBusy || !canSubmit) return;
    setSubmitBusy(true);
    setSubmitError(null);

    try {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (!user?.id) throw new Error("Could not determine your account.");

      const { data, error: insertError } = await supabaseClient
        .from("community_feedback_reports")
        .insert({
          created_by: user.id,
          type,
          title: subject.trim(),
          details: description.trim(),
          page_path:
            typeof window !== "undefined"
              ? window.location.pathname + window.location.search
              : null,
          user_agent:
            typeof navigator !== "undefined" ? navigator.userAgent : null,
        })
        .select(
          "id, created_at, created_by, ticket_number, type, title, details, page_path, status"
        )
        .single();

      if (insertError) throw insertError;

      const created = data as SupportTicket;
      setTickets((current) => [{ ...created, replies: [] }, ...current]);
      setSubject("");
      setType("bug");
      setDescription("");
      setComposeOpen(false);
      setExpandedId(created.id);
      notifyFeedbackCountsChanged();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Could not send ticket."
      );
    } finally {
      setSubmitBusy(false);
    }
  }

  async function sendReply(ticketId: string) {
    const body = (draftByTicket[ticketId] ?? "").trim();
    if (!body || replyBusyId || !userId) return;

    setReplyBusyId(ticketId);
    setReplyErrorByTicket((current) => ({ ...current, [ticketId]: null }));

    try {
      const { data, error: insertError } = await supabaseClient
        .from("community_feedback_replies")
        .insert({
          report_id: ticketId,
          created_by: userId,
          body,
        })
        .select(
          `
          id,
          created_at,
          report_id,
          created_by,
          body,
          author:profiles!created_by ( id, full_name, first_name, last_name, role )
        `
        )
        .single();

      if (insertError) throw insertError;

      const reply: SupportReply = {
        id: data.id,
        created_at: data.created_at,
        report_id: data.report_id,
        created_by: data.created_by,
        body: data.body,
        author: normalizeAuthor(data.author),
      };

      setTickets((current) =>
        current.map((ticket) =>
          ticket.id === ticketId
            ? { ...ticket, replies: [...ticket.replies, reply] }
            : ticket
        )
      );
      setDraftByTicket((current) => ({ ...current, [ticketId]: "" }));
    } catch (err) {
      setReplyErrorByTicket((current) => ({
        ...current,
        [ticketId]:
          err instanceof Error ? err.message : "Could not send message.",
      }));
    } finally {
      setReplyBusyId(null);
    }
  }

  const empty = !loading && tickets.length === 0;

  const headerActions = useMemo(
    () => (
      <button
        type="button"
        onClick={() => setComposeOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-800"
      >
        <Plus className="h-4 w-4" aria-hidden />
        Raise new ticket
      </button>
    ),
    []
  );

  return (
    <div className="mx-auto w-full max-w-3xl pt-5 lg:pt-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Support
          </h1>
          <p className="mt-1.5 text-base text-slate-600">
            Raise a ticket and we&apos;ll get back to you. Track open
            conversations below.
          </p>
        </div>
        {headerActions}
      </div>

      {composeOpen ? (
        <div className="mb-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-3 sm:p-4">
          <form
            onSubmit={(e) => void submitTicket(e)}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">
                New ticket
              </h2>
              <button
                type="button"
                onClick={() => {
                  if (submitBusy) return;
                  setComposeOpen(false);
                  setSubmitError(null);
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close new ticket"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="support-subject"
                  className="mb-1.5 block text-sm font-semibold text-slate-700"
                >
                  Subject
                </label>
                <input
                  id="support-subject"
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  placeholder="A short summary of what's going on..."
                />
              </div>

              <div>
                <label
                  htmlFor="support-type"
                  className="mb-1.5 block text-sm font-semibold text-slate-700"
                >
                  Type
                </label>
                <select
                  id="support-type"
                  value={type}
                  onChange={(e) =>
                    setType(e.target.value as SupportTicketType)
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                >
                  {TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="support-description"
                  className="mb-1.5 block text-sm font-semibold text-slate-700"
                >
                  Description
                </label>
                <textarea
                  id="support-description"
                  required
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full resize-y rounded-lg border border-slate-300 px-3.5 py-2.5 text-base leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  placeholder="What happened? What were you trying to do? Anything that helps us help you faster."
                />
              </div>

              {submitError ? (
                <p className="text-sm text-rose-600">{submitError}</p>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={submitBusy}
                  onClick={() => {
                    setComposeOpen(false);
                    setSubmitError(null);
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitBusy || !canSubmit}
                  className="rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white"
                >
                  {submitBusy ? "Sending..." : "Send ticket"}
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}

      {error ? (
        <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading your tickets...</p>
      ) : empty ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
          <MessageSquare
            className="mx-auto h-8 w-8 text-slate-300"
            aria-hidden
          />
          <p className="mt-3 text-base font-medium text-slate-800">
            No support tickets yet
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Raise a ticket and we&apos;ll reply here in the conversation.
          </p>
          {!composeOpen ? (
            <button
              type="button"
              onClick={() => setComposeOpen(true)}
              className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-sky-800"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Raise new ticket
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-4">
          {tickets.map((ticket) => {
            const expanded = expandedId === ticket.id;
            const messageCount = ticket.replies.length;
            const draft = draftByTicket[ticket.id] ?? "";
            const replyBusy = replyBusyId === ticket.id;
            const replyError = replyErrorByTicket[ticket.id];

            return (
              <li
                key={ticket.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-xl font-semibold leading-snug text-slate-900">
                      {ticket.title?.trim() || "(No subject)"}
                    </h2>
                    <StatusBadge status={ticket.status} />
                  </div>

                  <p className="mt-1.5 text-sm text-slate-500">
                    {formatSupportTicketId(ticket.ticket_number)}
                    {" · "}
                    {SUPPORT_TYPE_LABELS[ticket.type]}
                    {" · "}
                    {formatSupportTicketDate(ticket.created_at)}
                  </p>

                  {ticket.details.trim() ? (
                    <p className="mt-4 whitespace-pre-wrap text-base leading-relaxed text-slate-800">
                      {ticket.details}
                    </p>
                  ) : null}

                  {ticket.page_path ? (
                    <p className="mt-3 break-all text-sm text-slate-500">
                      Page:{" "}
                      <span className="font-mono text-[13px]">
                        {ticket.page_path}
                      </span>
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 sm:px-6">
                  <p className="text-sm text-slate-500">
                    Submitted {formatSupportRelativeAgo(ticket.created_at)}
                  </p>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() =>
                      setExpandedId((current) =>
                        current === ticket.id ? null : ticket.id
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <MessageSquare className="h-4 w-4 text-slate-500" aria-hidden />
                    Chat
                    {expanded ? (
                      <ChevronUp className="h-4 w-4 text-slate-400" aria-hidden />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden />
                    )}
                  </button>
                </div>

                {expanded ? (
                  <div className="border-t border-slate-100 bg-slate-50/40 px-5 py-4 sm:px-6">
                    <div className="rounded-xl border border-slate-200 bg-white">
                      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                        <MessageSquare
                          className="h-4 w-4 text-slate-400"
                          aria-hidden
                        />
                        <h3 className="text-sm font-semibold text-slate-800">
                          Conversation ({messageCount}{" "}
                          {messageCount === 1 ? "message" : "messages"})
                        </h3>
                      </div>

                      <div className="space-y-4 px-4 py-4">
                        {messageCount === 0 ? (
                          <p className="text-sm text-slate-500">
                            No replies yet. Add a follow-up below, or wait for
                            the support team.
                          </p>
                        ) : (
                          ticket.replies.map((reply) => {
                            const staff = isSupportStaffAuthor(reply.author);
                            const mine = reply.created_by === userId;
                            const name = staff
                              ? "Support Team"
                              : mine
                                ? "You"
                                : authorDisplayName(reply.author);

                            if (mine && !staff) {
                              return (
                                <div
                                  key={reply.id}
                                  className="flex items-end justify-end gap-2.5"
                                >
                                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-slate-100 px-3.5 py-2.5">
                                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                                      {reply.body}
                                    </p>
                                    <p className="mt-1.5 text-right text-xs text-slate-500">
                                      {name} ·{" "}
                                      {formatSupportRelativeAgo(reply.created_at)}
                                    </p>
                                  </div>
                                  <span
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-300 text-[11px] font-semibold text-slate-700"
                                    aria-hidden
                                  >
                                    {userInitials}
                                  </span>
                                </div>
                              );
                            }

                            return (
                              <div
                                key={reply.id}
                                className="flex items-end gap-2.5"
                              >
                                <span
                                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-700 text-white"
                                  aria-hidden
                                >
                                  <Shield className="h-4 w-4" />
                                </span>
                                <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm">
                                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                                    {reply.body}
                                  </p>
                                  <p className="mt-1.5 text-xs text-slate-500">
                                    {name} ·{" "}
                                    {formatSupportRelativeAgo(reply.created_at)}
                                  </p>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {ticket.status !== "resolved" ? (
                        <div className="border-t border-slate-100 px-4 py-3">
                          <div className="flex items-end gap-2">
                            <textarea
                              rows={2}
                              value={draft}
                              onChange={(e) =>
                                setDraftByTicket((current) => ({
                                  ...current,
                                  [ticket.id]: e.target.value,
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  void sendReply(ticket.id);
                                }
                              }}
                              placeholder="Type your message..."
                              className="min-h-[2.75rem] flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                            />
                            <button
                              type="button"
                              disabled={replyBusy || !draft.trim()}
                              onClick={() => void sendReply(ticket.id)}
                              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-700 text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                              aria-label="Send message"
                            >
                              <Send className="h-4 w-4" aria-hidden />
                            </button>
                          </div>
                          {replyError ? (
                            <p className="mt-2 text-sm text-rose-600">
                              {replyError}
                            </p>
                          ) : (
                            <p className="mt-2 text-xs text-slate-400">
                              Press Enter to send, Shift+Enter for new line
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="border-t border-slate-100 px-4 py-3">
                          <p className="text-sm text-slate-500">
                            This ticket is resolved. Raise a new ticket if you
                            still need help.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
