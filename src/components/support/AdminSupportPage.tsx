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
import { useRouter } from "next/navigation";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DashboardPageSection, StickyPageHeader } from "@/components/layout";
import { notifySupportCountsChanged } from "@/components/layout/useNewFeedbackCount";
import { AdminTicketReplies } from "@/components/support/AdminTicketReplies";
import { SupportCreateTicketComposer } from "@/components/support/SupportCreateTicketComposer";
import { SupportMailboxConnect } from "@/components/support/SupportMailboxConnect";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import {
  DEFAULT_SUPPORT_ASSIGNEE_ID,
  assigneeDisplayName,
  isSupportAssignable,
  smartListLabel,
  type SupportAssignee,
  type SupportSmartList,
} from "@/lib/support/assignees";
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

const SMART_LISTS: SupportSmartList[] = [
  "zander",
  "pam",
  "all_open",
  "from_lessons",
  "ideas",
];

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

export function AdminSupportPage() {
  const router = useRouter();
  const { setImpersonatingCoachId } = useImpersonation();
  const [rows, setRows] = useState<AdminTicketRow[]>([]);
  const [assignees, setAssignees] = useState<SupportAssignee[]>([]);
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [pamAssigneeId, setPamAssigneeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [smartList, setSmartList] = useState<SupportSmartList>("zander");
  const [groupMode, setGroupMode] = useState<GroupMode>("tickets");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPersonKey, setSelectedPersonKey] = useState<string | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const loadGenerationRef = useRef(0);

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

  const loadTickets = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await supabaseClient
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
        author:profiles!created_by ( id, full_name, first_name, last_name, avatar_url, role ),
        assignee:profiles!assigned_to ( id, full_name, first_name, last_name, avatar_url, role )
      `
      )
      .order("created_at", { ascending: false });
    if (generation !== loadGenerationRef.current) return;

    if (queryError) {
      if (isSupabaseAbortError(queryError)) return;
      setRows([]);
      setError(queryError.message);
      setLoading(false);
      return;
    }

    const mapped = ((data ?? []) as Array<
      Omit<AdminTicketRow, "type" | "author" | "assignee"> & {
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
    setRows(mapped);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadMeta();
    void loadTickets();
    return () => {
      loadGenerationRef.current += 1;
    };
  }, [loadMeta, loadTickets]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((row) => {
      switch (smartList) {
        case "zander":
          if (
            row.assigned_to !== DEFAULT_SUPPORT_ASSIGNEE_ID ||
            row.status === "resolved"
          ) {
            return false;
          }
          break;
        case "pam":
          if (
            pamAssigneeId == null ||
            row.assigned_to !== pamAssigneeId ||
            row.status === "resolved"
          ) {
            return false;
          }
          break;
        case "all_open":
          if (row.status === "resolved") return false;
          break;
        case "from_lessons":
          if (row.source !== "lesson_private") return false;
          break;
        case "ideas":
          if (row.type !== "idea") return false;
          break;
        default:
          break;
      }

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
  }, [rows, smartList, pamAssigneeId, searchQuery]);

  const personGroups = useMemo((): PersonGroup[] => {
    const map = new Map<string, PersonGroup>();
    for (const row of filteredRows) {
      const key = ticketPersonKey(row);
      const existing = map.get(key);
      if (existing) {
        existing.tickets.push(row);
        if (row.status !== "resolved") existing.openCount += 1;
        if (row.created_at > existing.latestAt) {
          existing.latestAt = row.created_at;
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
          latestAt: row.created_at,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.latestAt < b.latestAt ? 1 : -1
    );
  }, [filteredRows]);

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
  }, [smartList, groupMode, searchQuery]);

  async function updateRow(
    id: string,
    patch: Partial<
      Pick<
        AdminTicketRow,
        "status" | "importance" | "ease" | "assigned_to" | "type"
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
      contentMaxWidthClass="max-w-none"
      gapClass="gap-0"
      outerClassName="flex h-full min-h-0 flex-1 flex-col"
      contentClassName="min-h-0 flex-1 overflow-hidden"
      header={
        <StickyPageHeader
          className="shrink-0"
          title="Support"
          description="Ticket inbox for coach questions, bugs, ideas, and private lesson asks."
          actions={
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
          }
        />
      }
    >
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

                <div className="flex gap-1 overflow-x-auto pb-0.5">
                  {SMART_LISTS.map((list) => (
                    <button
                      key={list}
                      type="button"
                      onClick={() => setSmartList(list)}
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        smartList === list
                          ? "bg-sky-700 text-white"
                          : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {smartListLabel(list)}
                    </button>
                  ))}
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
                      No people in {smartListLabel(smartList).toLowerCase()}.
                    </li>
                  ) : (
                    personGroups.map((group, index) => {
                      const ageBand = inboxAgeBand(group.latestAt);
                      const prevBand =
                        index > 0
                          ? inboxAgeBand(personGroups[index - 1].latestAt)
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
                      No tickets in {smartListLabel(smartList).toLowerCase()}.
                    </li>
                  ) : (
                    listTickets.map((row, index) => {
                      const active = selectedId === row.id;
                      const isNew = row.status === "open";
                      const ageBand = inboxAgeBand(row.created_at);
                      const prevBand =
                        index > 0
                          ? inboxAgeBand(listTickets[index - 1].created_at)
                          : null;
                      const showBandHeader = ageBand !== prevBand;
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
                                </span>
                                <span className="mt-0.5 block truncate text-xs text-slate-500">
                                  {ticketAuthorLabel(row)} ·{" "}
                                  {previewText(row.details, 56) ||
                                    SUPPORT_TYPE_LABELS[row.type]}
                                </span>
                              </span>
                              <span className="flex shrink-0 flex-col items-end gap-1">
                                <span className="text-[11px] tabular-nums text-slate-400">
                                  {formatSupportRelativeCompact(row.created_at)}
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
    </DashboardPageSection>
  );
}
