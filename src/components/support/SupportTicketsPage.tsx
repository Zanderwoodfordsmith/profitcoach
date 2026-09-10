"use client";

import { MessageSquare, Phone, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  coachPersonaForCommunity,
  getCommunityAuthorId,
} from "@/lib/communityEffectiveAuthorId";
import { notifyCoachSupportReadChanged } from "@/components/layout/useNewFeedbackCount";
import { useDashboardProfile } from "@/components/layout/useDashboardProfile";
import { SupportCreateTicketComposer } from "@/components/support/SupportCreateTicketComposer";
import { SupportTicketCard } from "@/components/support/SupportTicketCard";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { buildSupportCallPrefillQuery } from "@/lib/support/supportCallPrefill";
import { SUPPORT_CALL_HOSTS } from "@/lib/support/supportCallHosts";
import { supabaseClient } from "@/lib/supabaseClient";
import { isSupabaseAbortError } from "@/lib/supabaseErrorMessage";
import {
  SUPPORT_AUTHOR_SELECT,
  normalizeSupportAuthor,
  mapSupportTicketRow,
  ticketHasUnreadStaffReply,
  type SupportReply,
  type SupportTicket,
  type SupportTicketAuthor,
  type SupportTicketStatus,
} from "@/lib/support/tickets";

type TicketWithReplies = SupportTicket & {
  replies: SupportReply[];
};

type ListTab = "all" | "open" | "resolved";

type SupportTicketsPageProps = {
  prefix?: "/coach" | "/admin";
};

export function SupportTicketsPage(_props: SupportTicketsPageProps = {}) {
  const pathname = usePathname();
  const { impersonatingCoachId } = useImpersonation();
  const { profile } = useDashboardProfile();
  const viewerIsAdmin =
    profile?.role === "admin" ? true : profile ? false : null;
  const coachPersona = coachPersonaForCommunity(
    pathname,
    impersonatingCoachId,
    viewerIsAdmin
  );

  const [tickets, setTickets] = useState<TicketWithReplies[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<SupportTicketAuthor | null>(null);
  const [viewerEmail, setViewerEmail] = useState<string | null>(null);
  const [viewerPhone, setViewerPhone] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);
  const [tab, setTab] = useState<ListTab>("all");
  const loadGenerationRef = useRef(0);
  const expandedTicketIdRef = useRef<string | null>(null);
  const ticketIdsRef = useRef<Set<string>>(new Set());
  expandedTicketIdRef.current = expandedTicketId;
  ticketIdsRef.current = new Set(tickets.map((t) => t.id));

  const loadTickets = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    setLoading(true);
    setError(null);

    const authorId = await getCommunityAuthorId(coachPersona);
    if (generation !== loadGenerationRef.current) return;
    if (!authorId) {
      setTickets([]);
      setUserId(null);
      setError("Could not determine your account.");
      setLoading(false);
      return;
    }
    setUserId(authorId);

    const { data: profileRow } = await supabaseClient
      .from("profiles")
      .select(`${SUPPORT_AUTHOR_SELECT}, phone`)
      .eq("id", authorId)
      .maybeSingle();
    if (generation !== loadGenerationRef.current) return;

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    if (generation !== loadGenerationRef.current) return;

    const author: SupportTicketAuthor = {
      id: authorId,
      full_name: profileRow?.full_name ?? null,
      first_name: profileRow?.first_name ?? null,
      last_name: profileRow?.last_name ?? null,
      avatar_url: profileRow?.avatar_url ?? null,
      role: profileRow?.role ?? null,
    };
    setViewer(author);
    setViewerEmail(user?.email?.trim().toLowerCase() || null);
    setViewerPhone(
      typeof profileRow?.phone === "string" ? profileRow.phone.trim() || null : null
    );

    const { data: reports, error: reportsError } = await supabaseClient
      .from("community_feedback_reports")
      .select(
        `id, created_at, created_by, ticket_number, type, title, details, page_path, status, media, coach_last_read_at, member_notify_email, author:profiles!created_by (${SUPPORT_AUTHOR_SELECT})`
      )
      .eq("created_by", authorId)
      .order("created_at", { ascending: false });
    if (generation !== loadGenerationRef.current) return;

    if (reportsError) {
      if (isSupabaseAbortError(reportsError)) return;
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
        edited_at,
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
    if (generation !== loadGenerationRef.current) return;

    if (repliesError) {
      if (isSupabaseAbortError(repliesError)) return;
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
        edited_at: raw.edited_at ?? null,
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
  }, [coachPersona]);

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
    return () => {
      loadGenerationRef.current += 1;
    };
  }, [loadTickets]);

  useEffect(() => {
    if (!justCreatedId) return;
    const t = window.setTimeout(() => setJustCreatedId(null), 4000);
    return () => window.clearTimeout(t);
  }, [justCreatedId]);

  // Live replies + status while the member is on this page.
  useEffect(() => {
    if (!userId) return;

    const mergeIncomingReplies = (rows: SupportReply[]) => {
      if (rows.length === 0) return;
      setTickets((current) => {
        let changed = false;
        const next = current.map((ticket) => {
          const incoming = rows.filter((r) => r.report_id === ticket.id);
          if (incoming.length === 0) return ticket;
          const byId = new Map<string, SupportReply>();
          for (const r of ticket.replies) byId.set(r.id, r);
          for (const r of incoming) byId.set(r.id, r);
          const merged = [...byId.values()].sort(
            (a, b) =>
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          if (
            merged.length === ticket.replies.length &&
            merged.every((r, i) => {
              const prev = ticket.replies[i];
              return (
                prev != null &&
                prev.id === r.id &&
                prev.body === r.body &&
                (prev.edited_at ?? null) === (r.edited_at ?? null)
              );
            })
          ) {
            return ticket;
          }
          changed = true;
          return { ...ticket, replies: merged };
        });
        return changed ? next : current;
      });
    };

    const replaceRepliesFromFetch = (rows: SupportReply[]) => {
      setTickets((current) => {
        let changed = false;
        const next = current.map((ticket) => {
          const forTicket = rows
            .filter((r) => r.report_id === ticket.id)
            .sort(
              (a, b) =>
                new Date(a.created_at).getTime() -
                new Date(b.created_at).getTime()
            );
          if (
            forTicket.length === ticket.replies.length &&
            forTicket.every((r, i) => {
              const prev = ticket.replies[i];
              return (
                prev != null &&
                prev.id === r.id &&
                prev.body === r.body &&
                (prev.edited_at ?? null) === (r.edited_at ?? null)
              );
            })
          ) {
            return ticket;
          }
          changed = true;
          return { ...ticket, replies: forTicket };
        });
        return changed ? next : current;
      });
    };

    const fetchRepliesForTickets = async () => {
      const ids = [...ticketIdsRef.current];
      if (ids.length === 0) return;
      const { data, error: queryError } = await supabaseClient
        .from("community_feedback_replies")
        .select(
          `
          id,
          created_at,
          edited_at,
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
      if (queryError || !data) return;

      replaceRepliesFromFetch(
        data.map((raw) => ({
          id: raw.id,
          created_at: raw.created_at,
          edited_at: raw.edited_at ?? null,
          report_id: raw.report_id,
          created_by: raw.created_by,
          body: raw.body,
          media: raw.media,
          community_comment_id: raw.community_comment_id ?? null,
          author: normalizeSupportAuthor(raw.author),
        }))
      );
    };

    const channel = supabaseClient
      .channel(`coach-support-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "community_feedback_replies",
        },
        (payload) => {
          const raw = payload.new as {
            id: string;
            created_at: string;
            edited_at?: string | null;
            report_id: string;
            created_by: string;
            body: string;
            media: SupportReply["media"];
            community_comment_id?: string | null;
          };
          if (!raw?.id || !raw.report_id) return;
          if (!ticketIdsRef.current.has(raw.report_id)) return;

          void (async () => {
            const { data: authorRow } = await supabaseClient
              .from("profiles")
              .select(SUPPORT_AUTHOR_SELECT)
              .eq("id", raw.created_by)
              .maybeSingle();

            const reply: SupportReply = {
              id: raw.id,
              created_at: raw.created_at,
              edited_at: raw.edited_at ?? null,
              report_id: raw.report_id,
              created_by: raw.created_by,
              body: raw.body,
              media: raw.media,
              community_comment_id: raw.community_comment_id ?? null,
              author: normalizeSupportAuthor(authorRow),
            };

            mergeIncomingReplies([reply]);

            if (
              raw.created_by !== userId &&
              expandedTicketIdRef.current === raw.report_id
            ) {
              void markTicketRead(raw.report_id);
            } else if (raw.created_by !== userId) {
              notifyCoachSupportReadChanged();
            }
          })();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "community_feedback_replies",
        },
        (payload) => {
          const raw = payload.new as {
            id: string;
            created_at: string;
            edited_at?: string | null;
            report_id: string;
            created_by: string;
            body: string;
            media: SupportReply["media"];
            community_comment_id?: string | null;
          };
          if (!raw?.id || !raw.report_id) return;
          if (!ticketIdsRef.current.has(raw.report_id)) return;
          setTickets((current) =>
            current.map((ticket) => {
              if (ticket.id !== raw.report_id) return ticket;
              const idx = ticket.replies.findIndex((r) => r.id === raw.id);
              if (idx < 0) return ticket;
              const prev = ticket.replies[idx]!;
              if (
                prev.body === raw.body &&
                (prev.edited_at ?? null) === (raw.edited_at ?? null)
              ) {
                return ticket;
              }
              const nextReplies = [...ticket.replies];
              nextReplies[idx] = {
                ...prev,
                body: raw.body,
                media: raw.media,
                edited_at: raw.edited_at ?? null,
                community_comment_id:
                  raw.community_comment_id ?? prev.community_comment_id,
              };
              return { ...ticket, replies: nextReplies };
            })
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "community_feedback_replies",
        },
        (payload) => {
          const raw = payload.old as { id?: string; report_id?: string };
          if (!raw?.id) return;
          setTickets((current) =>
            current.map((ticket) => {
              if (raw.report_id && ticket.id !== raw.report_id) return ticket;
              if (!ticket.replies.some((r) => r.id === raw.id)) return ticket;
              return {
                ...ticket,
                replies: ticket.replies.filter((r) => r.id !== raw.id),
              };
            })
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "community_feedback_reports",
          filter: `created_by=eq.${userId}`,
        },
        (payload) => {
          const raw = payload.new as {
            id: string;
            status?: SupportTicketStatus;
            coach_last_read_at?: string | null;
          };
          if (!raw?.id) return;
          setTickets((current) =>
            current.map((ticket) =>
              ticket.id === raw.id
                ? {
                    ...ticket,
                    status: raw.status ?? ticket.status,
                    coach_last_read_at:
                      raw.coach_last_read_at ?? ticket.coach_last_read_at,
                  }
                : ticket
            )
          );
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          void fetchRepliesForTickets();
        }
      });

    void fetchRepliesForTickets();
    const pollId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchRepliesForTickets();
      }
    }, 2000);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void fetchRepliesForTickets();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(pollId);
      document.removeEventListener("visibilitychange", onVisible);
      void supabaseClient.removeChannel(channel);
    };
  }, [userId, markTicketRead]);

  const openCount = useMemo(
    () => tickets.filter((t) => t.status !== "resolved").length,
    [tickets]
  );
  const resolvedCount = useMemo(
    () => tickets.filter((t) => t.status === "resolved").length,
    [tickets]
  );

  const filtered = useMemo(() => {
    if (tab === "open") {
      return tickets.filter((t) => t.status !== "resolved");
    }
    if (tab === "resolved") {
      return tickets.filter((t) => t.status === "resolved");
    }
    return tickets;
  }, [tickets, tab]);

  const emptyAll = !loading && tickets.length === 0 && !composeOpen;
  const emptyTab = !loading && !emptyAll && filtered.length === 0 && !composeOpen;

  const supportCallPrefillQs = useMemo(
    () =>
      buildSupportCallPrefillQuery({
        firstName: viewer?.first_name,
        lastName: viewer?.last_name,
        email: viewerEmail,
        phone: viewerPhone,
      }),
    [viewer?.first_name, viewer?.last_name, viewerEmail, viewerPhone]
  );

  const tabBtn = (id: ListTab, label: string, count?: number) => (
    <button
      type="button"
      key={id}
      onClick={() => setTab(id)}
      className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
        tab === id
          ? "bg-white text-slate-900 shadow-sm"
          : "text-slate-500 hover:text-slate-800"
      }`}
    >
      {label}
      {count != null && !loading ? (
        <span className="ml-1.5 tabular-nums text-slate-400">{count}</span>
      ) : null}
    </button>
  );

  return (
    <div className="flex w-full min-w-0 flex-col gap-5 pt-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          {tabBtn("all", "All", tickets.length)}
          {tabBtn("open", "Open", openCount)}
          {tabBtn("resolved", "Resolved", resolvedCount)}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {SUPPORT_CALL_HOSTS.map((host) => (
            <Link
              key={host.slug}
              href={`${host.path}${supportCallPrefillQs}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Phone className="h-4 w-4 text-teal-700" aria-hidden />
              Call {host.displayName}
            </Link>
          ))}
          <button
            type="button"
            disabled={composeOpen}
            onClick={() => setComposeOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Raise new ticket
          </button>
        </div>
      </div>

      {composeOpen ? (
        <SupportCreateTicketComposer
          authorId={userId}
          onClose={() => setComposeOpen(false)}
          onCreated={(created) => {
            setTickets((current) => [
              {
                ...created,
                replies: [],
                author: created.author ?? viewer,
              },
              ...current,
            ]);
            setComposeOpen(false);
            setTab("all");
            setJustCreatedId(created.id);
            setExpandedTicketId(null);
          }}
        />
      ) : null}

      {justCreatedId ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Ticket submitted. We&apos;ll reply on this page.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading your tickets…</p>
      ) : emptyAll ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <MessageSquare
            className="mx-auto h-8 w-8 text-slate-300"
            aria-hidden
          />
          <p className="mt-3 text-base font-medium text-slate-800">
            No tickets yet
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Raise a ticket and we&apos;ll get back to you here.
          </p>
          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-sky-800"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Raise new ticket
          </button>
        </div>
      ) : emptyTab ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-800">
            {tab === "open"
              ? "No open tickets"
              : tab === "resolved"
                ? "No resolved tickets"
                : "No tickets"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {tab === "open"
              ? "Nothing waiting right now — check All to see resolved ones."
              : tab === "resolved"
                ? "Nothing marked resolved yet."
                : "Raise a ticket to get started."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((ticket) => {
            const hasUnread =
              userId != null &&
              ticketHasUnreadStaffReply(ticket, ticket.replies, userId);
            const expanded = expandedTicketId === ticket.id;
            return (
              <li key={ticket.id}>
                <SupportTicketCard
                  ticket={ticket}
                  expanded={expanded}
                  viewer={viewer}
                  viewerId={userId!}
                  onToggle={() => {
                    if (expanded) {
                      setExpandedTicketId(null);
                      return;
                    }
                    setExpandedTicketId(ticket.id);
                    if (hasUnread) void markTicketRead(ticket.id);
                  }}
                  onTicketChange={(next) =>
                    setTickets((current) =>
                      current.map((row) => (row.id === next.id ? next : row))
                    )
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
