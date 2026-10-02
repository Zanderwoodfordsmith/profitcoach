"use client";

import { ArrowLeft, CheckCircle2, ChevronDown, Circle, Hourglass, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DateTime } from "luxon";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import "./supportWelcomeMotion.css";
import {
  coachPersonaForCommunity,
  getCommunityAuthorId,
} from "@/lib/communityEffectiveAuthorId";
import { notifyCoachSupportReadChanged } from "@/components/layout/useNewFeedbackCount";
import { useDashboardProfile } from "@/components/layout/useDashboardProfile";
import { CommunityPostMediaGallery } from "@/components/community/CommunityPostMediaGallery";
import { SupportOpeningBody } from "@/components/support/SeeMoreText";
import { SupportChatAvatar } from "@/components/support/SupportChatBubbles";
import { SupportCreateTicketComposer } from "@/components/support/SupportCreateTicketComposer";
import {
  SupportHelpfulPanel,
  SupportTicketActions,
  type SupportTicketFeedback,
} from "@/components/support/SupportHelpfulPanel";
import { SupportTicketChat } from "@/components/support/SupportTicketChat";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { supabaseClient } from "@/lib/supabaseClient";
import { expandCommunityCalendar } from "@/lib/communityCalendarExpand";
import { loadCommunityCalendarData } from "@/lib/communityCalendarData";
import { defaultCommunityCalendarTimezone } from "@/lib/communityCalendarTimezones";
import { isSupabaseAbortError } from "@/lib/supabaseErrorMessage";
import { parseSupportTicketMedia } from "@/lib/support/supportTicketMedia";
import {
  SUPPORT_AUTHOR_SELECT,
  SUPPORT_REPLY_LIST_SELECT,
  formatSupportRelativeCompact,
  formatSupportTicketDate,
  mapSupportReplyRow,
  mapSupportTicketRow,
  COACH_SUPPORT_LIST_SECTIONS,
  coachSupportListSection,
  memberSupportStatusPresentation,
  supportTicketActivityAt,
  supportTicketListPreview,
  SUPPORT_TYPE_LABELS,
  ticketHasUnreadStaffReply,
  unreadStaffReplyCount,
  type CoachSupportListSection,
  type SupportReply,
  type SupportTicket,
  type SupportTicketAuthor,
  type SupportTicketStatus,
} from "@/lib/support/tickets";

type TicketWithReplies = SupportTicket & {
  replies: SupportReply[];
};

/** Faint wash on the sections that mean something. Waiting sections stay plain. */
/** Ease-out expo: most of the travel happens early, then it glides to a stop. */
function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function sectionHeaderTone(id: CoachSupportListSection): string {
  switch (id) {
    case "new":
      return "bg-sky-50 text-sky-800 hover:bg-sky-100";
    case "your_reply":
      return "bg-amber-50 text-amber-950 hover:bg-amber-100";
    case "resolved":
      return "bg-emerald-50 text-emerald-800 hover:bg-emerald-100";
    default:
      return "bg-slate-200/70 text-slate-600 hover:bg-slate-200";
  }
}

function calendarHrefFromCommunity(href: string): string {
  const path = href.split("?")[0] ?? href;
  return `${path}/calendar`;
}

function formatCallWhen(start: DateTime, zone: string): string {
  const now = DateTime.now().setZone(zone);
  const time = start.toFormat(start.minute === 0 ? "ha" : "h:mma").toLowerCase();
  if (start.hasSame(now, "day")) return `today, ${time}`;
  return `${start.toFormat("ccc d LLL")}, ${time}`;
}

function NextCallLine({ calendarHref }: { calendarHref: string }) {
  const [when, setWhen] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const zone = defaultCommunityCalendarTimezone();
    void (async () => {
      let events;
      let exceptions;
      try {
        ({ events, exceptions } = await loadCommunityCalendarData());
      } catch {
        return;
      }
      if (cancelled) return;
      const start = DateTime.now().setZone(zone).startOf("day");
      const occurrences = expandCommunityCalendar(
        events,
        start,
        start.plus({ days: 21 }).endOf("day"),
        exceptions
      );
      const nowMs = Date.now();
      const next = occurrences.find((occurrence) => {
        if (occurrence.isCancelled) return false;
        return new Date(occurrence.startsAtIso).getTime() > nowMs;
      });
      if (!next || cancelled) return;
      const when = formatCallWhen(
        DateTime.fromISO(next.startsAtIso, { zone: "utc" }).setZone(zone),
        zone
      );
      setWhen(when);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!when) return null;
  return (
    <div className="mt-6 flex justify-center">
      <Link
        href={calendarHref}
        className="inline-flex items-center rounded-full bg-emerald-50 px-3.5 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
      >
        Next support call · {when}
      </Link>
    </div>
  );
}

function SupportWelcome({
  firstName,
  communityHref,
  onNewTicket,
  composer,
}: {
  firstName: string | null;
  communityHref: string;
  onNewTicket: () => void;
  composer?: ReactNode;
}) {
  const name = firstName?.trim() || null;
  const open = composer != null;
  const greetingRef = useRef<HTMLDivElement>(null);
  const greetingTop = useRef<number | null>(null);

  useLayoutEffect(() => {
    const greeting = greetingRef.current;
    if (!greeting) return;
    const nextTop = greeting.getBoundingClientRect().top;
    const from = greetingTop.current;
    greetingTop.current = nextTop;
    if (from == null) return;
    const delta = from - nextTop;
    if (Math.abs(delta) < 2) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduce) return;
    const offsets = [0, 0.08, 0.18, 0.32, 0.5, 0.7, 1];
    greeting.animate(
      offsets.map((t) => ({
        offset: t,
        transform: `translateY(${(1 - easeOutExpo(t)) * delta}px)`,
      })),
      { duration: open ? 780 : 420, easing: "linear" }
    );
  }, [open]);

  return (
    <div
      className={`flex flex-1 flex-col items-center overflow-y-auto px-6 py-10 ${
        composer ? "justify-start" : "justify-center"
      }`}
    >
      <div
        className={`w-full text-center ${
          composer ? "max-w-3xl" : "max-w-xl"
        }`}
      >
        <div ref={greetingRef}>
          <h2 className="text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
            {name ? `Hi, ${name}` : "Hi"}
          </h2>
          <p className="mt-4 text-xl leading-snug text-slate-600">
            How can we help? Zander, Pam, and the other coaches are ready.
            No silly questions. Always ask.
          </p>
        </div>
        {composer ? (
          <div className="support-ticket-enter mt-8 text-left">{composer}</div>
        ) : (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onNewTicket}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-5 py-3 text-base font-semibold text-white hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
            >
              <Plus className="h-5 w-5" aria-hidden />
              New ticket
            </button>
            <Link
              href={communityHref}
              className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-base font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
            >
              Post in community
            </Link>
          </div>
        )}
        <ul className="mt-10 space-y-4 text-left">
          <li className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-slate-200">
              <img
                src="/support/zander.jpg"
                alt=""
                className="h-full w-full object-cover"
              />
            </span>
            <span className="min-w-0">
              <span className="block text-base font-semibold text-slate-900">
                Zander
              </span>
              <span className="mt-1 block text-base leading-snug text-slate-600">
                The app. Setup, bugs, and how things work in here.
              </span>
            </span>
          </li>
          <li className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-slate-200">
              <img
                src="/pam/pam-portrait.jpg"
                alt=""
                className="h-full w-full origin-top scale-[1.45] object-cover object-[center_18%]"
              />
            </span>
            <span className="min-w-0">
              <span className="block text-base font-semibold text-slate-900">
                Pam
              </span>
              <span className="mt-1 block text-base leading-snug text-slate-600">
                Coaching. Sessions, the method, and what to say to a client.
              </span>
            </span>
          </li>
        </ul>
        <p className="mt-5 text-base leading-snug text-slate-600">
          Don&apos;t worry who to ask. Just ask. We&apos;ll send it to the right
          person.
          <span className="block">
            We aim to reply within 2 business days.
          </span>
        </p>
        <NextCallLine calendarHref={calendarHrefFromCommunity(communityHref)} />
      </div>
    </div>
  );
}

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
  const [feedbackById, setFeedbackById] = useState<
    Record<string, SupportTicketFeedback>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<SupportTicketAuthor | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);
  const [sectionOpen, setSectionOpen] = useState<
    Partial<Record<CoachSupportListSection, boolean>>
  >({});
  const loadGenerationRef = useRef(0);
  const selectedTicketIdRef = useRef<string | null>(null);
  const ticketIdsRef = useRef<Set<string>>(new Set());
  const previewingMember = Boolean(coachPersona);
  selectedTicketIdRef.current = selectedTicketId;
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
      .select(SUPPORT_AUTHOR_SELECT)
      .eq("id", authorId)
      .maybeSingle();
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
      setFeedbackById({});
      setLoading(false);
      return;
    }

    const ids = list.map((t) => t.id);
    const { data: replies, error: repliesError } = await supabaseClient
      .from("community_feedback_replies")
      .select(SUPPORT_REPLY_LIST_SELECT)
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
      const reply = mapSupportReplyRow(raw);
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

    const { data: feedbackRows } = await supabaseClient
      .from("support_ticket_feedback")
      .select("report_id, helpful, comment, reply_id")
      .in("report_id", ids);
    if (generation !== loadGenerationRef.current) return;
    const nextFeedback: Record<string, SupportTicketFeedback> = {};
    for (const row of feedbackRows ?? []) {
      if (!row.report_id) continue;
      nextFeedback[row.report_id] = {
        helpful: Boolean(row.helpful),
        comment: row.comment ?? null,
        reply_id: row.reply_id ?? null,
      };
    }
    setFeedbackById(nextFeedback);
    setLoading(false);
  }, [coachPersona]);

  const markTicketRead = useCallback(async (ticketId: string) => {
    if (previewingMember) return;
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
  }, [previewingMember]);

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
        .select(SUPPORT_REPLY_LIST_SELECT)
        .in("report_id", ids)
        .order("created_at", { ascending: true });
      if (queryError || !data) return;

      replaceRepliesFromFetch(data.map((raw) => mapSupportReplyRow(raw)));
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
            via_email?: boolean | null;
          };
          if (!raw?.id || !raw.report_id) return;
          if (!ticketIdsRef.current.has(raw.report_id)) return;

          void (async () => {
            const { data: authorRow } = await supabaseClient
              .from("profiles")
              .select(SUPPORT_AUTHOR_SELECT)
              .eq("id", raw.created_by)
              .maybeSingle();

            const reply = mapSupportReplyRow({
              ...raw,
              author: authorRow,
            });

            mergeIncomingReplies([reply]);

            if (
              raw.created_by !== userId &&
              selectedTicketIdRef.current === raw.report_id
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
            via_email?: boolean | null;
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
                (prev.edited_at ?? null) === (raw.edited_at ?? null) &&
                Boolean(prev.via_email) === Boolean(raw.via_email)
              ) {
                return ticket;
              }
              const nextReplies = [...ticket.replies];
              nextReplies[idx] = {
                ...prev,
                body: raw.body,
                media: raw.media,
                edited_at: raw.edited_at ?? null,
                via_email: Boolean(raw.via_email),
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

  const communityHref = pathname?.startsWith("/admin")
    ? "/admin/community?compose=1"
    : "/coach/community?compose=1";
  const welcomeName = viewer?.first_name?.trim() || null;

  const memberFirstName = previewingMember
    ? viewer?.first_name?.trim() ||
      viewer?.full_name?.trim().split(/\s+/)[0] ||
      null
    : null;

  const sections = useMemo(() => {
    const buckets = new Map<CoachSupportListSection, TicketWithReplies[]>();
    for (const section of COACH_SUPPORT_LIST_SECTIONS) {
      buckets.set(section.id, []);
    }
    const rows = tickets.slice().sort((a, b) =>
      supportTicketActivityAt(b, b.replies).localeCompare(
        supportTicketActivityAt(a, a.replies)
      )
    );
    for (const ticket of rows) {
      const section = userId
        ? coachSupportListSection(ticket, ticket.replies, userId)
        : ticket.status === "resolved"
          ? "resolved"
          : "submitted";
      buckets.get(section)?.push(ticket);
    }
    return COACH_SUPPORT_LIST_SECTIONS.map((section) => ({
      ...section,
      tickets: buckets.get(section.id) ?? [],
    })).filter((section) => section.tickets.length > 0);
  }, [tickets, userId]);

  const hasWorkBesidesResolved = sections.some(
    (section) => section.id !== "resolved"
  );

  const selected =
    tickets.find((ticket) => ticket.id === selectedTicketId) ?? null;
  const emptyAll = !loading && tickets.length === 0;

  function openComposer() {
    setSelectedTicketId(null);
    setComposeOpen(true);
  }

  const ticketComposer = composeOpen ? (
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
        setJustCreatedId(created.id);
        setSelectedTicketId(created.id);
      }}
    />
  ) : null;

  function openTicket(ticket: TicketWithReplies) {
    if (ticket.id === selectedTicketId) {
      setSelectedTicketId(null);
      return;
    }
    setSelectedTicketId(ticket.id);
    if (
      userId &&
      ticketHasUnreadStaffReply(ticket, ticket.replies, userId)
    ) {
      void markTicketRead(ticket.id);
    }
  }

  function sectionIsOpen(id: CoachSupportListSection): boolean {
    const chosen = sectionOpen[id];
    if (chosen != null) return chosen;
    if (id === "resolved") return !hasWorkBesidesResolved;
    return true;
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-3">
      {justCreatedId ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Ticket submitted. We&apos;ll reply in this thread.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-600">Loading your tickets…</p>
      ) : emptyAll ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <SupportWelcome
            firstName={welcomeName}
            communityHref={communityHref}
            onNewTicket={openComposer}
            composer={ticketComposer}
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white max-lg:min-h-[36rem]">
          <div
            className={`grid h-full min-h-0 min-w-0 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,27%)_minmax(0,1fr)] ${
              selected
                ? "xl:grid-cols-[minmax(0,27%)_minmax(0,1fr)_minmax(0,22%)]"
                : ""
            }`}
          >
            <aside
              className={`min-h-0 flex-col overflow-hidden border-slate-200 bg-slate-100 lg:border-r ${
                selected || composeOpen ? "hidden lg:flex" : "flex"
              }`}
            >
              <div className="border-b border-slate-100 bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="min-w-0 text-[15px] font-semibold leading-snug tracking-tight text-slate-950">
                    Tickets
                  </h2>
                  <button
                    type="button"
                    disabled={composeOpen}
                    onClick={openComposer}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-sky-700 px-2.5 py-1.5 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    New ticket
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <div className="bg-white">
                {sections.map((section) => {
                  const open = sectionIsOpen(section.id);
                  return (
                    <section key={section.id}>
                      <h3 className="sticky top-0 z-[1]">
                        <button
                          type="button"
                          aria-expanded={open}
                          onClick={() =>
                            setSectionOpen((current) => ({
                              ...current,
                              [section.id]: !open,
                            }))
                          }
                          className={`flex w-full items-center gap-1.5 px-3.5 py-1.5 text-left ${sectionHeaderTone(section.id)}`}
                        >
                          <ChevronDown
                            className={`h-3.5 w-3.5 shrink-0 transition-transform ${
                              open ? "" : "-rotate-90"
                            }`}
                            aria-hidden
                          />
                          <span className="text-[11px] font-semibold uppercase tracking-wide">
                            {section.label}
                          </span>
                          <span className="tabular-nums text-[11px] font-medium opacity-70">
                            {section.tickets.length}
                          </span>
                        </button>
                      </h3>
                      {open ? (
                        <ul>
                          {section.tickets.map((ticket) => (
                            <TicketListRow
                              key={ticket.id}
                              ticket={ticket}
                              unreadCount={
                                userId != null
                                  ? unreadStaffReplyCount(
                                      ticket,
                                      ticket.replies,
                                      userId
                                    )
                                  : 0
                              }
                              active={ticket.id === selectedTicketId}
                              onOpen={() => openTicket(ticket)}
                            />
                          ))}
                        </ul>
                      ) : null}
                    </section>
                  );
                })}
                </div>
              </div>
            </aside>

            <section
              className={`min-h-0 flex-col overflow-hidden bg-white ${
                selected || composeOpen ? "flex" : "hidden lg:flex"
              }`}
            >
              {selected && userId ? (
                <SupportThreadPane
                  ticket={selected}
                  viewer={viewer}
                  viewerId={userId}
                  previewingMember={previewingMember}
                  memberFirstName={memberFirstName}
                  onBack={() => setSelectedTicketId(null)}
                  onTicketChange={(next) =>
                    setTickets((current) =>
                      current.map((row) => (row.id === next.id ? next : row))
                    )
                  }
                />
              ) : (
                <SupportWelcome
                  firstName={welcomeName}
                  communityHref={communityHref}
                  onNewTicket={openComposer}
                  composer={ticketComposer}
                />
              )}
            </section>

            {selected && userId ? (
              <aside className="hidden min-h-0 min-w-0 flex-col overflow-hidden border-slate-200 bg-slate-100 xl:flex xl:border-l">
                <SupportHelpfulPanel
                  reportId={selected.id}
                  replyId={latestStaffReplyId(selected, userId)}
                  viewerId={userId}
                  canAnswer={!previewingMember}
                  existing={feedbackById[selected.id] ?? null}
                  onChange={(next) =>
                    setFeedbackById((current) => ({
                      ...current,
                      [selected.id]: next,
                    }))
                  }
                />
                <SupportTicketActions
                  reportId={selected.id}
                  status={selected.status}
                  canChange={!previewingMember}
                  onStatus={(status) => {
                    setTickets((current) =>
                      current.map((row) =>
                        row.id === selected.id ? { ...row, status } : row
                      )
                    );
                    notifyCoachSupportReadChanged();
                  }}
                  onDeleted={() => {
                    setTickets((current) =>
                      current.filter((row) => row.id !== selected.id)
                    );
                    setSelectedTicketId(null);
                    notifyCoachSupportReadChanged();
                  }}
                />
              </aside>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function latestStaffReplyId(
  ticket: TicketWithReplies,
  viewerId: string
): string | null {
  for (let i = ticket.replies.length - 1; i >= 0; i -= 1) {
    const reply = ticket.replies[i];
    if (reply && reply.created_by !== viewerId) return reply.id;
  }
  return null;
}

function StatusPill({
  status,
  size = "sm",
}: {
  status: SupportTicketStatus;
  size?: "sm" | "md";
}) {
  const presentation = memberSupportStatusPresentation(status);
  const toneClass =
    presentation.tone === "waiting"
      ? "bg-amber-50 text-amber-900 ring-amber-200/80"
      : presentation.tone === "resolved"
        ? "bg-emerald-50 text-emerald-800 ring-emerald-200/80"
        : "bg-sky-50 text-sky-800 ring-sky-200/80";
  const Icon =
    presentation.tone === "waiting"
      ? Hourglass
      : presentation.tone === "resolved"
        ? CheckCircle2
        : Circle;
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full font-semibold ring-1 ring-inset ${toneClass} ${
        size === "md"
          ? "gap-1.5 py-1 pl-3 pr-2.5 text-sm"
          : "gap-1 px-1.5 py-0.5 text-[10px]"
      }`}
    >
      <Icon
        className={size === "md" ? "h-3.5 w-3.5" : "h-3 w-3"}
        strokeWidth={1.75}
        aria-hidden
      />
      <span className="whitespace-nowrap">{presentation.label}</span>
    </span>
  );
}

function displayTicketTitle(raw: string): string {
  const title = raw.trim();
  if (!title) return "(No subject)";
  return title.charAt(0).toLocaleUpperCase() + title.slice(1);
}

function TicketListRow({
  ticket,
  unreadCount,
  active,
  onOpen,
}: {
  ticket: TicketWithReplies;
  unreadCount: number;
  active: boolean;
  onOpen: () => void;
}) {
  const title = displayTicketTitle(ticket.title ?? "");
  const preview = supportTicketListPreview(ticket, ticket.replies);
  return (
    <li className="border-b border-slate-200/80 last:border-b-0">
      <button
        type="button"
        onClick={onOpen}
        aria-current={active ? "true" : undefined}
        className={`flex w-full items-start gap-3 px-3.5 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-600 ${
          active ? "bg-sky-100" : "bg-white hover:bg-slate-50"
        }`}
      >
        <span className="min-w-0 flex-1">
          <span
            className={`line-clamp-2 text-sm leading-snug ${
              unreadCount > 0
                ? "font-semibold text-slate-900"
                : "font-medium text-slate-800"
            }`}
          >
            {title}
          </span>
          <span className="mt-0.5 block truncate text-xs text-slate-500">
            {preview || SUPPORT_TYPE_LABELS[ticket.type]}
          </span>
        </span>
        <span className="flex w-8 shrink-0 flex-col items-end gap-1 pt-0.5">
          {unreadCount > 0 ? (
            <span className="inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-sky-600 px-1 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
          <span className="text-[11px] tabular-nums text-slate-400">
            {formatSupportRelativeCompact(
              supportTicketActivityAt(ticket, ticket.replies)
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

function SupportThreadPane({
  ticket,
  viewer,
  viewerId,
  previewingMember,
  memberFirstName,
  onBack,
  onTicketChange,
}: {
  ticket: TicketWithReplies;
  viewer: SupportTicketAuthor | null;
  viewerId: string;
  previewingMember: boolean;
  memberFirstName: string | null;
  onBack: () => void;
  onTicketChange: (next: TicketWithReplies) => void;
}) {
  const unreadCount = unreadStaffReplyCount(ticket, ticket.replies, viewerId);
  const title = displayTicketTitle(ticket.title ?? "");
  const media = parseSupportTicketMedia(ticket.media);
  const details = ticket.details.trim();
  const authorName = viewer
    ? [viewer.first_name, viewer.last_name].filter(Boolean).join(" ").trim() ||
      viewer.full_name?.trim() ||
      "You"
    : "You";

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="shrink-0 border-b border-slate-200/80 bg-white px-4 py-4 sm:px-6">
        <button
          type="button"
          onClick={onBack}
          className="mb-3 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-100 lg:hidden"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Tickets
        </button>
        <div className="flex items-start gap-3">
          <SupportChatAvatar
            name={authorName}
            avatarUrl={viewer?.avatar_url ?? null}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-semibold leading-none text-slate-900">
                  {authorName}
                </p>
                <p className="mt-1 text-xs leading-none text-slate-500">
                  {formatSupportTicketDate(ticket.created_at)}
                  <span className="mx-1.5 text-slate-300">·</span>
                  <span className="font-semibold text-slate-600">
                    {SUPPORT_TYPE_LABELS[ticket.type]}
                  </span>
                </p>
              </div>
              <StatusPill status={ticket.status} size="md" />
            </div>
          </div>
        </div>
        <h2 className="mt-3 text-lg font-semibold leading-snug tracking-tight text-slate-900 sm:text-xl">
          {title}
        </h2>
        {previewingMember && unreadCount > 0 ? (
          <p className="mt-2 text-sm leading-snug text-slate-700">
            {memberFirstName
              ? `${memberFirstName} hasn't read this yet.`
              : "This reply hasn't been read yet."}{" "}
            Opening it here leaves the notification in place.
          </p>
        ) : ticket.status === "resolved" ? (
          <p className="mt-2 text-sm leading-snug text-slate-600">
            Resolved. Send a message to reopen it.
          </p>
        ) : null}
        <SupportOpeningBody key={ticket.id} text={details}>
          {media.length > 0 ? (
            <div className={details ? "mt-3" : undefined}>
              <CommunityPostMediaGallery items={media} variant="compact" />
            </div>
          ) : null}
        </SupportOpeningBody>
      </div>
      <SupportTicketChat
        ticket={ticket}
        viewer={viewer}
        viewerId={viewerId}
        onTicketChange={onTicketChange}
      />
    </div>
  );
}
