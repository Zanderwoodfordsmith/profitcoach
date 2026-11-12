"use client";

import {
  ArrowDownAZ,
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Clock,
  ExternalLink,
  Plus,
  Search,
  Trash2,
  UserPlus,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DashboardPageSection,
  PageHeaderUnderlineTabs,
  StickyPageHeader,
} from "@/components/layout";
import {
  FEEDBACK_COUNTS_CHANGED,
  notifySupportCountsChanged,
} from "@/components/layout/useNewFeedbackCount";
import { AdminTicketReplies } from "@/components/support/AdminTicketReplies";
import { JobStatusChip } from "@/components/jobs/jobParts";
import { AdminChatLinkPill, AdminChatPanel, adminChatLinkFor, useAdminSupportDock } from "@/components/support/AdminSupportDock";
import type { SupportThreadLayout } from "@/components/support/SupportChatBubbles";
import { useMatchesBreakpoint } from "@/hooks/useBreakpoint";
import { useScreenRecorder } from "@/contexts/ScreenRecorderContext";
import type { SupportCallContactPrefill } from "@/lib/support/supportCallPrefillQuery";
import type { SupportCallHostSlug } from "@/lib/support/supportCallHosts";
import { SupportCallAdminSettings } from "@/components/support/SupportCallAdminSettings";
import { SupportTicketBookCall } from "@/components/support/SupportTicketBookCall";
import { SupportChatPagePicker } from "@/components/support/SupportChatPagePicker";
import { SupportTicketCoachPayments } from "@/components/support/SupportTicketCoachPayments";
import {
  CoachSearchCombobox,
  SupportCreateTicketComposer,
} from "@/components/support/SupportCreateTicketComposer";
import { SupportMailboxConnect } from "@/components/support/SupportMailboxConnect";
import {
  DEFAULT_SUPPORT_ASSIGNEE_ID,
  isSupportAssignable,
  type SupportAssignee,
  type SupportAssigneeFilter,
  type SupportStatusFilter,
} from "@/lib/support/assignees";
import {
  loadAdminSupportAttention,
  markAdminSupportTicketRead,
  supportAttentionBadgeCount,
  type SupportAttentionMap,
} from "@/lib/support/adminAttention";
import { supportNotifyDefaultOn } from "@/lib/support/notifyDefaults";
import {
  LAUNCH_PHASES,
  LAUNCH_THREADS,
  launchThread,
  type LaunchThread,
} from "@/lib/launch/threads";
import {
  BlueprintCommentsBlock,
  ChannelCard,
  ChannelGroupLabel,
  JobBrief,
  JobChecklist,
  JobCircle,
  MessageStatusCircle,
  ThreadActivityInline,
  ThreadWelcome,
  threadRowClass,
  useBlueprintComments,
  useBlueprintPageChats,
  useChannelActivity,
  useLaunchProgress,
  withBlueprintActivity,
} from "@/components/messages/channelParts";
import { adminSectionHref } from "@/lib/practiceKnowledge/blueprintGrid";
import { BLUEPRINT_GROUPS, type BlueprintLink } from "@/lib/practiceKnowledge/blueprint";
import { ChannelPageChat } from "@/components/messages/ChannelPageChat";
import { PageIcon } from "@/components/practice/pageIcons";
import type { LaunchProgress } from "@/lib/launch/progress";
import {
  SUPPORT_SOURCE_LABELS,
  SUPPORT_STATUS_ADMIN_LABELS,
  SUPPORT_STATUS_JOB,
  supportChatOpenedByBca,
  SUPPORT_TYPE_LABELS,
  supportTypeOptionLabel,
  authorDisplayName,
  formatSupportRelativeCompact,
  formatSupportTicketId,
  normalizeSupportTicketType,
  supportTicketScore,
  type SupportReply,
  type SupportTicketAuthor,
  type SupportTicketSource,
  type SupportTicketStatus,
  type SupportTicketType,
} from "@/lib/support/tickets";
import { supabaseClient } from "@/lib/supabaseClient";
import { isSupabaseAbortError } from "@/lib/supabaseErrorMessage";
import { getSessionUser } from "@/lib/supabaseAccessToken";
import { buttonClass } from "@/components/ui/Button";
import { badgeClass } from "@/components/ui/Badge";
import { fieldClass } from "@/components/ui/Field";
type AdminTicketRow = {
  id: string;
  created_at: string;
  created_by: string | null;
  ticket_number: number;
  type: SupportTicketType;
  title: string | null;
  details: string;
  page_path: string | null;
  /** The page the chat is about, for the coach's "Open … page" button (5 Nov). */
  context_path?: string | null;
  status: SupportTicketStatus;
  source: SupportTicketSource;
  assigned_to: string | null;
  community_post_id: string | null;
  contact_email: string | null;
  submitter_name: string | null;
  importance: number | null;
  ease: number | null;
  media?: unknown;
  member_notify_email?: boolean;
  /** When staff last set the ticket back to Open by hand. */
  reopened_at?: string | null;
  created_by_admin?: string | null;
  opening_seen_at?: string | null;
  /**
   * BCA has nothing to answer (5 Nov): it ticked the coach's last message
   * "Seen", or BCA wrote the chat's first message and nothing has come since.
   */
  nothingToAnswer?: boolean;
  author: SupportAssignee | null;
  /** Who at BCA wrote the first message, when BCA started the chat. */
  opener: SupportAssignee | null;
  assignee: SupportAssignee | null;
  /**
   * When the member last wrote without a later staff reply.
   * Used to age-band Open tickets (not ticket created_at).
   */
  lastUnrepliedMemberAt: string;
  /** Latest ticket or reply activity. */
  lastActivityAt: string;
  /** Newest reply. Null when the opening message is still the latest. */
  lastMessage: { firstName: string; body: string } | null;
  /** Replies on the thread; null for resolved tickets (not loaded). */
  replyCount: number | null;
  /** Pinned launch thread key (Channels), null for a one-off message. */
  topic: string | null;
};

type CoachOption = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  role?: string | null;
  access_removed_at?: string | null;
};

/** Join date and whether they're a current member, for the channel list. */
type CoachMembership = { joinedAt: string | null; current: boolean };

type ChannelSort = "latest" | "az" | "joined";

const CHANNEL_SORT_OPTIONS: { id: ChannelSort; label: string; hint: string; icon: LucideIcon }[] = [
  { id: "latest", label: "Latest", hint: "Waiting on us first, then latest message", icon: Clock },
  { id: "az", label: "A to Z", hint: "By name", icon: ArrowDownAZ },
  { id: "joined", label: "Newest", hint: "Newest coaches first, by join date", icon: UserPlus },
];

const CHANNEL_SORT_STORAGE_KEY = "admin-support-channel-sort";

type GroupMode = "tickets" | "people" | "channels";

/** A coach's channel: every ticket they have, like a Slack channel per person. */
type ChannelGroup = {
  key: string;
  label: string;
  profileId: string | null;
  avatarUrl: string | null;
  /** Newest first (the feed shows them oldest first, like a chat). */
  tickets: AdminTicketRow[];
  needsReply: number;
  /** Latest activity; null for a coach who hasn't written yet. */
  latestAt: string | null;
  joinedAt: string | null;
};

type PersonGroup = {
  key: string;
  label: string;
  email: string | null;
  profileId: string | null;
  avatarUrl: string | null;
  tickets: AdminTicketRow[];
  openCount: number;
  latestAt: string;
};

const ASSIGNEE_FILTERS: { id: SupportAssigneeFilter; label: string }[] = [
  { id: "anyone", label: "All" },
  { id: "zander", label: "Zander" },
  { id: "pam", label: "Pam" },
];

const STATUS_FILTER_OPTIONS: {
  id: SupportStatusFilter;
  label: string;
}[] = [
  { id: "open", label: "All open" },
  { id: "waiting_reply", label: SUPPORT_STATUS_ADMIN_LABELS.waiting_reply },
  { id: "bca_todo", label: SUPPORT_STATUS_ADMIN_LABELS.open },
  { id: "in_progress", label: SUPPORT_STATUS_ADMIN_LABELS.in_progress },
  { id: "review", label: SUPPORT_STATUS_ADMIN_LABELS.review },
  { id: "resolved", label: SUPPORT_STATUS_ADMIN_LABELS.resolved },
  { id: "all", label: "All statuses" },
];

const filterSelectClass = fieldClass("select", "small");

function queueSegmentClass(active: boolean) {
  return `flex-1 whitespace-nowrap rounded-md px-1.5 py-1.5 text-xs font-semibold transition-colors ${
    active
      ? "bg-sky-700 text-white shadow-sm"
      : "text-slate-500 hover:bg-white hover:text-slate-800"
  }`;
}

function normalizeProfile(
  row: SupportAssignee | SupportAssignee[] | null
): SupportAssignee | null {
  if (!row) return null;
  return Array.isArray(row) ? (row[0] ?? null) : row;
}

/** Assignee picker list; keeps a legacy non-assignable current value visible. */
function assigneePickerOptions(
  assignees: SupportAssignee[],
  current: SupportAssignee | null | undefined
): SupportAssignee[] {
  if (!current || assignees.some((a) => a.id === current.id)) return assignees;
  return [current, ...assignees];
}

function assigneeShortName(assignee: SupportAssignee): string {
  const first = assignee.first_name?.trim();
  if (first) return first;
  const full = assignee.full_name?.trim();
  if (full) return full.split(/\s+/)[0] || full;
  return "Team";
}

function ticketAuthorLabel(row: AdminTicketRow): string {
  if (row.author) return authorDisplayName(row.author);
  if (row.submitter_name?.trim()) return row.submitter_name.trim();
  if (row.contact_email?.trim()) return row.contact_email.trim();
  return "Unknown";
}

function firstToken(value: string): string {
  return value.trim().split(/\s+/).filter(Boolean)[0] || "Unknown";
}

function ticketAuthorFirstName(row: AdminTicketRow): string {
  const first = row.author?.first_name?.trim();
  if (first) return first;
  return firstToken(ticketAuthorLabel(row));
}

function replyAuthorFirstName(
  author: { first_name?: string | null; full_name?: string | null } | null
): string {
  const first = author?.first_name?.trim();
  if (first) return first;
  const full = author?.full_name?.trim();
  if (full) return firstToken(full);
  return "Unknown";
}

/** Inbox subtitle: first name of whoever sent the latest message, plus that message. */
function ticketListPreview(row: AdminTicketRow): { name: string; text: string } {
  const latest = row.lastMessage;
  if (latest?.body.trim()) {
    return { name: latest.firstName, text: latest.body };
  }
  return {
    name: supportChatOpenedByBca(row) ? replyAuthorFirstName(row.opener) : ticketAuthorFirstName(row),
    text: row.details,
  };
}

function ticketPersonKey(row: AdminTicketRow): string {
  if (row.created_by) return `profile:${row.created_by}`;
  const email = row.contact_email?.trim().toLowerCase();
  if (email) return `email:${email}`;
  const name = row.submitter_name?.trim().toLowerCase();
  if (name) return `name:${name}`;
  return `ticket:${row.id}`;
}

function initialsFromLabel(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function ticketAuthorAvatarUrl(row: AdminTicketRow): string | null {
  return row.author?.avatar_url?.trim() || null;
}

function defaultSupportHost(
  assignedTo: string | null,
  pamAssigneeId: string | null
): SupportCallHostSlug {
  if (pamAssigneeId && assignedTo === pamAssigneeId) return "pam";
  return "zander";
}

function ticketSupportCallContact(row: AdminTicketRow): SupportCallContactPrefill {
  let firstName = row.author?.first_name?.trim() || null;
  let lastName = row.author?.last_name?.trim() || null;
  if ((!firstName || !lastName) && row.submitter_name?.trim()) {
    const parts = row.submitter_name.trim().split(/\s+/);
    firstName = firstName || parts[0] || null;
    lastName = lastName || parts.slice(1).join(" ") || null;
  }
  return {
    firstName,
    lastName,
    email: row.contact_email?.trim() || null,
    phone: row.author?.phone?.trim() || null,
  };
}

function ListAvatar({
  label,
  avatarUrl,
}: {
  label: string;
  avatarUrl?: string | null;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        className="mt-0.5 h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-slate-200/80"
      />
    );
  }
  return (
    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-caption font-semibold text-slate-700">
      {initialsFromLabel(label)}
    </span>
  );
}

function previewText(value: string, max = 72): string {
  const cleaned = value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~`]/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Rolling age bands for newest-first lists — same bands as Conversations.
 * Labels name the range (e.g. Last 7 days), not a point in time.
 */
function inboxAgeBand(iso: string, now = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "Older";

  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const startOfThen = new Date(
    then.getFullYear(),
    then.getMonth(),
    then.getDate()
  );
  const dayDiff = Math.round(
    (startOfToday.getTime() - startOfThen.getTime()) / 86_400_000
  );

  if (dayDiff <= 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  if (dayDiff <= 7) return "Last 7 days";
  if (dayDiff <= 30) return "Last 30 days";
  return "Older";
}

const WAITING_ON_REPLY_BAND = "Needs coach";

/**
 * Open filter sections:
 * - Needs our reply → Today / Yesterday / … by last unreplied member message
 * - We've replied (or marked Needs coach / Review) → "Needs coach" at the bottom
 */
function ticketNeedsStaffReply(
  row: Pick<AdminTicketRow, "status" | "lastUnrepliedMemberAt" | "lastActivityAt" | "reopened_at" | "nothingToAnswer">
): boolean {
  // Needs coach, Review and Done wait on nobody at BCA.
  if (row.status === "waiting_reply" || row.status === "review") return false;
  if (row.status === "resolved") return false;
  // In progress is BCA's turn whoever wrote last: it stays in the timed groups.
  if (row.status === "in_progress") return true;
  // Set back to Open by hand after the last message: keep it Open.
  if (row.reopened_at && Date.parse(row.reopened_at) >= Date.parse(row.lastActivityAt)) return true;
  // Ticked "Seen", or BCA started it and the coach hasn't written since.
  if (row.nothingToAnswer) return false;
  // Member still has the last word (or no replies yet — times equal ticket open).
  return row.lastActivityAt === row.lastUnrepliedMemberAt;
}

/** Status as the inbox shows it: BCA to do with our reply last reads as Needs coach. */
function shownTicketStatus(
  row: Pick<AdminTicketRow, "status" | "lastUnrepliedMemberAt" | "lastActivityAt" | "reopened_at" | "nothingToAnswer">
): SupportTicketStatus {
  return row.status === "open" && !ticketNeedsStaffReply(row) ? "waiting_reply" : row.status;
}

function inboxListBand(
  row: Pick<
    AdminTicketRow,
    "status" | "created_at" | "lastUnrepliedMemberAt" | "lastActivityAt" | "reopened_at" | "nothingToAnswer"
  >,
  statusFilter: SupportStatusFilter
): string {
  if (statusFilter === "open" && !ticketNeedsStaffReply(row)) {
    return WAITING_ON_REPLY_BAND;
  }
  const at =
    statusFilter === "open"
      ? row.lastUnrepliedMemberAt || row.created_at
      : row.created_at;
  return inboxAgeBand(at);
}

function personListBand(
  group: PersonGroup,
  statusFilter: SupportStatusFilter
): string {
  if (statusFilter === "open") {
    const needsReply = group.tickets.some((t) => ticketNeedsStaffReply(t));
    if (!needsReply) return WAITING_ON_REPLY_BAND;
  }
  return inboxAgeBand(group.latestAt);
}

type ReplyAuthorBits = {
  role?: string | null;
  first_name?: string | null;
  full_name?: string | null;
};

type ReplyActivityRow = {
  report_id: string;
  created_at: string;
  body: string;
  seen_at?: string | null;
  author: ReplyAuthorBits | ReplyAuthorBits[] | null;
};

type ReplyActivityItem = {
  created_at: string;
  staff: boolean;
  /** Ticked "Seen" by the other side. */
  seen: boolean;
  /** Set on the newest reply only. */
  body: string;
  firstName: string;
};

function normalizeReplyAuthor(
  author: ReplyActivityRow["author"]
): ReplyAuthorBits | null {
  if (!author) return null;
  return Array.isArray(author) ? (author[0] ?? null) : author;
}

/** Newest-first replies → last unreplied member message + last activity. */
function ticketActivityFromReplies(
  ticketCreatedAt: string,
  repliesNewestFirst: ReplyActivityItem[]
): {
  lastUnrepliedMemberAt: string;
  lastActivityAt: string;
  lastMessage: { firstName: string; body: string } | null;
} {
  const latest = repliesNewestFirst[0];
  const lastActivityAt = latest?.created_at ?? ticketCreatedAt;
  const lastMessage = latest?.body.trim()
    ? { firstName: latest.firstName || "Unknown", body: latest.body }
    : null;

  if (!latest) {
    return {
      lastUnrepliedMemberAt: ticketCreatedAt,
      lastActivityAt,
      lastMessage: null,
    };
  }

  if (!latest.staff) {
    return {
      lastUnrepliedMemberAt: latest.created_at,
      lastActivityAt,
      lastMessage,
    };
  }

  const lastMember = repliesNewestFirst.find((r) => !r.staff);
  return {
    lastUnrepliedMemberAt: lastMember?.created_at ?? ticketCreatedAt,
    lastActivityAt,
    lastMessage,
  };
}

async function loadTicketReplyActivity(
  reportIds: string[]
): Promise<Map<string, ReplyActivityItem[]>> {
  const byTicket = new Map<string, ReplyActivityItem[]>();
  if (reportIds.length === 0) return byTicket;

  const chunkSize = 150;
  for (let i = 0; i < reportIds.length; i += chunkSize) {
    const chunk = reportIds.slice(i, i + chunkSize);
    const { data, error } = await supabaseClient
      .from("community_feedback_replies")
      .select(
        `
        report_id,
        created_at,
        body,
        seen_at,
        author:profiles!created_by ( role, first_name, full_name )
      `
      )
      .in("report_id", chunk)
      .order("created_at", { ascending: false });

    if (error) {
      if (!isSupabaseAbortError(error)) {
        console.warn("support inbox reply activity:", error.message);
      }
      continue;
    }

    for (const raw of (data ?? []) as ReplyActivityRow[]) {
      const list = byTicket.get(raw.report_id) ?? [];
      const author = normalizeReplyAuthor(raw.author);
      const isLatest = list.length === 0;
      list.push({
        created_at: raw.created_at,
        staff: author?.role === "admin",
        seen: Boolean(raw.seen_at),
        body: isLatest ? raw.body ?? "" : "",
        firstName: isLatest ? replyAuthorFirstName(author) : "",
      });
      byTicket.set(raw.report_id, list);
    }
  }

  return byTicket;
}

function WaitingSectionHeader({
  count,
  open,
  onToggle,
}: {
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="sticky top-0 z-[1] bg-slate-100 px-3.5 py-1.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 text-left text-slate-500"
      >
        <span className="min-w-0 truncate text-kicker font-semibold uppercase ">
          {WAITING_ON_REPLY_BAND}
        </span>
        <span className="text-caption font-semibold tabular-nums tracking-wide">
          {count}
        </span>
        {open ? (
          <ChevronDown
            className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-400"
            aria-hidden
          />
        ) : (
          <ChevronUp
            className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-400"
            aria-hidden
          />
        )}
      </button>
    </li>
  );
}

export function AdminSupportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const topTab =
    searchParams.get("tab") === "settings" ? "settings" : "inbox";
  const [appOrigin, setAppOrigin] = useState("https://theprofitcoach.com");
  const [rows, setRows] = useState<AdminTicketRow[]>([]);
  const [assignees, setAssignees] = useState<SupportAssignee[]>([]);
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [pamAssigneeId, setPamAssigneeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createNotice, setCreateNotice] = useState<string | null>(null);
  const [assigneeFilter, setAssigneeFilter] =
    useState<SupportAssigneeFilter>("anyone");
  const [statusFilter, setStatusFilter] =
    useState<SupportStatusFilter>("open");
  // ?channel=<coach id>[&thread=<key>]: open straight onto a coach's channel (from the launch board).
  const linkedChannel = searchParams.get("channel");
  const linkedThread = searchParams.get("thread");
  const [groupMode, setGroupMode] = useState<GroupMode>(linkedChannel ? "channels" : "tickets");
  const desktop = useMatchesBreakpoint("lg");
  const dock = useAdminSupportDock();
  // V2 (picked 11 Nov) on wide screens, for tickets. Phones and Channels keep the stacked layout.
  const v2 = desktop === true && groupMode !== "channels" && Boolean(dock);
  const [coachMembership, setCoachMembership] = useState<
    Record<string, CoachMembership>
  >({});
  const [channelSort, setChannelSort] = useState<ChannelSort>("latest");
  useEffect(() => {
    const saved = window.localStorage.getItem(CHANNEL_SORT_STORAGE_KEY);
    if (saved === "latest" || saved === "az" || saved === "joined") setChannelSort(saved);
  }, []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedChannelKey, setSelectedChannelKey] = useState<string | null>(
    null
  );
  /** A pinned thread with nothing in it yet, opened in Channels. */
  const [pendingThreadKey, setPendingThreadKey] = useState<string | null>(null);
  /** A Blueprint page chat opened from the channel (job 26): the chat itself lives on the page. */
  const [pageChatSlug, setPageChatSlug] = useState<string | null>(null);
  const createdPinnedIdRef = useRef<string | null>(null);
  // Phones show one pane at a time in Channels: the coach list, or their channel.
  const [phoneChannelOpen, setPhoneChannelOpen] = useState(false);
  const [selectedPersonKey, setSelectedPersonKey] = useState<string | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [supportCallContact, setSupportCallContact] =
    useState<SupportCallContactPrefill | null>(null);
  const [threadRefreshKey, setThreadRefreshKey] = useState(0);
  const [attentionByTicket, setAttentionByTicket] = useState<SupportAttentionMap>(
    {}
  );
  const [waitingSectionOpen, setWaitingSectionOpen] = useState(true);
  /** report_id → user ids @mentioned in any internal note */
  const [mentionsByTicket, setMentionsByTicket] = useState<
    Record<string, string[]>
  >({});
  const loadGenerationRef = useRef(0);

  useEffect(() => {
    setAppOrigin(window.location.origin);
  }, []);

  function selectTopTab(tab: "inbox" | "settings") {
    router.replace(
      tab === "settings" ? "/admin/support?tab=settings" : "/admin/support",
      { scroll: false }
    );
  }

  const loadMeta = useCallback(async () => {
    const user = await getSessionUser();
    setAdminUserId(user?.id ?? null);

    const { data: adminProfiles } = await supabaseClient
      .from("profiles")
      .select("id, full_name, first_name, last_name, avatar_url, role")
      .eq("role", "admin")
      .order("first_name", { ascending: true });

    const admins = (adminProfiles ?? []) as SupportAssignee[];
    setAssignees(admins.filter(isSupportAssignable));
    const pam = admins.find(
      (a) => (a.first_name ?? "").toLowerCase() === "pam"
    );
    setPamAssigneeId(pam?.id ?? null);

    const [{ data: coachProfiles }, { data: coachRows }] = await Promise.all([
      supabaseClient
        .from("profiles")
        .select("id, full_name, first_name, last_name, role, access_removed_at")
        .in("role", ["coach", "admin"])
        .order("full_name", { ascending: true })
        .limit(500),
      supabaseClient
        .from("coaches")
        .select("id, membership_status, record_kind, created_at")
        .limit(1000),
    ]);
    setCoaches((coachProfiles ?? []) as CoachOption[]);
    // Real join dates (first payment etc.) come from the server; created_at is the import date.
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    const joinedRes = session?.access_token
      ? await fetch("/api/admin/support/coach-joined", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }).catch(() => null)
      : null;
    const joined = ((await joinedRes?.json().catch(() => null)) as {
      joined?: Record<string, string>;
    } | null)?.joined ?? {};
    const membership: Record<string, CoachMembership> = {};
    for (const row of coachRows ?? []) {
      membership[row.id] = {
        joinedAt: joined[row.id] ?? row.created_at ?? null,
        current:
          ["active", "past_due", "trialing"].includes(row.membership_status ?? "") &&
          row.record_kind !== "historical",
      };
    }
    setCoachMembership(membership);
  }, []);

  const loadAttention = useCallback(async () => {
    const [{ map }, notesRes] = await Promise.all([
      loadAdminSupportAttention(),
      supabaseClient
        .from("support_ticket_internal_notes")
        .select("report_id, mentioned_user_ids"),
    ]);
    setAttentionByTicket(map);

    const byTicket: Record<string, string[]> = {};
    for (const row of notesRes.data ?? []) {
      const reportId = row.report_id as string;
      const ids = Array.isArray(row.mentioned_user_ids)
        ? (row.mentioned_user_ids as string[])
        : [];
      if (ids.length === 0) continue;
      const existing = byTicket[reportId] ?? [];
      const merged = new Set([...existing, ...ids]);
      byTicket[reportId] = [...merged];
    }
    setMentionsByTicket(byTicket);
  }, []);

  const loadTickets = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    setLoading(true);
    setError(null);
    const [{ data, error: queryError }] = await Promise.all([
      supabaseClient
        .from("community_feedback_reports")
        .select(
          `
          id,
          created_at,
          created_by,
          ticket_number,
          type,
          title,
          details,
          page_path,
          context_path,
          status,
          source,
          assigned_to,
          community_post_id,
          contact_email,
          submitter_name,
          importance,
          ease,
          media,
          member_notify_email,
          reopened_at,
          topic,
          created_by_admin,
          opening_seen_at,
          author:profiles!created_by ( id, full_name, first_name, last_name, avatar_url, role, phone ),
          opener:profiles!created_by_admin ( id, full_name, first_name, last_name, avatar_url, role ),
          assignee:profiles!assigned_to ( id, full_name, first_name, last_name, avatar_url, role )
        `
        )
        .order("created_at", { ascending: false }),
      loadAttention(),
    ]);
    if (generation !== loadGenerationRef.current) return;

    if (queryError) {
      if (isSupabaseAbortError(queryError)) return;
      setRows([]);
      setError(queryError.message);
      setLoading(false);
      return;
    }

    const mappedBase = ((data ?? []) as Array<
      Omit<
        AdminTicketRow,
        | "type"
        | "author"
        | "opener"
        | "assignee"
        | "lastUnrepliedMemberAt"
        | "lastActivityAt"
        | "lastMessage"
      > & {
        type: string;
        author: SupportAssignee | SupportAssignee[] | null;
        opener: SupportAssignee | SupportAssignee[] | null;
        assignee: SupportAssignee | SupportAssignee[] | null;
      }
    >).map((row) => ({
      ...row,
      type: normalizeSupportTicketType(row.type),
      author: normalizeProfile(row.author),
      opener: normalizeProfile(row.opener),
      assignee: normalizeProfile(row.assignee),
      member_notify_email: row.member_notify_email !== false,
    }));

    const openIds = mappedBase
      .filter((row) => row.status !== "resolved")
      .map((row) => row.id);
    const replyLists = await loadTicketReplyActivity(openIds);
    if (generation !== loadGenerationRef.current) return;

    const mapped: AdminTicketRow[] = mappedBase.map((row) => {
      const activity = ticketActivityFromReplies(
        row.created_at,
        replyLists.get(row.id) ?? []
      );
      const latest = replyLists.get(row.id)?.[0];
      return {
        ...row,
        nothingToAnswer: latest
          ? !latest.staff && latest.seen
          : supportChatOpenedByBca(row) || Boolean(row.opening_seen_at),
        lastUnrepliedMemberAt: activity.lastUnrepliedMemberAt,
        lastActivityAt: activity.lastActivityAt,
        lastMessage: activity.lastMessage,
        replyCount:
          row.status === "resolved" ? null : (replyLists.get(row.id)?.length ?? 0),
      };
    });

    setRows(mapped);
    setLoading(false);
  }, [loadAttention]);

  useEffect(() => {
    void loadMeta();
    void loadTickets();
    return () => {
      loadGenerationRef.current += 1;
    };
  }, [loadMeta, loadTickets]);

  useEffect(() => {
    const onRefresh = () => void loadAttention();
    window.addEventListener("focus", onRefresh);
    window.addEventListener(FEEDBACK_COUNTS_CHANGED, onRefresh);
    return () => {
      window.removeEventListener("focus", onRefresh);
      window.removeEventListener(FEEDBACK_COUNTS_CHANGED, onRefresh);
    };
  }, [loadAttention]);

  useEffect(() => {
    if (!selectedId) return;
    void markAdminSupportTicketRead(selectedId).then(() => {
      setAttentionByTicket((prev) => {
        if (!prev[selectedId]) return prev;
        const next = { ...prev };
        delete next[selectedId];
        return next;
      });
      notifySupportCountsChanged();
    });
  }, [selectedId]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const next = rows.filter((row) => {
      const mentioned = mentionsByTicket[row.id] ?? [];

      if (assigneeFilter === "zander") {
        const forZander =
          row.assigned_to === DEFAULT_SUPPORT_ASSIGNEE_ID ||
          mentioned.includes(DEFAULT_SUPPORT_ASSIGNEE_ID);
        if (!forZander) return false;
      } else if (assigneeFilter === "pam") {
        if (pamAssigneeId == null) return false;
        const forPam =
          row.assigned_to === pamAssigneeId ||
          mentioned.includes(pamAssigneeId);
        if (!forPam) return false;
      }

      if (statusFilter === "open" && row.status === "resolved") return false;
      if (statusFilter !== "open" && statusFilter !== "all") {
        // As the row shows it: BCA to do with our reply last reads as Needs coach.
        const shown = shownTicketStatus(row);
        if ((statusFilter === "bca_todo" ? "open" : statusFilter) !== shown) return false;
      }

      if (!q) return true;
      const hay = [
        row.title,
        row.details,
        formatSupportTicketId(row.ticket_number),
        ticketAuthorLabel(row),
        row.lastMessage?.firstName,
        row.lastMessage?.body,
        row.contact_email,
        SUPPORT_TYPE_LABELS[row.type],
        SUPPORT_SOURCE_LABELS[row.source],
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });

    if (statusFilter !== "open") return next;

    return [...next].sort((a, b) => {
      const aWaiting = ticketNeedsStaffReply(a) ? 0 : 1;
      const bWaiting = ticketNeedsStaffReply(b) ? 0 : 1;
      if (aWaiting !== bWaiting) return aWaiting - bWaiting;
      const aAt = aWaiting
        ? a.lastActivityAt || a.created_at
        : a.lastUnrepliedMemberAt || a.created_at;
      const bAt = bWaiting
        ? b.lastActivityAt || b.created_at
        : b.lastUnrepliedMemberAt || b.created_at;
      if (aAt !== bAt) return aAt < bAt ? 1 : -1;
      return a.created_at < b.created_at ? 1 : -1;
    });
  }, [
    rows,
    assigneeFilter,
    statusFilter,
    pamAssigneeId,
    searchQuery,
    mentionsByTicket,
  ]);

  const personGroups = useMemo((): PersonGroup[] => {
    const map = new Map<string, PersonGroup>();
    for (const row of filteredRows) {
      const key = ticketPersonKey(row);
      const sortAt =
        statusFilter === "open"
          ? ticketNeedsStaffReply(row)
            ? row.lastUnrepliedMemberAt || row.created_at
            : row.lastActivityAt || row.created_at
          : row.created_at;
      const existing = map.get(key);
      if (existing) {
        existing.tickets.push(row);
        if (row.status !== "resolved") existing.openCount += 1;
        if (sortAt > existing.latestAt) {
          existing.latestAt = sortAt;
        }
        if (!existing.avatarUrl) {
          existing.avatarUrl = ticketAuthorAvatarUrl(row);
        }
      } else {
        map.set(key, {
          key,
          label: ticketAuthorLabel(row),
          email: row.contact_email?.trim() || null,
          profileId: row.created_by,
          avatarUrl: ticketAuthorAvatarUrl(row),
          tickets: [row],
          openCount: row.status !== "resolved" ? 1 : 0,
          latestAt: sortAt,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (statusFilter === "open") {
        const aNeeds = a.tickets.some((t) => ticketNeedsStaffReply(t));
        const bNeeds = b.tickets.some((t) => ticketNeedsStaffReply(t));
        if (aNeeds !== bNeeds) return aNeeds ? -1 : 1;
      }
      return a.latestAt < b.latestAt ? 1 : -1;
    });
  }, [filteredRows, statusFilter]);

  // Channels ignore the status and category filters: a channel is the whole history.
  // Current members who haven't written yet get an empty channel too.
  const channelGroups = useMemo((): ChannelGroup[] => {
    const q = searchQuery.trim().toLowerCase();
    const map = new Map<string, ChannelGroup>();
    for (const row of rows) {
      const key = ticketPersonKey(row);
      const at = row.lastActivityAt || row.created_at;
      const needs = row.status !== "resolved" && ticketNeedsStaffReply(row);
      const existing = map.get(key);
      if (existing) {
        existing.tickets.push(row);
        if (needs) existing.needsReply += 1;
        if (!existing.latestAt || at > existing.latestAt) existing.latestAt = at;
        if (!existing.avatarUrl) existing.avatarUrl = ticketAuthorAvatarUrl(row);
      } else {
        map.set(key, {
          key,
          label: ticketAuthorLabel(row),
          profileId: row.created_by,
          avatarUrl: ticketAuthorAvatarUrl(row),
          tickets: [row],
          needsReply: needs ? 1 : 0,
          latestAt: at,
          joinedAt: row.created_by ? coachMembership[row.created_by]?.joinedAt ?? null : null,
        });
      }
    }
    for (const coach of coaches) {
      const key = `profile:${coach.id}`;
      if (map.has(key) || coach.role !== "coach" || coach.access_removed_at) continue;
      if (!coachMembership[coach.id]?.current) continue;
      map.set(key, {
        key,
        label:
          coach.full_name?.trim() ||
          [coach.first_name, coach.last_name].filter(Boolean).join(" ").trim() ||
          "Coach",
        profileId: coach.id,
        avatarUrl: null,
        tickets: [],
        needsReply: 0,
        latestAt: null,
        joinedAt: coachMembership[coach.id]?.joinedAt ?? null,
      });
    }
    const byName = (a: ChannelGroup, b: ChannelGroup) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
    const newestFirst = (a: string | null, b: string | null) =>
      a === b ? 0 : !a ? 1 : !b ? -1 : a < b ? 1 : -1;
    return Array.from(map.values())
      .filter((group) => !q || group.label.toLowerCase().includes(q))
      .sort((a, b) => {
        if (channelSort === "az") return byName(a, b);
        if (channelSort === "joined") return newestFirst(a.joinedAt, b.joinedAt) || byName(a, b);
        // Latest: anyone waiting on us first, then the most recent conversation.
        if ((a.needsReply > 0) !== (b.needsReply > 0)) return a.needsReply > 0 ? -1 : 1;
        return newestFirst(a.latestAt, b.latestAt) || byName(a, b);
      });
  }, [rows, coaches, coachMembership, searchQuery, channelSort]);

  const selectedChannel =
    channelGroups.find((g) => g.key === selectedChannelKey) ?? null;

  const linkHandledRef = useRef(false);
  useEffect(() => {
    if (!linkedChannel || linkHandledRef.current || loading) return;
    const key = `profile:${linkedChannel}`;
    if (!channelGroups.some((g) => g.key === key)) return;
    linkHandledRef.current = true;
    setSelectedChannelKey(key);
    setPhoneChannelOpen(true);
    if (!launchThread(linkedThread)) return;
    // Jobs done on a Blueprint page talk in that page's chat.
    const linkedPage = launchThread(linkedThread)?.blueprintPage;
    if (linkedPage) {
      setPageChatSlug(linkedPage);
      return;
    }
    const row = rows.find((r) => r.created_by === linkedChannel && r.topic === linkedThread);
    if (row) setSelectedId(row.id);
    else setPendingThreadKey(linkedThread);
  }, [linkedChannel, linkedThread, loading, channelGroups, rows]);
  const blueprintByThread = useBlueprintComments(
    groupMode === "channels" ? selectedChannel?.profileId ?? null : null,
    threadRefreshKey,
    (ref, key, coachId) => adminSectionHref(ref.page, key, coachId, true)
  );
  const pageChats = useBlueprintPageChats(
    groupMode === "channels" ? selectedChannel?.profileId ?? null : null,
    threadRefreshKey
  );
  const launchProgress = useLaunchProgress(
    groupMode === "channels" ? selectedChannel?.profileId ?? null : null,
    threadRefreshKey
  );


  useEffect(() => {
    if (groupMode !== "channels" || loading) return;
    if (selectedChannelKey && channelGroups.some((g) => g.key === selectedChannelKey)) return;
    setSelectedChannelKey(channelGroups[0]?.key ?? null);
  }, [groupMode, loading, channelGroups, selectedChannelKey]);

  const listTickets = useMemo(() => {
    if (groupMode === "channels") {
      const tickets = selectedChannel?.tickets ?? [];
      // Open the oldest thread still waiting on us, else the newest.
      const waiting = tickets
        .filter((t) => t.status !== "resolved" && ticketNeedsStaffReply(t))
        .sort((a, b) => (a.lastUnrepliedMemberAt < b.lastUnrepliedMemberAt ? -1 : 1));
      return waiting.length
        ? [...waiting, ...tickets.filter((t) => !waiting.includes(t))]
        : tickets;
    }
    if (groupMode !== "people" || !selectedPersonKey) return filteredRows;
    return (
      personGroups.find((g) => g.key === selectedPersonKey)?.tickets ?? []
    );
  }, [groupMode, selectedChannel, selectedPersonKey, filteredRows, personGroups]);

  const waitingTicketCount = useMemo(() => {
    if (statusFilter !== "open") return 0;
    return listTickets.filter((row) => !ticketNeedsStaffReply(row)).length;
  }, [listTickets, statusFilter]);

  const waitingPersonCount = useMemo(() => {
    if (statusFilter !== "open") return 0;
    return personGroups.filter(
      (group) => !group.tickets.some((ticket) => ticketNeedsStaffReply(ticket))
    ).length;
  }, [personGroups, statusFilter]);

  const selected = useMemo(
    () => listTickets.find((r) => r.id === selectedId) ?? null,
    [listTickets, selectedId]
  );
  const adminJobBrief = (thread: LaunchThread | null) =>
    thread?.phase && selectedChannel?.profileId ? (
      <JobBrief
        thread={thread}
        job={launchProgress[thread.key]}
        audience="admin"
        coachFirstName={selectedChannel.label.split(" ")[0]}
        blueprintHref={
          thread.blueprintPage
            ? `/admin/blueprint/coach/${thread.blueprintPage}?coach=${encodeURIComponent(selectedChannel.profileId)}`
            : null
        }
        seenKey={`admin:${selectedChannel.profileId}:${thread.key}`}
      />
    ) : null;
  const openJobThread =
    groupMode === "channels"
      ? launchThread(selected?.topic) ?? launchThread(pendingThreadKey)
      : null;

  // Coming back with a screen recording: open the ticket (or new ticket) it's for.
  const recordingKey = useScreenRecorder()?.ready?.target.key ?? null;
  useEffect(() => {
    if (!recordingKey) return;
    if (recordingKey === "new-ticket:admin") {
      setCreateOpen(true);
      return;
    }
    const ticketId = recordingKey.startsWith("admin:")
      ? recordingKey.slice("admin:".length)
      : null;
    if (ticketId && listTickets.some((r) => r.id === ticketId)) {
      setSelectedId(ticketId);
    }
  }, [recordingKey, listTickets]);

  useEffect(() => {
    // Channels opens on the coach's thread list; a thread opens only when clicked.
    if (groupMode === "channels") {
      if (selectedId && !listTickets.some((r) => r.id === selectedId)) setSelectedId(null);
      return;
    }
    if (groupMode === "people" && !selectedPersonKey) {
      setSelectedId(null);
      return;
    }
    if (groupMode === "people" && listTickets.length === 0) {
      // This coach has no tickets left (e.g. the last one was deleted):
      // go back to the By coach list instead of an empty one.
      setSelectedPersonKey(null);
      setSelectedId(null);
      return;
    }
    if (listTickets.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !listTickets.some((r) => r.id === selectedId)) {
      setSelectedId(listTickets[0].id);
    }
  }, [groupMode, selectedPersonKey, listTickets, selectedId]);

  useEffect(() => {
    setSelectedPersonKey(null);
  }, [assigneeFilter, statusFilter, groupMode, searchQuery]);

  useEffect(() => {
    if (!selectedId) {
      setSupportCallContact(null);
      return;
    }
    const row = rows.find((r) => r.id === selectedId);
    setSupportCallContact(row ? ticketSupportCallContact(row) : null);

    let cancelled = false;
    void (async () => {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token || cancelled) return;
      const res = await fetch(
        `/api/admin/support/tickets/${selectedId}/call-contact`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      ).catch(() => null);
      if (!res?.ok || cancelled) return;
      const body = (await res.json().catch(() => null)) as {
        contact?: SupportCallContactPrefill;
      } | null;
      if (body?.contact && !cancelled) {
        setSupportCallContact(body.contact);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Re-load when link / contact identity changes — not on every queue refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional narrow deps
  }, [
    selectedId,
    selected?.created_by,
    selected?.contact_email,
    selected?.submitter_name,
  ]);

  async function updateRow(
    id: string,
    patch: Partial<
      Pick<
        AdminTicketRow,
        "status" | "importance" | "ease" | "assigned_to" | "type" | "created_by" | "reopened_at"
      >
    >
  ) {
    if (patch.status === "open") patch = { ...patch, reopened_at: new Date().toISOString() };
    setSavingId(id);
    setError(null);
    const { error: updateError } = await supabaseClient
      .from("community_feedback_reports")
      .update(patch)
      .eq("id", id);
    setSavingId(null);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, ...patch };
        if (patch.assigned_to !== undefined) {
          next.assignee =
            assignees.find((a) => a.id === patch.assigned_to) ?? null;
        }
        if (patch.created_by !== undefined) {
          const coach = coaches.find((c) => c.id === patch.created_by);
          next.author = coach
            ? {
                id: coach.id,
                full_name: coach.full_name,
                first_name: coach.first_name,
                last_name: coach.last_name,
              }
            : null;
        }
        return next;
      })
    );
    notifySupportCountsChanged();
    if (patch.status === "resolved") {
      void (async () => {
        const {
          data: { session },
        } = await supabaseClient.auth.getSession();
        if (!session?.access_token) return;
        await fetch("/api/admin/support/mailbox", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: "tidy_ticket", ticketId: id }),
        }).catch(() => null);
      })();
    }
  }

  async function linkTicketCoach(ticketId: string, coachId: string | null) {
    const row = rows.find((r) => r.id === ticketId);
    await updateRow(ticketId, { created_by: coachId });
    if (!coachId || !row?.contact_email?.trim()) return;
    const email = row.contact_email.trim().toLowerCase();
    await supabaseClient.from("support_email_aliases").upsert(
      {
        email,
        profile_id: coachId,
        created_by: adminUserId,
      },
      { onConflict: "email" }
    );
  }

  async function deleteRow(row: AdminTicketRow) {
    const label = row.title?.trim() || formatSupportTicketId(row.ticket_number);
    if (!window.confirm(`Delete "${label}"? This can't be undone.`)) return;
    setSavingId(row.id);
    // Trash linked Gmail first (while we still have the ticket ids), so sync
    // won't recreate the ticket after we delete the DB row.
    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (session?.access_token) {
        await fetch("/api/admin/support/mailbox", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: "trash_ticket", ticketId: row.id }),
        });
      }
    } catch {
      // Best-effort; still delete the ticket locally.
    }
    const { error: deleteError } = await supabaseClient
      .from("community_feedback_reports")
      .delete()
      .eq("id", row.id);
    setSavingId(null);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    if (selectedId === row.id) setSelectedId(null);
    notifySupportCountsChanged();
  }

  /** Make the pinned thread for this coach, then open it to write the first message. */
  /**
   * Make the ticket behind a pinned thread the first time someone writes in it
   * (or asks Ava for a draft). The thread opens properly once the send lands.
   */
  async function createPinnedThread(): Promise<string | null> {
    const thread = launchThread(pendingThreadKey);
    const coachId = selectedChannel?.profileId;
    if (!thread || !coachId) return null;
    const { data, error: insertError } = await supabaseClient
      .from("community_feedback_reports")
      .insert({
        created_by: coachId,
        created_by_admin: adminUserId,
        source: "admin_created",
        assigned_to: DEFAULT_SUPPORT_ASSIGNEE_ID,
        type: thread.type,
        title: thread.label,
        details: thread.hint,
        status: "waiting_reply",
        topic: thread.key,
      })
      .select("id")
      .single();
    // Someone started it a moment ago: use that one instead.
    const id =
      data?.id ??
      (insertError?.code === "23505"
        ? (
            await supabaseClient
              .from("community_feedback_reports")
              .select("id")
              .eq("created_by", coachId)
              .eq("topic", thread.key)
              .maybeSingle()
          ).data?.id
        : null);
    if (!id) setError(insertError?.message ?? "Could not start the thread.");
    createdPinnedIdRef.current = id ?? null;
    return id ?? null;
  }

  /** After the first send or note in a new pinned thread, open it as a normal thread. */
  async function openCreatedPinnedThread() {
    const id = createdPinnedIdRef.current;
    if (!id) return;
    createdPinnedIdRef.current = null;
    await loadTickets();
    setPendingThreadKey(null);
    setSelectedId(id);
  }


  const showPeopleList = groupMode === "people" && !selectedPersonKey;
  const selectedPerson = selectedPersonKey
    ? personGroups.find((g) => g.key === selectedPersonKey) ?? null
    : null;
  const saving = selected ? savingId === selected.id : false;
  const score = selected ? supportTicketScore(selected) : null;
  // Back from the coach's page: the chat that went with you opens here again, in the middle.
  useEffect(() => {
    const open = dock?.entry?.id;
    if (!open) return;
    setSelectedId(open);
    dock.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on arrival only
  }, []);

  /** V2: open the page the chat is about, the chat moving to the right beside it. */
  function openChatPage(row: AdminTicketRow, to: string) {
    if (!dock) return;
    dock.show({
      id: row.id,
      title: row.title?.trim() || ticketAuthorLabel(row),
      status: shownTicketStatus(row),
      link: adminChatLinkFor(row),
      onStatus: (status) => updateRow(row.id, { status }),
      thread: ticketThread(row, "cards"),
    });
    dock.go(to);
  }

  /** The ticket's details: the right column in V1, the middle in V2 (with its status, which V1 keeps in the thread). */
  const ticketDetails =
    selected && !showPeopleList ? (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          {selected.created_by ? (
            <div className="mb-4">
              <span className="mb-1 block text-xs font-medium text-slate-600">What it&apos;s about</span>
              <SupportChatPagePicker key={selected.id} reportId={selected.id} value={selected.context_path ?? null} />
            </div>
          ) : null}
          <div>
            <span className="mb-1 block text-xs font-medium text-slate-600">
              Linked coach
            </span>
            <CoachSearchCombobox
              coaches={coaches}
              value={selected.created_by ?? ""}
              allowClear
              placeholder="Link to a coach…"
              onChange={(id) =>
                void linkTicketCoach(selected.id, id || null)
              }
            />
            {selected.contact_email ? (
              <p className="mt-1 truncate text-xs text-slate-500">
                {selected.contact_email}
              </p>
            ) : null}
            {selected.contact_email && !selected.created_by ? (
              <p className="mt-1 text-caption text-slate-500">
                Linking also remembers this email for future inbox
                mail.
              </p>
            ) : null}
            {selected.created_by ? (
              <div className="mt-2 grid grid-cols-2 overflow-hidden rounded-lg border border-sky-200 bg-sky-50">
                <a
                  href={`/admin/coaches/${encodeURIComponent(selected.created_by)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open coach profile"
                  className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap border-r border-sky-200 px-2 py-1.5 text-xs font-semibold text-sky-900 hover:bg-sky-100"
                >
                  <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Profile
                </a>
                <a
                  href={`/coach/support?impersonate=${encodeURIComponent(selected.created_by)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open their Support inbox"
                  className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap px-2 py-1.5 text-xs font-semibold text-sky-900 hover:bg-sky-100"
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Their inbox
                </a>
                <a
                  href={`/admin/blueprint/coach?coach=${encodeURIComponent(selected.created_by)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open their Blueprint in admin"
                  className="col-span-2 inline-flex items-center justify-center gap-1.5 whitespace-nowrap border-t border-sky-200 px-2 py-1.5 text-xs font-semibold text-sky-900 hover:bg-sky-100"
                >
                  <ClipboardList className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Blueprint
                </a>
              </div>
            ) : null}
          </div>

          <div className="mt-4 space-y-2 border-t border-slate-200 pt-4">
            <label className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-xs font-medium text-slate-600">
                Assignee
              </span>
              <select
                value={selected.assigned_to ?? ""}
                disabled={saving}
                onChange={(e) =>
                  void updateRow(selected.id, {
                    assigned_to: e.target.value || null,
                  })
                }
                className={fieldClass("select", "small", "min-w-0 flex-1")}
              >
                <option value="">Anyone</option>
                {assigneePickerOptions(
                  assignees,
                  selected.assignee
                ).map((a) => (
                  <option key={a.id} value={a.id}>
                    {assigneeShortName(a)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-xs font-medium text-slate-600">
                Type
              </span>
              <select
                value={selected.type}
                disabled={saving}
                onChange={(e) =>
                  void updateRow(selected.id, {
                    type: e.target.value as SupportTicketType,
                  })
                }
                className={fieldClass("select", "small", "min-w-0 flex-1 [color-scheme:light]")}
              >
                {(
                  Object.keys(
                    SUPPORT_TYPE_LABELS
                  ) as SupportTicketType[]
                ).map((t) => (
                  <option
                    key={t}
                    value={t}
                    className="bg-white text-slate-900"
                  >
                    {supportTypeOptionLabel(t)}
                  </option>
                ))}
              </select>
            </label>

            {selected.type === "idea" ? (
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">
                    Importance
                  </span>
                  <select
                    value={selected.importance ?? ""}
                    disabled={saving}
                    onChange={(e) =>
                      void updateRow(selected.id, {
                        importance: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                    className={fieldClass("select", "small")}
                  >
                    <option value="">—</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">
                    Ease
                  </span>
                  <select
                    value={selected.ease ?? ""}
                    disabled={saving}
                    onChange={(e) =>
                      void updateRow(selected.id, {
                        ease: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                    className={fieldClass("select", "small")}
                  >
                    <option value="">—</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="col-span-2 text-xs text-slate-500">
                  Score: {score ?? "—"}
                </p>
              </div>
            ) : null}
          </div>

          {(() => {
            const contact =
              supportCallContact ?? ticketSupportCallContact(selected);
            const guestLabel =
              [contact.firstName, contact.lastName]
                .filter(Boolean)
                .join(" ")
                .trim() || ticketAuthorLabel(selected);
            return (
              <SupportTicketBookCall
                key={`${selected.id}:${pamAssigneeId ?? ""}`}
                ticketId={selected.id}
                defaultHost={defaultSupportHost(
                  selected.assigned_to,
                  pamAssigneeId
                )}
                guestLabel={guestLabel}
                guestEmail={contact.email?.trim() || null}
                onOpenSettings={() => selectTopTab("settings")}
                onBooked={() => {
                  setThreadRefreshKey((n) => n + 1);
                  void loadAttention();
                }}
              />
            );
          })()}

          <SupportTicketCoachPayments coachId={selected.created_by} />

          <div className="mt-6 border-t border-slate-200 pt-3">
            <p className="text-kicker font-semibold uppercase text-slate-400">
              Source
            </p>
            <p className="mt-0.5 text-xs font-medium text-slate-700">
              {SUPPORT_SOURCE_LABELS[selected.source]}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 bg-white px-4 py-2">
          <p className="text-caption tabular-nums text-slate-400">
            {formatSupportTicketId(selected.ticket_number)}
          </p>
          <button
            type="button"
            disabled={saving}
            onClick={() => void deleteRow(selected)}
            className={buttonClass("delete", "small")}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Delete
          </button>
        </div>
      </div>
    ) : null;

  /** V2's details: one narrow column, who it's from, then the ticket's settings, Delete at the foot. */
  function v2Details(row: AdminTicketRow) {
    const busy = savingId === row.id;
    const contact = supportCallContact ?? ticketSupportCallContact(row);
    const guestLabel = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim() || ticketAuthorLabel(row);
    const label = "mb-1.5 block text-caption font-medium text-slate-500";
    const quietLink = "inline-flex items-center gap-1 text-caption font-medium text-[#0c5290] hover:underline";
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          <div className="flex items-center gap-3">
            <ListAvatar label={ticketAuthorLabel(row)} avatarUrl={ticketAuthorAvatarUrl(row)} />
            <div className="min-w-0">
              <p className="truncate text-ui font-semibold text-slate-900">{ticketAuthorLabel(row)}</p>
              {row.contact_email ? <p className="truncate text-caption text-slate-500">{row.contact_email}</p> : null}
            </div>
          </div>
          {row.created_by ? (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
              <a href={`/admin/coaches/${encodeURIComponent(row.created_by)}`} target="_blank" rel="noopener noreferrer" className={quietLink}>
                <UserRound className="h-3.5 w-3.5" aria-hidden />
                Profile
              </a>
              <a href={`/coach/support?impersonate=${encodeURIComponent(row.created_by)}`} target="_blank" rel="noopener noreferrer" className={quietLink}>
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                Their inbox
              </a>
              <a href={`/admin/blueprint/coach?coach=${encodeURIComponent(row.created_by)}`} target="_blank" rel="noopener noreferrer" className={quietLink}>
                <ClipboardList className="h-3.5 w-3.5" aria-hidden />
                Blueprint
              </a>
            </div>
          ) : null}

          <div className="mt-5 space-y-4 border-t border-slate-100 pt-5">
            <label className="block">
              <span className={label}>Status</span>
              <select
                value={shownTicketStatus(row)}
                disabled={busy}
                onChange={(e) => void updateRow(row.id, { status: e.target.value as SupportTicketStatus })}
                className={fieldClass("select", "small")}
              >
                {(Object.keys(SUPPORT_STATUS_ADMIN_LABELS) as SupportTicketStatus[]).map((st) => (
                  <option key={st} value={st}>
                    {SUPPORT_STATUS_ADMIN_LABELS[st]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={label}>Assignee</span>
              <select
                value={row.assigned_to ?? ""}
                disabled={busy}
                onChange={(e) => void updateRow(row.id, { assigned_to: e.target.value || null })}
                className={fieldClass("select", "small")}
              >
                <option value="">Anyone</option>
                {assigneePickerOptions(assignees, row.assignee).map((a) => (
                  <option key={a.id} value={a.id}>
                    {assigneeShortName(a)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={label}>Type</span>
              <select
                value={row.type}
                disabled={busy}
                onChange={(e) => void updateRow(row.id, { type: e.target.value as SupportTicketType })}
                className={fieldClass("select", "small", "[color-scheme:light]")}
              >
                {(Object.keys(SUPPORT_TYPE_LABELS) as SupportTicketType[]).map((t) => (
                  <option key={t} value={t}>
                    {supportTypeOptionLabel(t)}
                  </option>
                ))}
              </select>
            </label>
            {row.type === "idea" ? (
              <div className="grid grid-cols-2 gap-2">
                {(["importance", "ease"] as const).map((key) => (
                  <label key={key} className="block">
                    <span className={label}>{key === "importance" ? "Importance" : "Ease"}</span>
                    <select
                      value={row[key] ?? ""}
                      disabled={busy}
                      onChange={(e) => void updateRow(row.id, { [key]: e.target.value ? Number(e.target.value) : null })}
                      className={fieldClass("select", "small")}
                    >
                      <option value="">None</option>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                <p className="col-span-2 text-caption text-slate-500">Score: {supportTicketScore(row) ?? "none yet"}</p>
              </div>
            ) : null}
            {row.created_by ? (
              <div>
                <span className={label}>What it&apos;s about</span>
                <SupportChatPagePicker key={row.id} reportId={row.id} value={row.context_path ?? null} stacked />
              </div>
            ) : null}
            <div>
              <span className={label}>Linked coach</span>
              <CoachSearchCombobox
                coaches={coaches}
                value={row.created_by ?? ""}
                allowClear
                placeholder="Link to a coach…"
                onChange={(id) => void linkTicketCoach(row.id, id || null)}
              />
              {row.contact_email && !row.created_by ? (
                <p className="mt-1.5 text-caption text-slate-500">Linking also remembers this email for future mail.</p>
              ) : null}
            </div>
          </div>

          {/* Book a call draws its own rule above it. */}
          <div className="space-y-2">
            <SupportTicketBookCall
              key={`${row.id}:${pamAssigneeId ?? ""}`}
              ticketId={row.id}
              defaultHost={defaultSupportHost(row.assigned_to, pamAssigneeId)}
              guestLabel={guestLabel}
              guestEmail={contact.email?.trim() || null}
              onOpenSettings={() => selectTopTab("settings")}
              onBooked={() => {
                setThreadRefreshKey((n) => n + 1);
                void loadAttention();
              }}
            />
            <SupportTicketCoachPayments coachId={row.created_by} />
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
          <div className="min-w-0 text-caption leading-tight text-slate-400">
            <p className="tabular-nums">{formatSupportTicketId(row.ticket_number)}</p>
            <p className="truncate">{SUPPORT_SOURCE_LABELS[row.source]}</p>
          </div>
          <button type="button" disabled={busy} onClick={() => void deleteRow(row)} className={buttonClass("delete", "small")}>
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Delete
          </button>
        </div>
      </div>
    );
  }

  /** A ticket's thread with every admin tool: in the page (V1), or docked on the right (V2). */
  function ticketThread(row: AdminTicketRow, layout: SupportThreadLayout) {
    return (
      <AdminTicketReplies
        reportId={row.id}
        reportStatus={shownTicketStatus(row)}
        variant="inbox"
        canEmailNotify={Boolean(row.created_by || row.contact_email?.trim())}
        emailNotifyDefault={supportNotifyDefaultOn(row.source, row.member_notify_email)}
        sendAsOptions={assignees}
        supportCallContact={
          supportCallContact ?? ticketSupportCallContact(row)
        }
        statusSaving={savingId === row.id}
        onStatusChange={(status) =>
          void updateRow(row.id, { status })
        }
        messageLayout={layout}
        header={groupMode === "channels" ? adminJobBrief(launchThread(row.topic)) ?? undefined : undefined}
        extraReplies={
          groupMode === "channels" && launchThread(row.topic)
            ? blueprintByThread[row.topic!]
            : undefined
        }
        openingMessage={launchThread(row.topic) ? {
          pinned: true,
          authorLabel: "BCA",
          authorAvatarUrl: null,
          title: launchThread(row.topic)!.label,
          body: launchThread(row.topic)!.hint,
          createdAt: row.created_at,
          typeLabel:
            LAUNCH_PHASES.find((p) => p.key === launchThread(row.topic)!.phase)?.label ??
            "Pinned thread",
          media: null,
          viaEmail: false,
        } : {
          authorLabel: supportChatOpenedByBca(row)
            ? row.opener
              ? authorDisplayName(row.opener)
              : "BCA"
            : ticketAuthorLabel(row),
          authorAvatarUrl: supportChatOpenedByBca(row)
            ? (row.opener?.avatar_url ?? null)
            : (row.author?.avatar_url ?? null),
          title: row.title?.trim() || "(No subject)",
          body: row.details,
          createdAt: row.created_at,
          typeLabel: supportTypeOptionLabel(row.type),
          media: row.media,
          viaEmail: row.source === "email_inbox",
          seenAt: row.opening_seen_at ?? null,
          byBca: supportChatOpenedByBca(row),
        }}
        onStatusTouched={() => {
          void loadTickets();
          notifySupportCountsChanged();
        }}
        onInternalNoteSaved={() => {
          void loadAttention();
        }}
        threadRefreshKey={threadRefreshKey}
      />
    );
  }

  return (
    <DashboardPageSection
      contentMaxWidthClass={topTab === "settings" ? "max-w-6xl" : "max-w-none"}
      gapClass={topTab === "settings" ? "gap-6" : "gap-0"}
      outerClassName="flex h-full min-h-0 flex-1 flex-col"
      contentClassName={
        topTab === "settings"
          ? // Inbox shell is overflow-hidden; settings must scroll inside it.
            "!mx-0 mr-auto min-h-0 w-full flex-1 overflow-y-auto overscroll-contain px-4 pb-8 pt-6 md:px-[60px]"
          : "min-h-0 flex-1 overflow-hidden"
      }
      header={
        <StickyPageHeader
          className="shrink-0"
          bleedInset="px-4 md:px-6"
          title="Support"
          description={
            topTab === "settings"
              ? "Who can take support calls, and when."
              : "Ticket inbox for coach questions, bugs, ideas, and private lesson asks."
          }
          tabs={
            <PageHeaderUnderlineTabs
              ariaLabel="Support sections"
              items={[
                {
                  kind: "button",
                  id: "inbox",
                  label: "Inbox",
                  active: topTab === "inbox",
                  onClick: () => selectTopTab("inbox"),
                },
                {
                  kind: "button",
                  id: "settings",
                  label: "Settings",
                  active: topTab === "settings",
                  onClick: () => selectTopTab("settings"),
                },
              ]}
            />
          }
          actions={
            topTab === "inbox" ? (
              <div className="flex flex-wrap items-center gap-2">
                <SupportMailboxConnect />
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className={buttonClass("main")}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  New ticket
                </button>
              </div>
            ) : null
          }
        />
      }
    >
      {topTab === "settings" ? (
        <SupportCallAdminSettings appOrigin={appOrigin} />
      ) : (
        <>
      {createOpen ? (
        <div
          className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Create support ticket"
          onClick={() => setCreateOpen(false)}
        >
          <div
            className="my-4 w-full max-w-[40.5rem] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <SupportCreateTicketComposer
              coachOptions={coaches}
              assigneeOptions={assignees}
              createdByAdminId={adminUserId}
              onClose={() => setCreateOpen(false)}
              onCreated={(created, result) => {
                const row: AdminTicketRow = {
                  id: created.id,
                  created_at: created.created_at,
                  created_by: created.created_by,
                  ticket_number: created.ticket_number,
                  type: created.type,
                  title: created.title,
                  details: created.details,
                  page_path: created.page_path,
                  status: created.status,
                  source: created.source,
                  assigned_to: created.assigned_to,
                  community_post_id: created.community_post_id,
                  contact_email: created.contact_email,
                  submitter_name: created.submitter_name,
                  importance: created.importance,
                  ease: created.ease,
                  media: created.media,
                  member_notify_email: created.member_notify_email,
                  author: created.author
                    ? {
                        id: created.author.id,
                        full_name: created.author.full_name,
                        first_name: created.author.first_name,
                        last_name: created.author.last_name,
                        avatar_url: created.author.avatar_url,
                        role: created.author.role,
                      }
                    : null,
                  opener: assignees.find((a) => a.id === adminUserId) ?? null,
                  assignee: created.assignee
                    ? {
                        id: created.assignee.id,
                        full_name: created.assignee.full_name,
                        first_name: created.assignee.first_name,
                        last_name: created.assignee.last_name,
                        avatar_url: created.assignee.avatar_url,
                        role: created.assignee.role,
                      }
                    : null,
                  lastUnrepliedMemberAt: created.created_at,
                  lastActivityAt: created.created_at,
                  lastMessage: null,
                  replyCount: 0,
                  nothingToAnswer: true,
                  topic: null,
                };
                setRows((prev) => [row, ...prev]);
                setSelectedId(row.id);
                setCreateOpen(false);
                if (result?.emailError) {
                  setCreateNotice(null);
                  setError(result.emailError);
                } else if (result?.emailed) {
                  setError(null);
                  setCreateNotice(`Emailed ${result.emailed}.`);
                }
              }}
            />
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col max-lg:min-h-[calc(100dvh-8rem)]">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
          <div
            className={`grid h-full min-h-0 min-w-0 grid-cols-1 grid-rows-[minmax(0,1fr)] overflow-hidden ${
              groupMode === "channels"
                ? "lg:grid-cols-[minmax(13rem,17rem)_minmax(0,1fr)] xl:grid-cols-[minmax(13rem,17rem)_minmax(0,1fr)_18rem]"
                : v2
                  ? // V2: the list and the details the same width either side, the chat about chat-box width between.
                    "lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)] xl:grid-cols-[minmax(16rem,28%)_minmax(0,1fr)_minmax(16rem,28%)]"
                  : "lg:grid-cols-[minmax(0,28%)_minmax(0,1fr)] xl:grid-cols-[minmax(0,26%)_minmax(0,1fr)_minmax(0,22%)]"
            }`}
          >
            {/* Left: queue */}
            <aside
              className={`flex min-h-0 min-w-0 flex-col overflow-hidden border-b border-slate-200 lg:border-b-0 lg:border-r ${
                groupMode !== "channels"
                  ? "max-lg:max-h-[42vh]"
                  : phoneChannelOpen
                    ? "bg-slate-300/70 max-lg:hidden"
                    : "bg-slate-300/70 max-lg:border-b-0"
              }`}
            >
              <div className="shrink-0 space-y-2 border-b border-slate-100 px-3 py-2.5">
                <div className="inline-flex w-full rounded-lg border border-slate-200 bg-slate-100 p-0.5">
                  <button
                    type="button"
                    aria-pressed={groupMode === "tickets"}
                    onClick={() => setGroupMode("tickets")}
                    className={queueSegmentClass(groupMode === "tickets")}
                  >
                    Tickets
                  </button>
                  <button
                    type="button"
                    aria-pressed={groupMode === "people"}
                    onClick={() => setGroupMode("people")}
                    className={queueSegmentClass(groupMode === "people")}
                  >
                    By coach
                  </button>
                  <button
                    type="button"
                    aria-pressed={groupMode === "channels"}
                    onClick={() => setGroupMode("channels")}
                    className={queueSegmentClass(groupMode === "channels")}
                  >
                    Channels
                  </button>
                </div>

                {groupMode !== "channels" ? (
                <>
                <div
                  className="inline-flex w-full rounded-lg border border-slate-200 bg-slate-100 p-0.5"
                  role="group"
                  aria-label="Filter by assignee"
                >
                  {ASSIGNEE_FILTERS.map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      aria-pressed={assigneeFilter === filter.id}
                      onClick={() => setAssigneeFilter(filter.id)}
                      className={queueSegmentClass(assigneeFilter === filter.id)}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as SupportStatusFilter)
                  }
                  aria-label="Filter by status"
                  className={filterSelectClass}
                >
                  {STATUS_FILTER_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                </>
                ) : null}

                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={groupMode === "channels" ? "Search coaches…" : "Search tickets…"}
                    className={fieldClass("input", "small", "pl-8")}
                  />
                </div>
                {groupMode === "channels" ? (
                  <div
                    className="inline-flex w-full rounded-lg border border-slate-200 bg-slate-100 p-0.5"
                    role="group"
                    aria-label="Sort channels"
                  >
                    {CHANNEL_SORT_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      const active = channelSort === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          title={option.hint}
                          aria-pressed={active}
                          onClick={() => {
                            setChannelSort(option.id);
                            window.localStorage.setItem(CHANNEL_SORT_STORAGE_KEY, option.id);
                          }}
                          className={`inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-1.5 py-1.5 text-xs font-semibold transition-colors ${
                            active
                              ? "bg-white text-slate-900 shadow-sm"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              {error ? (
                <p className="shrink-0 border-b border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {error}
                </p>
              ) : createNotice ? (
                <p className="shrink-0 border-b border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  {createNotice}
                </p>
              ) : null}

              {groupMode === "channels" ? (
                <ChannelList
                  groups={channelGroups}
                  sort={channelSort}
                  loading={loading}
                  selectedKey={selectedChannel?.key ?? null}
                  onSelect={(key) => {
                    setSelectedChannelKey(key);
                    setPendingThreadKey(null);
                    setPageChatSlug(null);
                    setSelectedId(null);
                    setPhoneChannelOpen(true);
                  }}
                />
              ) : showPeopleList ? (
                <ul className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
                  {loading && personGroups.length === 0 ? (
                    <li className="px-4 py-8 text-sm text-slate-500">
                      Loading support tickets…
                    </li>
                  ) : personGroups.length === 0 ? (
                    <li className="px-4 py-8 text-sm text-slate-500">
                      No people match these filters.
                    </li>
                  ) : (
                    personGroups.map((group, index) => {
                      const ageBand = personListBand(group, statusFilter);
                      const prevBand =
                        index > 0
                          ? personListBand(personGroups[index - 1], statusFilter)
                          : null;
                      const showBandHeader = ageBand !== prevBand;
                      const isWaiting = ageBand === WAITING_ON_REPLY_BAND;
                      if (isWaiting && !waitingSectionOpen && !showBandHeader) {
                        return null;
                      }
                      return (
                        <Fragment key={group.key}>
                          {showBandHeader ? (
                            isWaiting ? (
                              <WaitingSectionHeader
                                count={waitingPersonCount}
                                open={waitingSectionOpen}
                                onToggle={() =>
                                  setWaitingSectionOpen((open) => !open)
                                }
                              />
                            ) : (
                              <li className="sticky top-0 z-[1] bg-slate-100 px-3.5 py-1.5">
                                <p className="text-kicker font-semibold uppercase text-slate-500">
                                  {ageBand}
                                </p>
                              </li>
                            )
                          ) : null}
                          {isWaiting && !waitingSectionOpen ? null : (
                          <li className={isWaiting ? "bg-slate-50 px-2 py-0.5" : "px-2 py-0.5"}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPersonKey(group.key);
                                setSelectedId(group.tickets[0]?.id ?? null);
                              }}
                              className={`flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left ${
                                isWaiting
                                  ? "opacity-65 hover:bg-white/80 hover:opacity-100"
                                  : "hover:bg-slate-50"
                              }`}
                            >
                              <ListAvatar
                                label={group.label}
                                avatarUrl={group.avatarUrl}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-1.5">
                                  <span className="truncate text-sm font-medium text-slate-900">
                                    {group.label}
                                  </span>
                                  {group.openCount > 0 ? (
                                    <span className="inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-sky-600 px-1 text-caption font-semibold text-white">
                                      {group.openCount}
                                    </span>
                                  ) : null}
                                </span>
                                <span className="mt-0.5 block truncate text-xs text-slate-500">
                                  {group.tickets.length} ticket
                                  {group.tickets.length === 1 ? "" : "s"}
                                  {group.email ? ` · ${group.email}` : ""}
                                </span>
                              </span>
                              <ChevronRight
                                className="mt-2 h-4 w-4 shrink-0 text-slate-300"
                                aria-hidden
                              />
                            </button>
                          </li>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </ul>
              ) : (
                <ul className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
                  {groupMode === "people" && selectedPerson ? (
                    <li className="sticky top-0 z-[2] border-b border-slate-100 bg-slate-50 px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPersonKey(null);
                          setSelectedId(null);
                        }}
                        className={buttonClass("quiet", "small")}
                      >
                        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                        {selectedPerson.label}
                      </button>
                    </li>
                  ) : null}

                  {loading && listTickets.length === 0 ? (
                    <li className="px-4 py-8 text-sm text-slate-500">
                      Loading support tickets…
                    </li>
                  ) : listTickets.length === 0 ? (
                    <li className="px-4 py-8 text-sm text-slate-500">
                      No tickets match these filters.
                    </li>
                  ) : (
                    listTickets.map((row, index) => {
                      const active = selectedId === row.id;
                      const attention = attentionByTicket[row.id];
                      const badgeCount = supportAttentionBadgeCount(attention);
                      const isNew = Boolean(attention);
                      const ageBand = inboxListBand(row, statusFilter);
                      const prevBand =
                        index > 0
                          ? inboxListBand(listTickets[index - 1], statusFilter)
                          : null;
                      const showBandHeader = ageBand !== prevBand;
                      const isWaiting = ageBand === WAITING_ON_REPLY_BAND;
                      const preview = ticketListPreview(row);
                      const listAt =
                        statusFilter === "open"
                          ? ticketNeedsStaffReply(row)
                            ? row.lastUnrepliedMemberAt || row.created_at
                            : row.lastActivityAt || row.created_at
                          : row.created_at;
                      if (isWaiting && !waitingSectionOpen && !showBandHeader) {
                        return null;
                      }
                      return (
                        <Fragment key={row.id}>
                          {showBandHeader ? (
                            isWaiting ? (
                              <WaitingSectionHeader
                                count={waitingTicketCount}
                                open={waitingSectionOpen}
                                onToggle={() =>
                                  setWaitingSectionOpen((open) => !open)
                                }
                              />
                            ) : (
                              <li className="sticky top-0 z-[1] bg-slate-100 px-3.5 py-1.5">
                                <p className="text-kicker font-semibold uppercase text-slate-500">
                                  {ageBand}
                                </p>
                              </li>
                            )
                          ) : null}
                          {isWaiting && !waitingSectionOpen ? null : (
                          <li
                            className={
                              isWaiting ? "bg-slate-50 px-2 py-0.5" : "px-2 py-0.5"
                            }
                          >
                            <button
                              type="button"
                              onClick={() => setSelectedId(row.id)}
                              className={`flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left ${
                                active
                                  ? "bg-sky-50/80 ring-1 ring-sky-200"
                                  : isWaiting
                                    ? "opacity-65 hover:bg-white/80 hover:opacity-100"
                                    : "hover:bg-slate-50"
                              }`}
                            >
                              <ListAvatar
                                label={ticketAuthorLabel(row)}
                                avatarUrl={ticketAuthorAvatarUrl(row)}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-1.5">
                                  <span
                                    className={`min-w-0 flex-1 truncate text-sm ${
                                      isNew
                                        ? "font-semibold text-slate-900"
                                        : "font-medium text-slate-800"
                                    }`}
                                  >
                                    {row.title?.trim() ||
                                      formatSupportTicketId(row.ticket_number)}
                                  </span>
                                  {attention?.mention ? (
                                    <span
                                      className="shrink-0 rounded bg-amber-100 px-1 py-0.5 text-caption font-semibold text-amber-900"
                                      title="You were mentioned"
                                    >
                                      @
                                    </span>
                                  ) : null}
                                  {badgeCount > 0 ? (
                                    <span className="inline-flex min-w-[1.15rem] shrink-0 items-center justify-center rounded-full bg-sky-600 px-1 text-caption font-semibold text-white">
                                      {badgeCount}
                                    </span>
                                  ) : null}
                                  {/* The jobs' own chip (12 Nov): status on the title line, time on the message line. */}
                                  <JobStatusChip status={SUPPORT_STATUS_JOB[shownTicketStatus(row)]} audience="admin" />
                                </span>
                                <span className="mt-0.5 flex min-w-0 items-baseline gap-1.5 text-xs text-slate-500">
                                  <span className="max-w-[40%] shrink truncate font-medium text-slate-600">
                                    {preview.name}
                                  </span>
                                  <span className="min-w-0 flex-1 truncate">
                                    {previewText(preview.text, 96) ||
                                      SUPPORT_TYPE_LABELS[row.type]}
                                  </span>
                                  <span className="shrink-0 text-caption tabular-nums text-slate-400">
                                    {formatSupportRelativeCompact(listAt)}
                                  </span>
                                </span>
                              </span>
                            </button>
                          </li>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </ul>
              )}
            </aside>

            {groupMode === "channels" && !selected && !pendingThreadKey && pageChatSlug && selectedChannel?.profileId ? (
              <ChannelPageChat
                key={`${selectedChannel.profileId}:${pageChatSlug}`}
                coachId={selectedChannel.profileId}
                slug={pageChatSlug}
                channelLabel={selectedChannel.label}
                className={`max-lg:min-h-[min(70dvh,36rem)] ${phoneChannelOpen ? "" : "max-lg:hidden"}`}
                onBack={() => {
                  setPageChatSlug(null);
                  setThreadRefreshKey((n) => n + 1);
                }}
              />
            ) : groupMode === "channels" && !selected && !pendingThreadKey ? (
              <ChannelFeed
                channel={selectedChannel}
                blueprintByThread={blueprintByThread}
                pageChats={pageChats}
                onSelectPageChat={(slug) => {
                  setPendingThreadKey(null);
                  setSelectedId(null);
                  setPageChatSlug(slug);
                }}
                progress={launchProgress}
                className={phoneChannelOpen ? "" : "max-lg:hidden"}
                onPhoneBack={() => setPhoneChannelOpen(false)}
                attentionByTicket={attentionByTicket}
                refreshKey={threadRefreshKey}
                onSelect={(id) => {
                  setPendingThreadKey(null);
                  setSelectedId(id);
                }}
                onSelectEmptyThread={(key) => {
                  setPendingThreadKey(key);
                  setSelectedId(null);
                }}
              />
            ) : v2 ? (
            // V2: the chat in the middle, drawn as coaches see it. Its page pill moves it to the right beside that page.
            <section className="bp-doc bp-clean-side bp-chat-side flex min-h-0 min-w-0 flex-col">
              {showPeopleList ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                  <Users className="h-8 w-8 text-slate-400" aria-hidden />
                  <p className="text-sm font-medium text-slate-900">Choose a coach</p>
                  <p className="max-w-sm text-xs text-slate-600">Open someone to see their tickets.</p>
                </div>
              ) : selected ? (
                (() => {
                  const link = adminChatLinkFor(selected);
                  const status = shownTicketStatus(selected);
                  return (
                    <AdminChatPanel
                      key={selected.id}
                      title={selected.title?.trim() || ticketAuthorLabel(selected)}
                      status={status}
                      onStatus={(next) => void updateRow(selected.id, { status: next })}
                      link={link ? <AdminChatLinkPill link={link} onOpen={() => openChatPage(selected, link.to)} /> : null}
                    >
                      {ticketThread(selected, "cards")}
                    </AdminChatPanel>
                  );
                })()
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-1 px-6 text-center">
                  <p className="text-sm font-medium text-slate-900">Nothing open</p>
                  <p className="text-xs text-slate-500">Pick a ticket on the left.</p>
                </div>
              )}
            </section>
            ) : (
            <section
              className={`flex min-h-0 min-w-0 flex-col overflow-hidden max-lg:min-h-[min(70dvh,36rem)] ${
                groupMode === "channels" && !phoneChannelOpen ? "max-lg:hidden" : ""
              }`}
            >
              {groupMode === "channels" && selectedChannel ? (
                <ChannelThreadHeader
                  channelLabel={selectedChannel.label}
                  thread={selected ? launchThread(selected.topic) : launchThread(pendingThreadKey)}
                  title={selected?.title?.trim() || "(No subject)"}
                  onBack={() => {
                    setSelectedId(null);
                    setPendingThreadKey(null);
                  }}
                >
                  {selected ? (
                    <>
                      <select
                        value={selected.assigned_to ?? ""}
                        disabled={saving}
                        onChange={(e) =>
                          void updateRow(selected.id, {
                            assigned_to: e.target.value || null,
                          })
                        }
                        className={fieldClass("select", "small", "w-auto! max-w-[7.5rem]")}
                        aria-label="Assignee"
                      >
                        <option value="">Anyone</option>
                        {assigneePickerOptions(assignees, selected.assignee).map((a) => (
                          <option key={a.id} value={a.id}>
                            {assigneeShortName(a)}
                          </option>
                        ))}
                      </select>
                      <select
                        value={shownTicketStatus(selected)}
                        disabled={saving}
                        onChange={(e) =>
                          void updateRow(selected.id, {
                            status: e.target.value as SupportTicketStatus,
                          })
                        }
                        className={fieldClass("select", "small", "w-auto!")}
                        aria-label="Status"
                      >
                        {(Object.keys(SUPPORT_STATUS_ADMIN_LABELS) as SupportTicketStatus[]).map((s) => (
                          <option key={s} value={s}>
                            {SUPPORT_STATUS_ADMIN_LABELS[s]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void deleteRow(selected)}
                        className="rounded-md p-1.5 text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                        aria-label="Delete thread"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  ) : null}
                </ChannelThreadHeader>
              ) : null}
              {showPeopleList ? (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
                  <Users className="h-8 w-8 text-slate-400" aria-hidden />
                  <p className="text-sm font-medium text-slate-900">
                    Choose a coach
                  </p>
                  <p className="max-w-sm text-xs text-slate-600">
                    Open someone to see their tickets, then reply in the thread.
                  </p>
                </div>
              ) : groupMode === "channels" && pendingThreadKey && selectedChannel ? (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <AdminTicketReplies
                    key={`${selectedChannel.key}:${pendingThreadKey}`}
                    reportId=""
                    createReport={createPinnedThread}
                    reportStatus="waiting_reply"
                    variant="inbox"
                    canEmailNotify={Boolean(selectedChannel.profileId)}
                    emailNotifyDefault={false}
                    sendAsOptions={assignees}
                    messageLayout="slack"
                    header={
                      launchThread(pendingThreadKey)?.phase ? (
                        <>
                          {adminJobBrief(launchThread(pendingThreadKey))}
                          <BlueprintCommentsBlock comments={blueprintByThread[pendingThreadKey] ?? []} audience="admin" />
                        </>
                      ) : (
                        <ThreadWelcome
                          thread={launchThread(pendingThreadKey)}
                          comments={blueprintByThread[pendingThreadKey] ?? []}
                          coachLabel={selectedChannel.label}
                        />
                      )
                    }
                    onStatusTouched={() => {
                      void openCreatedPinnedThread();
                      notifySupportCountsChanged();
                    }}
                    onInternalNoteSaved={() => {
                      void openCreatedPinnedThread();
                      void loadAttention();
                    }}
                  />
                </div>
              ) : selected ? (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <div
                    className={`flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5 xl:hidden ${
                      groupMode === "channels" ? "hidden!" : ""
                    }`}
                  >
                    {selected.created_by ? (
                      <span className="inline-flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                        <a
                          href={`/admin/coaches/${encodeURIComponent(selected.created_by)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open coach profile"
                          className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:underline"
                        >
                          <UserRound className="h-3 w-3" aria-hidden />
                          Profile
                        </a>
                        <a
                          href={`/coach/support?impersonate=${encodeURIComponent(selected.created_by)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open their Support inbox"
                          className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" aria-hidden />
                          Their inbox
                        </a>
                      </span>
                    ) : (
                      <span />
                    )}
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      <select
                        value={selected.assigned_to ?? ""}
                        disabled={saving}
                        onChange={(e) =>
                          void updateRow(selected.id, {
                            assigned_to: e.target.value || null,
                          })
                        }
                        className={fieldClass("select", "small", "w-auto! max-w-[7.5rem]")}
                        aria-label="Assignee"
                      >
                        <option value="">Anyone</option>
                        {assigneePickerOptions(assignees, selected.assignee).map(
                          (a) => (
                            <option key={a.id} value={a.id}>
                              {assigneeShortName(a)}
                            </option>
                          )
                        )}
                      </select>
                      <select
                        value={shownTicketStatus(selected)}
                        disabled={saving}
                        onChange={(e) =>
                          void updateRow(selected.id, {
                            status: e.target.value as SupportTicketStatus,
                          })
                        }
                        className={fieldClass("select", "small", "w-auto!")}
                        aria-label="Status"
                      >
                        {(
                          Object.keys(
                            SUPPORT_STATUS_ADMIN_LABELS
                          ) as SupportTicketStatus[]
                        ).map((s) => (
                          <option key={s} value={s}>
                            {SUPPORT_STATUS_ADMIN_LABELS[s]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void deleteRow(selected)}
                        className="rounded-md p-1.5 text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                        aria-label="Delete ticket"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    {ticketThread(selected, groupMode === "channels" ? "slack" : "bubbles")}
                  </div>
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 bg-white px-6 text-center">
                  <p className="text-sm font-medium text-slate-900">
                    {groupMode === "channels" ? "No message selected" : "No ticket selected"}
                  </p>
                  <p className="max-w-sm text-xs text-slate-600">
                    {groupMode === "channels"
                      ? "Pick a message in the channel to open its thread."
                      : "Pick a ticket from the queue to read and reply."}
                  </p>
                </div>
              )}
            </section>
            )}

            {groupMode === "channels" && selectedChannel ? (
              <aside className="hidden min-h-0 min-w-0 flex-col overflow-y-auto overscroll-contain border-l border-slate-200 bg-white xl:flex">
                {openJobThread && openJobThread.phase !== null ? (
                  <section className="space-y-4 border-b border-slate-200 p-5">
                    <div>
                      <p className="text-kicker font-semibold uppercase tracking-wide text-slate-400">The job</p>
                      <h3 className="mt-1 text-base font-semibold text-slate-900">{openJobThread.label}</h3>
                    </div>
                    <JobChecklist job={launchProgress[openJobThread.key]} audience="admin" />
                  </section>
                ) : null}
                {selected ? (
                  <section className="space-y-3 border-b border-slate-200 p-5">
                    <h3 className="text-kicker font-semibold uppercase tracking-wide text-slate-400">
                      This thread
                    </h3>
                    <label className="flex items-center gap-3">
                      <span className="w-16 shrink-0 text-xs font-medium text-slate-600">Assigned</span>
                      <select
                        value={selected.assigned_to ?? ""}
                        disabled={saving}
                        onChange={(e) => void updateRow(selected.id, { assigned_to: e.target.value || null })}
                        className={fieldClass("select", "small", "min-w-0 flex-1")}
                      >
                        <option value="">Anyone</option>
                        {assigneePickerOptions(assignees, selected.assignee).map((a) => (
                          <option key={a.id} value={a.id}>
                            {assigneeShortName(a)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-3">
                      <span className="w-16 shrink-0 text-xs font-medium text-slate-600">Status</span>
                      <select
                        value={shownTicketStatus(selected)}
                        disabled={saving}
                        onChange={(e) => void updateRow(selected.id, { status: e.target.value as SupportTicketStatus })}
                        className={fieldClass("select", "small", "min-w-0 flex-1")}
                      >
                        {(Object.keys(SUPPORT_STATUS_ADMIN_LABELS) as SupportTicketStatus[]).map((st) => (
                          <option key={st} value={st}>
                            {SUPPORT_STATUS_ADMIN_LABELS[st]}
                          </option>
                        ))}
                      </select>
                    </label>
                    {selected.created_by ? (
                      <SupportChatPagePicker key={selected.id} reportId={selected.id} value={selected.context_path ?? null} />
                    ) : null}
                    {(() => {
                      const contact = supportCallContact ?? ticketSupportCallContact(selected);
                      return (
                        <SupportTicketBookCall
                          key={`${selected.id}:${pamAssigneeId ?? ""}`}
                          ticketId={selected.id}
                          defaultHost={defaultSupportHost(selected.assigned_to, pamAssigneeId)}
                          guestLabel={
                            [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim() ||
                            ticketAuthorLabel(selected)
                          }
                          guestEmail={contact.email?.trim() || null}
                          onOpenSettings={() => selectTopTab("settings")}
                          onBooked={() => {
                            setThreadRefreshKey((n) => n + 1);
                            void loadAttention();
                          }}
                        />
                      );
                    })()}
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void deleteRow(selected)}
                      className="inline-flex items-center gap-1.5 pt-1 text-xs font-medium text-rose-700 hover:underline disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      Delete thread
                    </button>
                  </section>
                ) : null}
                <section className="space-y-3 p-5">
                  <h3 className="text-kicker font-semibold uppercase tracking-wide text-slate-400">
                    {selectedChannel.label}
                  </h3>
                  {selectedChannel.joinedAt ? (
                    <p className="text-sm text-slate-700">
                      Joined {formatJoinDay(selectedChannel.joinedAt)}{" "}
                      {new Date(selectedChannel.joinedAt).getFullYear()}
                    </p>
                  ) : null}
                  {selectedChannel.profileId ? (
                    <>
                      <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-sky-200 bg-sky-50">
                        <a
                          href={`/admin/coaches/${encodeURIComponent(selectedChannel.profileId)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap border-r border-sky-200 px-2 py-1.5 text-xs font-semibold text-sky-900 hover:bg-sky-100"
                        >
                          <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          Profile
                        </a>
                        <a
                          href={`/admin/blueprint/coach?coach=${encodeURIComponent(selectedChannel.profileId)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap px-2 py-1.5 text-xs font-semibold text-sky-900 hover:bg-sky-100"
                        >
                          <ClipboardList className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          Blueprint
                        </a>
                      </div>
                      <SupportTicketCoachPayments coachId={selectedChannel.profileId} />
                    </>
                  ) : null}
                </section>
              </aside>
            ) : null}

            {/* Right: ticket details */}
            {v2 ? (
              <aside className="hidden min-h-0 min-w-0 flex-col border-l border-slate-200 bg-white xl:flex">
                {selected && !showPeopleList ? v2Details(selected) : null}
              </aside>
            ) : (
            <aside
              className={`hidden min-h-0 min-w-0 flex-col overflow-hidden border-t border-slate-200 bg-slate-50 xl:border-l xl:border-t-0 ${
                groupMode === "channels" ? "" : "xl:flex"
              }`}
            >
              {ticketDetails ?? (
                <div className="flex flex-1 items-center justify-center px-6 py-10 text-center text-sm text-slate-400">
                  Ticket details appear here
                </div>
              )}
            </aside>
            )}
          </div>
        </div>
      </div>
        </>
      )}
    </DashboardPageSection>
  );
}

/** Channels: one name per coach, always visible, like Slack's channel list. */
function ChannelList({
  groups,
  sort,
  loading,
  selectedKey,
  onSelect,
}: {
  groups: ChannelGroup[];
  sort: ChannelSort;
  loading: boolean;
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  if (loading && groups.length === 0) {
    return <p className="px-4 py-8 text-sm text-slate-500">Loading channels…</p>;
  }
  if (groups.length === 0) {
    return <p className="px-4 py-8 text-sm text-slate-500">No coaches match.</p>;
  }
  const thisYear = new Date().getFullYear();
  return (
    <ul className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-2 py-1.5">
      {groups.map((group, index) => {
        const active = group.key === selectedKey;
        const waiting = group.needsReply > 0;
        // Newest: a small year line where earlier years start; this year has none.
        const year = sort === "joined" && group.joinedAt ? new Date(group.joinedAt).getFullYear() : null;
        const prevJoined = index > 0 ? groups[index - 1].joinedAt : null;
        const prevYear = prevJoined ? new Date(prevJoined).getFullYear() : thisYear;
        return (
          <Fragment key={group.key}>
          {year && year !== thisYear && year !== prevYear ? (
            <li className="flex items-center gap-2 px-2.5 pb-1 pt-3" aria-hidden>
              <span className="text-caption font-semibold tabular-nums text-slate-400">{year}</span>
              <span className="h-px flex-1 bg-slate-200" />
            </li>
          ) : null}
          <li>
            <button
              type="button"
              onClick={() => onSelect(group.key)}
              aria-current={active ? "true" : undefined}
              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm ${
                active
                  ? "bg-sky-700 text-white"
                  : waiting
                    ? "font-semibold text-slate-900 hover:bg-slate-400/40"
                    : "text-slate-700 hover:bg-slate-400/40"
              }`}
            >
              <span className="truncate">{group.label}</span>
              {waiting ? (
                <span
                  className={`inline-flex min-w-[1.15rem] shrink-0 ${sort === "joined" ? "" : "ml-auto"} items-center justify-center rounded-full px-1 text-caption font-semibold ${
                    active ? "bg-white text-sky-800" : "bg-sky-600 text-white"
                  }`}
                  title="Messages waiting on us"
                >
                  {group.needsReply}
                </span>
              ) : null}
              {sort === "joined" && group.joinedAt ? (
                <span
                  className={`ml-auto shrink-0 pl-2 text-caption tabular-nums ${
                    active ? "text-white/70" : "text-slate-400"
                  }`}
                >
                  {formatJoinDay(group.joinedAt)}
                </span>
              ) : null}
            </button>
          </li>
          </Fragment>
        );
      })}
    </ul>
  );
}

/** "28 Oct": the year shows as a line above instead. */
function formatJoinDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // en-GB says "Sept"; keep every month to three letters.
  return `${d.getDate()} ${d.toLocaleString("en-GB", { month: "short" }).slice(0, 3)}`;
}









/**
 * One coach's channel, like their old Slack channel: Help & support, then the
 * chat on each Blueprint page (job 26, the same list the coach sees in My
 * Blueprint → Messages), then one-off messages in date order. Each is one
 * clean line with reply faces and a count; clicking one opens it in its place.
 */
function ChannelFeed({
  channel,
  className = "",
  onPhoneBack,
  blueprintByThread,
  pageChats,
  onSelectPageChat,
  progress,
  attentionByTicket,
  refreshKey,
  onSelect,
  onSelectEmptyThread,
}: {
  channel: ChannelGroup | null;
  className?: string;
  onPhoneBack: () => void;
  blueprintByThread: Record<string, SupportReply[]>;
  pageChats: ReturnType<typeof useBlueprintPageChats>;
  onSelectPageChat: (slug: string) => void;
  progress: LaunchProgress;
  attentionByTicket: SupportAttentionMap;
  refreshKey: number;
  onSelect: (id: string) => void;
  onSelectEmptyThread: (key: string) => void;
}) {
  const tickets = channel?.tickets ?? [];
  const activity = useChannelActivity(
    tickets.map((t) => t.id).sort(),
    `${refreshKey}:${tickets.map((t) => t.lastActivityAt).join("|")}`
  );

  if (!channel) {
    return (
      <section className={`flex min-h-0 min-w-0 flex-col items-center justify-center gap-2 px-6 text-center ${className}`}>
        <Users className="h-8 w-8 text-slate-400" aria-hidden />
        <p className="text-sm font-medium text-slate-900">Choose a coach</p>
      </section>
    );
  }

  const pinnedByKey = new Map<string, AdminTicketRow>();
  for (const t of tickets) if (launchThread(t.topic)) pinnedByKey.set(t.topic!, t);
  // Only Help & support is pinned now; any older job thread shows with the one-offs.
  const oneOffs = tickets
    .filter((t) => !launchThread(t.topic) || launchThread(t.topic)!.phase !== null)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));

  const pinnedRow = (thread: LaunchThread) => {
    const row = pinnedByKey.get(thread.key);
    const needsReply = Boolean(row && row.status !== "resolved" && ticketNeedsStaffReply(row));
    const unread = row ? supportAttentionBadgeCount(attentionByTicket[row.id]) : 0;
    return (
      <li key={thread.key}>
        <button
          type="button"
          onClick={() => (row ? onSelect(row.id) : onSelectEmptyThread(thread.key))}
          className={`${threadRowClass("center")} ${progress[thread.key]?.done ? "bg-slate-50" : ""}`}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center text-slate-400">
            {thread.phase === null ? (
              <ClipboardList className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <JobCircle job={progress[thread.key]} />
            )}
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className={`truncate text-sm font-semibold ${
                progress[thread.key]?.done ? "text-slate-500" : "text-slate-900"
              }`}
            >
              {thread.label}
            </span>
            <ThreadFlags unread={unread} needsReply={needsReply} />
            <ThreadActivityInline
              activity={withBlueprintActivity(row ? activity[row.id] : undefined, blueprintByThread[thread.key])}
              started={Boolean(row)}
            />
          </span>
        </button>
      </li>
    );
  };

  const pageRow = (page: BlueprintLink) => {
    const chat = pageChats[page.slug];
    return (
      <li key={page.slug}>
        <button type="button" onClick={() => onSelectPageChat(page.slug)} className={threadRowClass("center")}>
          <span className="flex h-5 w-5 shrink-0 items-center justify-center text-slate-400">
            <PageIcon slug={page.slug} className="h-4 w-4" />
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate text-sm font-semibold text-slate-900">{page.title}</span>
            <ThreadFlags unread={chat?.unread ?? 0} needsReply={false} />
            <ThreadActivityInline activity={chat} started />
          </span>
        </button>
      </li>
    );
  };

  return (
    <section
      className={`flex min-h-0 min-w-0 flex-col overflow-hidden bg-white max-lg:min-h-[min(60dvh,32rem)] ${className}`}
      aria-label={`${channel.label}'s channel`}
    >
      <header className="flex h-12 shrink-0 items-center gap-2.5 border-b border-slate-200 bg-white px-4">
        <button
          type="button"
          onClick={onPhoneBack}
          className="-ml-2 rounded-md p-1 text-slate-500 hover:bg-slate-100 lg:hidden"
          aria-label="All coaches"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <p className="min-w-0 flex-1 truncate text-base font-semibold text-slate-900">
          {channel.label}
        </p>
        {channel.profileId ? (
          <a
            href={`/admin/coaches/${encodeURIComponent(channel.profileId)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:underline"
          >
            <UserRound className="h-3 w-3" aria-hidden />
            Profile
          </a>
        ) : null}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white">
        <div className="w-full max-w-3xl space-y-6 px-3 py-6 sm:px-6">
          {channel.profileId ? (
            <>
              <ChannelCard>{LAUNCH_THREADS.filter((t) => t.phase === null).map(pinnedRow)}</ChannelCard>
              {BLUEPRINT_GROUPS.map((group) => {
                const pages = group.pages.filter((page) => page.slug !== "blueprint");
                if (!pages.length) return null;
                return (
                  <section key={group.label}>
                    <ChannelGroupLabel label={group.label} />
                    <ChannelCard>{pages.map(pageRow)}</ChannelCard>
                  </section>
                );
              })}
            </>
          ) : null}
          <section>
          <ChannelGroupLabel label="Messages" />
          <ChannelCard>
          {oneOffs.length === 0 ? (
            <li className="px-4 py-3 text-sm text-slate-400">No other messages yet.</li>
          ) : (
            oneOffs.map((row) => {
              const needsReply = row.status !== "resolved" && ticketNeedsStaffReply(row);
              const unread = supportAttentionBadgeCount(attentionByTicket[row.id]);
              const title = row.title?.trim() || previewText(row.details, 120);
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(row.id)}
                    className={`${threadRowClass("center")} ${row.status === "resolved" ? "bg-slate-50" : ""}`}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                      <MessageStatusCircle status={row.status} audience="admin" />
                    </span>
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <span
                        className={`truncate text-sm font-semibold ${
                          row.status === "resolved" ? "text-slate-500" : "text-slate-900"
                        }`}
                      >
                        {title}
                      </span>
                      <ThreadFlags unread={unread} needsReply={needsReply} />
                      <ThreadActivityInline activity={activity[row.id]} started />
                    </span>
                  </button>
                </li>
              );
            })
          )}
          </ChannelCard>
          </section>
        </div>
      </div>
    </section>
  );
}

function ThreadFlags({ unread, needsReply }: { unread: number; needsReply: boolean }) {
  if (!unread && !needsReply) return null;
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {needsReply ? <span className={badgeClass("amber")}>Needs reply</span> : null}
      {unread > 0 ? (
        <span className="inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-sky-600 px-1 text-caption font-semibold text-white">
          {unread}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Top of an open thread in Channels, like Linear: back to the coach's channel,
 * then the thread's name. Admin controls sit on the right.
 */
function ChannelThreadHeader({
  channelLabel,
  thread,
  title,
  onBack,
  children,
}: {
  channelLabel: string;
  thread: LaunchThread | null;
  title: string;
  onBack: () => void;
  children?: ReactNode;
}) {
  const phase = thread?.phase ? LAUNCH_PHASES.find((p) => p.key === thread.phase)?.label : null;
  return (
    <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-slate-200 px-3 py-1.5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-w-0 shrink items-center gap-1 rounded-md px-1.5 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      >
        <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
        <span className="truncate">{channelLabel}</span>
      </button>
      <span className="select-none text-slate-300" aria-hidden>
        /
      </span>
      <span className="min-w-0 truncate text-sm font-semibold text-slate-900">
        {thread?.label ?? title}
      </span>
      {phase ? (
        <span className="hidden shrink-0 text-xs text-slate-400 sm:inline">{phase}</span>
      ) : null}
      <span className="ml-auto flex shrink-0 items-center gap-2 xl:hidden">{children}</span>
    </header>
  );
}

