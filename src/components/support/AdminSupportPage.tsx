"use client";

import {
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  Plus,
  Search,
  Trash2,
  Users,
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
import type { SupportCallContactPrefill } from "@/lib/support/supportCallPrefill";
import { SupportCallAdminSettings } from "@/components/support/SupportCallAdminSettings";
import {
  CoachSearchCombobox,
  SupportCreateTicketComposer,
} from "@/components/support/SupportCreateTicketComposer";
import { SupportMailboxConnect } from "@/components/support/SupportMailboxConnect";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import {
  DEFAULT_SUPPORT_ASSIGNEE_ID,
  assigneeDisplayName,
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
import { supportNotifyDefaultOn } from "@/lib/support/notifyCoachOfReply";
import {
  SUPPORT_SOURCE_LABELS,
  SUPPORT_STATUS_ADMIN_LABELS,
  SUPPORT_TYPE_LABELS,
  supportTypeOptionLabel,
  authorDisplayName,
  formatSupportRelativeCompact,
  formatSupportTicketId,
  normalizeSupportTicketType,
  supportTicketScore,
  type SupportTicketAuthor,
  type SupportTicketSource,
  type SupportTicketStatus,
  type SupportTicketType,
} from "@/lib/support/tickets";
import { supabaseClient } from "@/lib/supabaseClient";
import { isSupabaseAbortError } from "@/lib/supabaseErrorMessage";
type AdminTicketRow = {
  id: string;
  created_at: string;
  created_by: string | null;
  ticket_number: number;
  type: SupportTicketType;
  title: string | null;
  details: string;
  page_path: string | null;
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
  author: SupportAssignee | null;
  assignee: SupportAssignee | null;
  /**
   * When the member last wrote without a later staff reply.
   * Used to age-band Open tickets (not ticket created_at).
   */
  lastUnrepliedMemberAt: string;
  /** Latest ticket or reply activity. */
  lastActivityAt: string;
};

type CoachOption = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

type GroupMode = "tickets" | "people";

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

const TYPE_STYLES: Record<SupportTicketType, string> = {
  question: "bg-violet-100 text-violet-800 ring-violet-200/80",
  bug: "bg-rose-100 text-rose-800 ring-rose-200/80",
  idea: "bg-sky-100 text-sky-800 ring-sky-200/80",
  billing: "bg-amber-100 text-amber-900 ring-amber-200/80",
  other: "bg-slate-100 text-slate-700 ring-slate-200/80",
};

const STATUS_DOT: Record<SupportTicketStatus, string> = {
  open: "bg-sky-500",
  waiting_reply: "bg-amber-500",
  resolved: "bg-emerald-500",
};

const ASSIGNEE_FILTERS: { id: SupportAssigneeFilter; label: string }[] = [
  { id: "zander", label: "Zander" },
  { id: "pam", label: "Pam" },
  { id: "anyone", label: "Anyone" },
];

const STATUS_FILTER_OPTIONS: {
  id: SupportStatusFilter;
  label: string;
}[] = [
  { id: "open", label: "Open" },
  { id: "resolved", label: "Resolved" },
  { id: "all", label: "All statuses" },
];

const TYPE_FILTER_OPTIONS: { id: "all" | SupportTicketType; label: string }[] =
  [
    { id: "all", label: "All categories" },
    { id: "question", label: SUPPORT_TYPE_LABELS.question },
    { id: "bug", label: SUPPORT_TYPE_LABELS.bug },
    { id: "idea", label: SUPPORT_TYPE_LABELS.idea },
    { id: "billing", label: SUPPORT_TYPE_LABELS.billing },
    { id: "other", label: SUPPORT_TYPE_LABELS.other },
  ];

const filterSelectClass =
  "w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20";

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

function ticketAuthorLabel(row: AdminTicketRow): string {
  if (row.author) return authorDisplayName(row.author);
  if (row.submitter_name?.trim()) return row.submitter_name.trim();
  if (row.contact_email?.trim()) return row.contact_email.trim();
  return "Unknown";
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
    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-700">
      {initialsFromLabel(label)}
    </span>
  );
}

function previewText(value: string, max = 72): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1)}…`;
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

const WAITING_ON_REPLY_BAND = "Waiting on reply";

/**
 * Open filter sections:
 * - Needs our reply → Today / Yesterday / … by last unreplied member message
 * - We've replied (or marked waiting) → "Waiting on reply" at the bottom
 */
function ticketNeedsStaffReply(row: Pick<AdminTicketRow, "status" | "lastUnrepliedMemberAt" | "lastActivityAt">): boolean {
  if (row.status === "waiting_reply") return false;
  if (row.status === "resolved") return false;
  // Member still has the last word (or no replies yet — times equal ticket open).
  return row.lastActivityAt === row.lastUnrepliedMemberAt;
}

function inboxListBand(
  row: Pick<
    AdminTicketRow,
    "status" | "created_at" | "lastUnrepliedMemberAt" | "lastActivityAt"
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

type ReplyActivityRow = {
  report_id: string;
  created_at: string;
  author: Pick<SupportTicketAuthor, "role"> | Pick<SupportTicketAuthor, "role">[] | null;
};

function normalizeReplyAuthorRole(
  author: ReplyActivityRow["author"]
): string | null {
  if (!author) return null;
  const row = Array.isArray(author) ? author[0] : author;
  return row?.role ?? null;
}

/** Newest-first replies → last unreplied member message + last activity. */
function ticketActivityFromReplies(
  ticketCreatedAt: string,
  repliesNewestFirst: { created_at: string; staff: boolean }[]
): { lastUnrepliedMemberAt: string; lastActivityAt: string } {
  const lastActivityAt = repliesNewestFirst[0]?.created_at ?? ticketCreatedAt;

  if (repliesNewestFirst.length === 0) {
    return { lastUnrepliedMemberAt: ticketCreatedAt, lastActivityAt };
  }

  const latest = repliesNewestFirst[0];
  if (!latest.staff) {
    return { lastUnrepliedMemberAt: latest.created_at, lastActivityAt };
  }

  const lastMember = repliesNewestFirst.find((r) => !r.staff);
  return {
    lastUnrepliedMemberAt: lastMember?.created_at ?? ticketCreatedAt,
    lastActivityAt,
  };
}

async function loadTicketReplyActivity(
  reportIds: string[]
): Promise<Map<string, { created_at: string; staff: boolean }[]>> {
  const byTicket = new Map<
    string,
    { created_at: string; staff: boolean }[]
  >();
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
        author:profiles!created_by ( role )
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
      list.push({
        created_at: raw.created_at,
        staff: normalizeReplyAuthorRole(raw.author) === "admin",
      });
      byTicket.set(raw.report_id, list);
    }
  }

  return byTicket;
}

export function AdminSupportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setImpersonatingCoachId } = useImpersonation();
  const topTab =
    searchParams.get("tab") === "settings" ? "settings" : "inbox";
  const [appOrigin, setAppOrigin] = useState("https://theprofitcoach.com");
  const [rows, setRows] = useState<AdminTicketRow[]>([]);
  const [assignees, setAssignees] = useState<SupportAssignee[]>([]);
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [pamAssigneeId, setPamAssigneeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assigneeFilter, setAssigneeFilter] =
    useState<SupportAssigneeFilter>("zander");
  const [statusFilter, setStatusFilter] =
    useState<SupportStatusFilter>("open");
  const [typeFilter, setTypeFilter] = useState<"all" | SupportTicketType>(
    "all"
  );
  const [groupMode, setGroupMode] = useState<GroupMode>("tickets");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPersonKey, setSelectedPersonKey] = useState<string | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [supportCallContact, setSupportCallContact] =
    useState<SupportCallContactPrefill | null>(null);
  const [attentionByTicket, setAttentionByTicket] = useState<SupportAttentionMap>(
    {}
  );
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
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
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

    const { data: coachProfiles } = await supabaseClient
      .from("profiles")
      .select("id, full_name, first_name, last_name")
      .in("role", ["coach", "admin"])
      .order("full_name", { ascending: true })
      .limit(500);
    setCoaches((coachProfiles ?? []) as CoachOption[]);
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
          author:profiles!created_by ( id, full_name, first_name, last_name, avatar_url, role, phone ),
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
        | "assignee"
        | "lastUnrepliedMemberAt"
        | "lastActivityAt"
      > & {
        type: string;
        author: SupportAssignee | SupportAssignee[] | null;
        assignee: SupportAssignee | SupportAssignee[] | null;
      }
    >).map((row) => ({
      ...row,
      type: normalizeSupportTicketType(row.type),
      author: normalizeProfile(row.author),
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
      return {
        ...row,
        lastUnrepliedMemberAt: activity.lastUnrepliedMemberAt,
        lastActivityAt: activity.lastActivityAt,
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
      if (statusFilter === "resolved" && row.status !== "resolved") {
        return false;
      }

      if (typeFilter !== "all" && row.type !== typeFilter) return false;

      if (!q) return true;
      const hay = [
        row.title,
        row.details,
        formatSupportTicketId(row.ticket_number),
        ticketAuthorLabel(row),
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
    typeFilter,
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

  const listTickets = useMemo(() => {
    if (groupMode !== "people" || !selectedPersonKey) return filteredRows;
    return (
      personGroups.find((g) => g.key === selectedPersonKey)?.tickets ?? []
    );
  }, [groupMode, selectedPersonKey, filteredRows, personGroups]);

  const selected = useMemo(
    () => listTickets.find((r) => r.id === selectedId) ?? null,
    [listTickets, selectedId]
  );

  useEffect(() => {
    if (groupMode === "people" && !selectedPersonKey) {
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
  }, [assigneeFilter, statusFilter, typeFilter, groupMode, searchQuery]);

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
        "status" | "importance" | "ease" | "assigned_to" | "type" | "created_by"
      >
    >
  ) {
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

  const showPeopleList = groupMode === "people" && !selectedPersonKey;
  const selectedPerson = selectedPersonKey
    ? personGroups.find((g) => g.key === selectedPersonKey) ?? null
    : null;
  const saving = selected ? savingId === selected.id : false;
  const score = selected ? supportTicketScore(selected) : null;
  const canEmailNotify = Boolean(
    selected && (selected.created_by || selected.contact_email?.trim())
  );
  const emailNotifyDefault = selected
    ? supportNotifyDefaultOn(
        selected.source,
        selected.member_notify_email
      )
    : false;

  function openMemberSupport(coachId: string) {
    setImpersonatingCoachId(coachId);
    router.push("/coach/support");
  }

  return (
    <DashboardPageSection
      contentMaxWidthClass={topTab === "settings" ? "max-w-6xl" : "max-w-none"}
      gapClass={topTab === "settings" ? "gap-6" : "gap-0"}
      outerClassName="flex h-full min-h-0 flex-1 flex-col"
      contentClassName={
        topTab === "settings"
          ? // Inbox shell is overflow-hidden; settings must scroll inside it.
            "!mx-0 mr-auto min-h-0 w-full flex-1 overflow-y-auto overscroll-contain pb-8"
          : "min-h-0 flex-1 overflow-hidden"
      }
      header={
        <StickyPageHeader
          className="shrink-0"
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
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-800"
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
              onCreated={(created) => {
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
                };
                setRows((prev) => [row, ...prev]);
                setSelectedId(row.id);
                setCreateOpen(false);
              }}
            />
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col py-3 max-lg:min-h-[calc(100dvh-8rem)] max-lg:py-2">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="grid h-full min-h-0 min-w-0 grid-cols-1 grid-rows-[minmax(0,1fr)] overflow-hidden lg:grid-cols-[minmax(0,28%)_minmax(0,1fr)] xl:grid-cols-[minmax(0,26%)_minmax(0,1fr)_minmax(0,22%)]">
            {/* Left: queue */}
            <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden border-b border-slate-200 max-lg:max-h-[42vh] lg:border-b-0 lg:border-r">
              <div className="shrink-0 space-y-2 border-b border-slate-100 px-3 py-2.5">
                <div className="inline-flex w-full rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                  <button
                    type="button"
                    onClick={() => setGroupMode("tickets")}
                    className={`flex-1 rounded-md px-2.5 py-1.5 text-xs font-semibold ${
                      groupMode === "tickets"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Tickets
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroupMode("people")}
                    className={`flex-1 rounded-md px-2.5 py-1.5 text-xs font-semibold ${
                      groupMode === "people"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    By coach
                  </button>
                </div>

                <div className="inline-flex w-full rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                  {ASSIGNEE_FILTERS.map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setAssigneeFilter(filter.id)}
                      className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold ${
                        assigneeFilter === filter.id
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-1.5">
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
                  <select
                    value={typeFilter}
                    onChange={(e) =>
                      setTypeFilter(
                        e.target.value as "all" | SupportTicketType
                      )
                    }
                    aria-label="Filter by category"
                    className={filterSelectClass}
                  >
                    {TYPE_FILTER_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search tickets…"
                    className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>
              </div>

              {error ? (
                <p className="shrink-0 border-b border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {error}
                </p>
              ) : null}

              {showPeopleList ? (
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
                      return (
                        <Fragment key={group.key}>
                          {showBandHeader ? (
                            <li className="sticky top-0 z-[1] bg-slate-100 px-3.5 py-1.5">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                {ageBand}
                              </p>
                            </li>
                          ) : null}
                          <li className="px-2 py-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPersonKey(group.key);
                                setSelectedId(group.tickets[0]?.id ?? null);
                              }}
                              className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-slate-50"
                            >
                              <ListAvatar
                                label={group.label}
                                avatarUrl={group.avatarUrl}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-1.5">
                                  <span className="truncate text-sm font-semibold text-slate-900">
                                    {group.label}
                                  </span>
                                  {group.openCount > 0 ? (
                                    <span className="inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-sky-600 px-1 text-[10px] font-semibold text-white">
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
                        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-white hover:text-slate-900"
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
                      const listAt =
                        statusFilter === "open"
                          ? ticketNeedsStaffReply(row)
                            ? row.lastUnrepliedMemberAt || row.created_at
                            : row.lastActivityAt || row.created_at
                          : row.created_at;
                      return (
                        <Fragment key={row.id}>
                          {showBandHeader ? (
                            <li className="sticky top-0 z-[1] bg-slate-100 px-3.5 py-1.5">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                {ageBand}
                              </p>
                            </li>
                          ) : null}
                          <li className="px-2 py-0.5">
                            <button
                              type="button"
                              onClick={() => setSelectedId(row.id)}
                              className={`flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left ${
                                active
                                  ? "bg-sky-50/80 ring-1 ring-sky-200"
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
                                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[row.status]}`}
                                    title={
                                      SUPPORT_STATUS_ADMIN_LABELS[row.status]
                                    }
                                  />
                                  <span
                                    className={`truncate text-sm ${
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
                                      className="shrink-0 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-semibold text-amber-900"
                                      title="You were mentioned"
                                    >
                                      @
                                    </span>
                                  ) : null}
                                  {badgeCount > 0 ? (
                                    <span className="inline-flex min-w-[1.15rem] shrink-0 items-center justify-center rounded-full bg-sky-600 px-1 text-[10px] font-semibold text-white">
                                      {badgeCount}
                                    </span>
                                  ) : null}
                                </span>
                                <span className="mt-0.5 block truncate text-xs text-slate-500">
                                  {ticketAuthorLabel(row)} ·{" "}
                                  {previewText(row.details, 56) ||
                                    SUPPORT_TYPE_LABELS[row.type]}
                                </span>
                              </span>
                              <span className="flex shrink-0 flex-col items-end gap-1">
                                <span className="text-[11px] tabular-nums text-slate-400">
                                  {formatSupportRelativeCompact(listAt)}
                                </span>
                                <span
                                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${TYPE_STYLES[row.type]}`}
                                >
                                  {SUPPORT_TYPE_LABELS[row.type]}
                                </span>
                              </span>
                            </button>
                          </li>
                        </Fragment>
                      );
                    })
                  )}
                </ul>
              )}
            </aside>

            {/* Center: thread + pinned reply composer */}
            <section className="flex min-h-0 min-w-0 flex-col overflow-hidden max-lg:min-h-[min(70dvh,36rem)]">
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
              ) : selected ? (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5 xl:hidden">
                    {selected.created_by ? (
                      <button
                        type="button"
                        onClick={() => openMemberSupport(selected.created_by!)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" aria-hidden />
                        Open member Support
                      </button>
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
                        className="max-w-[7.5rem] rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700"
                        aria-label="Assignee"
                      >
                        <option value="">Unassigned</option>
                        {assigneePickerOptions(assignees, selected.assignee).map(
                          (a) => (
                            <option key={a.id} value={a.id}>
                              {assigneeDisplayName(a)}
                            </option>
                          )
                        )}
                      </select>
                      <select
                        value={selected.status}
                        disabled={saving}
                        onChange={(e) =>
                          void updateRow(selected.id, {
                            status: e.target.value as SupportTicketStatus,
                          })
                        }
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700"
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
                    <AdminTicketReplies
                      reportId={selected.id}
                      reportStatus={selected.status}
                      variant="inbox"
                      canEmailNotify={canEmailNotify}
                      emailNotifyDefault={emailNotifyDefault}
                      emailNotifyLabel={ticketAuthorLabel(selected)}
                      sendAsOptions={assignees}
                      supportCallContact={
                        supportCallContact ?? ticketSupportCallContact(selected)
                      }
                      statusSaving={saving}
                      onStatusChange={(status) =>
                        void updateRow(selected.id, { status })
                      }
                      openingMessage={{
                        authorLabel: ticketAuthorLabel(selected),
                        authorAvatarUrl: selected.author?.avatar_url ?? null,
                        title: selected.title?.trim() || "(No subject)",
                        body: selected.details,
                        createdAt: selected.created_at,
                        typeLabel: supportTypeOptionLabel(selected.type),
                        media: selected.media,
                      }}
                      onStatusTouched={() => {
                        void loadTickets();
                        notifySupportCountsChanged();
                      }}
                      onInternalNoteSaved={() => {
                        void loadAttention();
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 bg-white px-6 text-center">
                  <p className="text-sm font-medium text-slate-900">
                    No ticket selected
                  </p>
                  <p className="max-w-sm text-xs text-slate-600">
                    Pick a ticket from the queue to read and reply.
                  </p>
                </div>
              )}
            </section>

            {/* Right: ticket details */}
            <aside className="hidden min-h-0 min-w-0 flex-col overflow-hidden border-t border-slate-200 bg-white xl:flex xl:border-l xl:border-t-0">
              {selected && !showPeopleList ? (
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
                    <div className="space-y-3">
                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-slate-600">
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
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                        >
                          <option value="">Unassigned</option>
                          {assigneePickerOptions(
                            assignees,
                            selected.assignee
                          ).map((a) => (
                            <option key={a.id} value={a.id}>
                              {assigneeDisplayName(a)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-slate-600">
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
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 [color-scheme:light]"
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
                            <span className="mb-1 block text-xs font-semibold text-slate-600">
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
                              className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
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
                            <span className="mb-1 block text-xs font-semibold text-slate-600">
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
                              className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
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

                    <div className="mt-6 border-t border-slate-100 pt-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Source
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-900">
                        {SUPPORT_SOURCE_LABELS[selected.source]}
                      </p>
                      {selected.contact_email ? (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {selected.contact_email}
                        </p>
                      ) : null}

                      <label className="mt-3 block">
                        <span className="mb-1 block text-xs font-semibold text-slate-600">
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
                        {selected.contact_email && !selected.created_by ? (
                          <p className="mt-1 text-[11px] text-slate-500">
                            Linking also remembers this email for future inbox
                            mail.
                          </p>
                        ) : null}
                      </label>

                      {selected.created_by ? (
                        <button
                          type="button"
                          onClick={() =>
                            openMemberSupport(selected.created_by!)
                          }
                          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-50"
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                          Open member Support
                        </button>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void deleteRow(selected)}
                      className="mt-6 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      Delete ticket
                    </button>
                  </div>

                  <p className="shrink-0 border-t border-slate-100 px-4 py-2 text-[10px] tabular-nums text-slate-400">
                    {formatSupportTicketId(selected.ticket_number)}
                  </p>
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center px-6 py-10 text-center text-sm text-slate-400">
                  Ticket details appear here
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
        </>
      )}
    </DashboardPageSection>
  );
}
