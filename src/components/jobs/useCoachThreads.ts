"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useDashboardProfile } from "@/components/layout/useDashboardProfile";
import { COACH_SUPPORT_READ_CHANGED } from "@/components/layout/useNewFeedbackCount";
import type { ThreadActivity } from "@/components/messages/channelParts";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { coachPersonaForCommunity, getCommunityAuthorId } from "@/lib/communityEffectiveAuthorId";
import {
  SUPPORT_AUTHOR_SELECT,
  SUPPORT_OPENING_SEEN_SELECT,
  SUPPORT_REPLY_LIST_SELECT,
  normalizeSupportAuthor,
  mapSupportReplyRow,
  mapSupportTicketRow,
  type SupportReply,
  type SupportTicket,
  type SupportTicketAuthor,
} from "@/lib/support/tickets";
import { supabaseClient } from "@/lib/supabaseClient";

/**
 * `context_path`: the page the chat is about, when BCA or the AI linked one (5 Nov).
 * `opener`: who at BCA wrote the first message, when BCA started the chat.
 */
export type ProjectThread = SupportTicket & {
  replies: SupportReply[];
  topic: string | null;
  context_path: string | null;
  opener?: SupportTicketAuthor | null;
};

export function activityOf(replies: SupportReply[]): ThreadActivity | undefined {
  if (replies.length === 0) return undefined;
  const people: ThreadActivity["people"] = [];
  for (const reply of [...replies].reverse()) {
    if (people.length >= 3 || people.some((p) => p.id === reply.created_by)) continue;
    people.push({
      id: reply.created_by,
      label: reply.author?.full_name?.trim() || reply.author?.first_name?.trim() || "?",
      avatarUrl: reply.author?.avatar_url ?? null,
    });
  }
  return { count: replies.length, lastAt: replies[replies.length - 1].created_at, people };
}

/**
 * The coach whose project this is (the signed-in coach, or the coach an admin
 * is viewing as) and their message threads, the same store as Messages.
 */
export function useCoachThreads() {
  const pathname = usePathname();
  const { impersonatingCoachId } = useImpersonation();
  const { profile } = useDashboardProfile();
  const viewerIsAdmin = profile?.role === "admin" ? true : profile ? false : null;
  const persona = coachPersonaForCommunity(pathname, impersonatingCoachId, viewerIsAdmin);

  const [coachId, setCoachId] = useState<string | null>(null);
  const [coach, setCoach] = useState<SupportTicketAuthor | null>(null);
  const [threads, setThreads] = useState<ProjectThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Coaches read their own; admins read the coach they are viewing as.
    if (viewerIsAdmin === null) return;
    setError(null);
    const authorId = await getCommunityAuthorId(persona);
    if (!authorId) {
      setError("Could not work out whose project to show.");
      setLoading(false);
      return;
    }
    setCoachId(authorId);
    const { data: profileRow } = await supabaseClient
      .from("profiles")
      .select(SUPPORT_AUTHOR_SELECT)
      .eq("id", authorId)
      .maybeSingle();
    const author: SupportTicketAuthor = {
      id: authorId,
      full_name: profileRow?.full_name ?? null,
      first_name: profileRow?.first_name ?? null,
      last_name: profileRow?.last_name ?? null,
      avatar_url: profileRow?.avatar_url ?? null,
      role: profileRow?.role ?? null,
    };
    setCoach(author);

    const { data: reports, error: reportsError } = await supabaseClient
      .from("community_feedback_reports")
      .select(
        `id, created_at, created_by, created_by_admin, source, ticket_number, type, title, details, page_path, status, media, coach_last_read_at, member_notify_email, topic, context_path, ${SUPPORT_OPENING_SEEN_SELECT}, author:profiles!created_by (${SUPPORT_AUTHOR_SELECT}), opener:profiles!created_by_admin (${SUPPORT_AUTHOR_SELECT})`
      )
      .eq("created_by", authorId)
      .order("created_at", { ascending: true });
    if (reportsError) {
      setError(reportsError.message);
      setLoading(false);
      return;
    }
    const ids = (reports ?? []).map((r) => r.id);
    const { data: replies } = ids.length
      ? await supabaseClient
          .from("community_feedback_replies")
          .select(SUPPORT_REPLY_LIST_SELECT)
          .in("report_id", ids)
          .order("created_at", { ascending: true })
      : { data: [] };
    const byReport = new Map<string, SupportReply[]>();
    for (const raw of replies ?? []) {
      const reply = mapSupportReplyRow(raw);
      byReport.set(reply.report_id, [...(byReport.get(reply.report_id) ?? []), reply]);
    }
    setThreads(
      (reports ?? []).map((row) => ({
        ...mapSupportTicketRow(row, { fallbackAuthor: author }),
        replies: byReport.get(row.id) ?? [],
        topic: (row as { topic?: string | null }).topic ?? null,
        context_path: (row as { context_path?: string | null }).context_path ?? null,
        opener: normalizeSupportAuthor((row as { opener?: SupportTicketAuthor | SupportTicketAuthor[] | null }).opener),
      }))
    );
    setLoading(false);
  }, [persona, viewerIsAdmin]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load the coach's threads once we know who they are
    void load();
    // A question read or answered elsewhere (the Inbox, Support) updates every copy, like the menu's count.
    const reload = () => void load();
    window.addEventListener(COACH_SUPPORT_READ_CHANGED, reload);
    return () => window.removeEventListener(COACH_SUPPORT_READ_CHANGED, reload);
  }, [load]);

  return { viewerIsAdmin, coachId, coach, threads, setThreads, loading, error, reload: load };
}
