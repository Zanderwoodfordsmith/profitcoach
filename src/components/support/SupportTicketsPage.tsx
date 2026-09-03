"use client";

import { MessageSquare } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { profileInitialsFromName } from "@/lib/communityProfile";
import { notifyCoachSupportReadChanged } from "@/components/layout/useNewFeedbackCount";
import { SupportCreateTicketComposer } from "@/components/support/SupportCreateTicketComposer";
import { SupportTicketCard } from "@/components/support/SupportTicketCard";
import { SupportTicketDetailModal } from "@/components/support/SupportTicketDetailModal";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  SUPPORT_AUTHOR_SELECT,
  normalizeSupportAuthor,
  mapSupportTicketRow,
  normalizeSupportTicketType,
  ticketHasUnreadStaffReply,
  type SupportReply,
  type SupportTicket,
  type SupportTicketAuthor,
} from "@/lib/support/tickets";

type TicketWithReplies = SupportTicket & {
  replies: SupportReply[];
};

type SupportTicketsPageProps = {
  prefix?: "/coach" | "/admin";
};

export function SupportTicketsPage(_props: SupportTicketsPageProps = {}) {
  const [tickets, setTickets] = useState<TicketWithReplies[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<SupportTicketAuthor | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);

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
      .select(SUPPORT_AUTHOR_SELECT)
      .eq("id", user.id)
      .maybeSingle();

    const author: SupportTicketAuthor = {
      id: user.id,
      full_name: profile?.full_name ?? null,
      first_name: profile?.first_name ?? null,
      last_name: profile?.last_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      role: profile?.role ?? null,
    };
    setViewer(author);
    setAvatarUrl(author.avatar_url ?? null);

    const { data: reports, error: reportsError } = await supabaseClient
      .from("community_feedback_reports")
      .select(
        `id, created_at, created_by, ticket_number, type, title, details, page_path, status, media, coach_last_read_at, author:profiles!created_by (${SUPPORT_AUTHOR_SELECT})`
      )
      .eq("created_by", user.id)
      .order("created_at", { ascending: false });

    if (reportsError) {
      setTickets([]);
      setError(reportsError.message);
      setLoading(false);
      return;
    }

    const list = (reports ?? []).map((row) =>
      mapSupportTicketRow(row, { fallbackAuthor: author })
    );
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
        media,
        community_comment_id,
        author:profiles!created_by (${SUPPORT_AUTHOR_SELECT})
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
        media: raw.media,
        community_comment_id: raw.community_comment_id ?? null,
        author: normalizeSupportAuthor(raw.author),
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

  const markTicketRead = useCallback(async (ticketId: string) => {
    const readAt = new Date().toISOString();
    const { error: readError } = await supabaseClient.rpc(
      "mark_support_ticket_read",
      { p_report_id: ticketId }
    );
    if (readError) return;

    setTickets((current) =>
      current.map((ticket) =>
        ticket.id === ticketId
          ? { ...ticket, coach_last_read_at: readAt }
          : ticket
      )
    );
    notifyCoachSupportReadChanged();
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const openTicket = tickets.find((t) => t.id === openTicketId) ?? null;
  const empty = !loading && tickets.length === 0;
  const authorLabel =
    viewer?.full_name?.trim() ||
    [viewer?.first_name, viewer?.last_name].filter(Boolean).join(" ").trim() ||
    "You";

  return (
    <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-6 pt-2">
      {composeOpen ? (
        <button
          type="button"
          aria-label="Close composer overlay"
          onClick={() => setComposeOpen(false)}
          className="fixed inset-0 z-40 cursor-default bg-black/45"
        />
      ) : null}

      <div className={composeOpen ? "relative z-50" : undefined}>
        {composeOpen ? (
          <SupportCreateTicketComposer
            avatarUrl={avatarUrl}
            authorLabel={authorLabel}
            onClose={() => setComposeOpen(false)}
            onCreated={(created) => {
              setTickets((current) => [
                { ...created, replies: [], author: created.author ?? viewer },
                ...current,
              ]);
              setComposeOpen(false);
              setOpenTicketId(created.id);
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            className="mb-2 flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2 text-left shadow-[0_1px_2px_rgb(15_23_42/0.18),0_4px_10px_-2px_rgb(15_23_42/0.30)] transition hover:border-slate-300"
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
              />
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 ring-1 ring-slate-200">
                <span className="text-sm font-semibold text-slate-600">
                  {profileInitialsFromName(authorLabel)}
                </span>
              </span>
            )}
            <span className="min-w-0 flex-1 text-lg font-medium text-slate-700">
              Raise a ticket…
            </span>
          </button>
        )}
      </div>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading your tickets...</p>
      ) : empty ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
          <MessageSquare className="mx-auto h-8 w-8 text-slate-300" aria-hidden />
          <p className="mt-3 text-base font-medium text-slate-800">
            No support tickets yet
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Raise a ticket and we&apos;ll reply here in the conversation.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {tickets.map((ticket) => {
            const hasUnread =
              userId != null &&
              ticketHasUnreadStaffReply(ticket, ticket.replies, userId);
            return (
              <li key={ticket.id}>
                <SupportTicketCard
                  ticket={ticket}
                  author={ticket.author ?? viewer}
                  hasUnread={hasUnread}
                  onOpen={() => {
                    setOpenTicketId(ticket.id);
                    if (hasUnread) void markTicketRead(ticket.id);
                  }}
                />
              </li>
            );
          })}
        </ul>
      )}

      {openTicket && userId ? (
        <SupportTicketDetailModal
          ticket={openTicket}
          viewer={viewer}
          viewerId={userId}
          onClose={() => setOpenTicketId(null)}
          onTicketChange={(next) =>
            setTickets((current) =>
              current.map((ticket) => (ticket.id === next.id ? next : ticket))
            )
          }
        />
      ) : null}
    </div>
  );
}
