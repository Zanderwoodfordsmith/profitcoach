import type { JobStatus } from "@/lib/launch/jobStatus";

/**
 * A ticket's status, marked the same way as the launch jobs (11 Nov): open is
 * BCA to do, waiting_reply is Needs coach, resolved is Done. The stored names
 * predate the job words, so they stay.
 */
export type SupportTicketStatus = "open" | "in_progress" | "waiting_reply" | "review" | "resolved";
export type SupportTicketType =
  | "question"
  | "bug"
  | "idea"
  | "billing"
  | "other";

export type SupportTicketSource =
  | "direct"
  | "lesson_private"
  | "public_form"
  | "admin_created"
  | "email_inbox";

export type SupportTicketAuthor = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url?: string | null;
  role: string | null;
};

export type SupportTicket = {
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
  created_by_admin: string | null;
  contact_email: string | null;
  submitter_name: string | null;
  importance: number | null;
  ease: number | null;
  coach_last_read_at?: string | null;
  member_notify_email?: boolean;
  author?: SupportTicketAuthor | null;
  assignee?: SupportTicketAuthor | null;
  media?: unknown;
  /** The "Seen" tick on the chat's first message (5 Nov). */
  opening_seen_at?: string | null;
  opening_seen_name?: string | null;
};

export type SupportReply = {
  id: string;
  created_at: string;
  report_id: string;
  created_by: string;
  body: string;
  community_comment_id: string | null;
  author: SupportTicketAuthor | null;
  media?: unknown;
  /** Set when an admin edited the body; null/undefined = never edited. */
  edited_at?: string | null;
  /** Arrived via email, or was included in an email to the member. */
  via_email?: boolean;
  /** Came in or went out on WhatsApp. */
  via_whatsapp?: boolean;
  /** Written somewhere else (a Blueprint section) and shown in this thread. Read-only here. */
  origin?: { label: string; href: string | null };
  /** Ava wrote it and BCA approved it (created_by is the admin who sent it). Shown as Ava. */
  as_ava?: boolean;
  /** The other side ticked it "Seen" (5 Nov): when, and their first name. */
  seen_at?: string | null;
  seen_name?: string | null;
};

/** Who ticked a message, as the select returns it. */
type SeenAuthorRaw = { first_name: string | null; full_name: string | null } | { first_name: string | null; full_name: string | null }[] | null;

function seenName(raw: SeenAuthorRaw | undefined): string | null {
  const one = Array.isArray(raw) ? raw[0] : raw;
  return one?.first_name?.trim() || one?.full_name?.trim().split(" ")[0] || null;
}

export const SUPPORT_AUTHOR_SELECT =
  "id, full_name, first_name, last_name, avatar_url, role";

export const SUPPORT_REPLY_LIST_SELECT = `
  id,
  created_at,
  edited_at,
  report_id,
  created_by,
  body,
  media,
  community_comment_id,
  via_email,
  via_whatsapp,
  as_ava,
  seen_at,
  seen_author:profiles!seen_by (first_name, full_name),
  author:profiles!created_by (${SUPPORT_AUTHOR_SELECT})
`;

/** Add to a chat's select for the first message's "Seen" tick. */
export const SUPPORT_OPENING_SEEN_SELECT = "opening_seen_at, opening_seen_author:profiles!opening_seen_by (first_name, full_name)";

export function mapSupportReplyRow(
  raw: {
    id: string;
    created_at: string;
    edited_at?: string | null;
    report_id: string;
    created_by: string;
    body: string;
    media?: unknown;
    community_comment_id?: string | null;
    via_email?: boolean | null;
    via_whatsapp?: boolean | null;
    as_ava?: boolean | null;
    seen_at?: string | null;
    seen_author?: SeenAuthorRaw;
    author?: SupportTicketAuthor | SupportTicketAuthor[] | null;
  },
  options?: { fallbackAuthor?: SupportTicketAuthor | null }
): SupportReply {
  return {
    id: raw.id,
    created_at: raw.created_at,
    edited_at: raw.edited_at ?? null,
    report_id: raw.report_id,
    created_by: raw.created_by,
    body: raw.body,
    media: raw.media,
    community_comment_id: raw.community_comment_id ?? null,
    via_email: Boolean(raw.via_email),
    via_whatsapp: Boolean(raw.via_whatsapp),
    as_ava: Boolean(raw.as_ava),
    seen_at: raw.seen_at ?? null,
    seen_name: raw.seen_at ? seenName(raw.seen_author) : null,
    author:
      normalizeSupportAuthor(raw.author) ?? options?.fallbackAuthor ?? null,
  };
}

export function normalizeSupportAuthor(
  author: SupportTicketAuthor | SupportTicketAuthor[] | null | undefined
): SupportTicketAuthor | null {
  if (!author) return null;
  return Array.isArray(author) ? (author[0] ?? null) : author;
}

/** Partial row from Supabase selects / inserts (author join may be an array). */
export type SupportTicketRow = {
  id: string;
  created_at: string;
  created_by: string | null;
  ticket_number: number;
  type: string;
  title: string | null;
  details: string;
  page_path?: string | null;
  status: string;
  media?: unknown;
  coach_last_read_at?: string | null;
  member_notify_email?: boolean | null;
  source?: SupportTicketSource | null;
  assigned_to?: string | null;
  community_post_id?: string | null;
  created_by_admin?: string | null;
  contact_email?: string | null;
  submitter_name?: string | null;
  importance?: number | null;
  ease?: number | null;
  author?: SupportTicketAuthor | SupportTicketAuthor[] | null;
  assignee?: SupportTicketAuthor | SupportTicketAuthor[] | null;
  opening_seen_at?: string | null;
  opening_seen_author?: SeenAuthorRaw;
};

export function mapSupportTicketRow(
  row: SupportTicketRow,
  options?: { fallbackAuthor?: SupportTicketAuthor | null }
): SupportTicket {
  return {
    id: row.id,
    created_at: row.created_at,
    created_by: row.created_by,
    ticket_number: row.ticket_number,
    type: normalizeSupportTicketType(row.type),
    title: row.title,
    details: row.details,
    page_path: row.page_path ?? null,
    status: normalizeSupportTicketStatus(row.status),
    source: row.source ?? "direct",
    assigned_to: row.assigned_to ?? null,
    community_post_id: row.community_post_id ?? null,
    created_by_admin: row.created_by_admin ?? null,
    contact_email: row.contact_email ?? null,
    submitter_name: row.submitter_name ?? null,
    importance: row.importance ?? null,
    ease: row.ease ?? null,
    coach_last_read_at: row.coach_last_read_at ?? null,
    member_notify_email: row.member_notify_email !== false,
    media: row.media,
    author:
      normalizeSupportAuthor(row.author) ?? options?.fallbackAuthor ?? null,
    assignee: normalizeSupportAuthor(row.assignee),
    opening_seen_at: row.opening_seen_at ?? null,
    opening_seen_name: row.opening_seen_at ? seenName(row.opening_seen_author) : null,
  };
}

/** BCA started the chat (New ticket in admin Support), so its first message is BCA's. */
export function supportChatOpenedByBca(ticket: { source: SupportTicketSource; created_by_admin?: string | null }): boolean {
  return ticket.source === "admin_created" || Boolean(ticket.created_by_admin);
}

/**
 * Whose turn it is in a chat (5 Nov): whoever didn't write the last message,
 * until they reply or tick it "Seen". Null once it's done or ticked.
 * Statuses are only Open or Done now; an old "Waiting on member" counts as Open.
 */
export function supportChatWaitingOn(
  ticket: Pick<SupportTicket, "status" | "source" | "created_by_admin" | "opening_seen_at">,
  replies: Pick<SupportReply, "author" | "as_ava" | "seen_at">[]
): "coach" | "bca" | null {
  if (ticket.status === "resolved") return null;
  const last = replies[replies.length - 1];
  if (last) {
    if (last.seen_at) return null;
    return last.as_ava || isSupportStaffAuthor(last.author) ? "coach" : "bca";
  }
  if (ticket.opening_seen_at) return null;
  return supportChatOpenedByBca(ticket) ? "coach" : "bca";
}

export function supportAuthorAsProfile(
  author: SupportTicketAuthor | null | undefined
) {
  if (!author) return null;
  return {
    id: author.id,
    full_name: author.full_name,
    first_name: author.first_name,
    last_name: author.last_name,
    avatar_url: author.avatar_url ?? null,
    role: author.role,
  };
}

export const SUPPORT_TYPE_LABELS: Record<SupportTicketType, string> = {
  question: "Question",
  bug: "Bug report",
  idea: "Feature request",
  billing: "Billing",
  other: "Other",
};

export const SUPPORT_TYPE_EMOJIS: Record<SupportTicketType, string> = {
  question: "❓",
  bug: "⚠️",
  idea: "💡",
  billing: "💳",
  other: "💬",
};

export function supportTypeOptionLabel(type: SupportTicketType): string {
  return `${SUPPORT_TYPE_EMOJIS[type]} ${SUPPORT_TYPE_LABELS[type]}`;
}

export const SUPPORT_SOURCE_LABELS: Record<SupportTicketSource, string> = {
  direct: "Direct ticket",
  lesson_private: "Private lesson",
  public_form: "Public form",
  admin_created: "Created by team",
  email_inbox: "Support email",
};

export const SUPPORT_STATUS_USER_LABELS: Record<SupportTicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting_reply: "Your reply needed",
  review: "Ready to check",
  resolved: "Resolved",
};

/** Each ticket status as the job status it reads as: same words, colour and circle. */
export const SUPPORT_STATUS_JOB: Record<SupportTicketStatus, JobStatus> = {
  waiting_reply: "needs_you",
  open: "bca_todo",
  in_progress: "in_progress",
  review: "review",
  resolved: "done",
};

/** Menu order matches the jobs: Needs coach, BCA to do, In progress, Review, Done. */
export const SUPPORT_STATUS_ADMIN_LABELS: Record<SupportTicketStatus, string> = {
  waiting_reply: "Needs coach",
  open: "BCA to do",
  in_progress: "In progress",
  review: "Review",
  resolved: "Done",
};

/** Map legacy + current DB values onto the five statuses. */
export function normalizeSupportTicketStatus(
  status: string | null | undefined
): SupportTicketStatus {
  switch (status) {
    case "open":
    case "in_progress":
    case "waiting_reply":
    case "review":
    case "resolved":
      return status;
    case "new":
    case "submitted":
    case "in_review":
      return "open";
    default:
      return "open";
  }
}

export function isSupportTicketOpen(status: SupportTicketStatus): boolean {
  return status !== "resolved";
}

/**
 * The status follows the conversation (12 Nov). The database moves it on every
 * reply (support_ticket_status_on_reply); these mirror it for the screen.
 * After BCA replies: Needs coach.
 */
export function supportStatusAfterStaffReply(
  status: SupportTicketStatus
): SupportTicketStatus | null {
  return status === "waiting_reply" ? null : "waiting_reply";
}

/**
 * After the coach replies to something waiting on them, or done: In progress
 * if BCA has replied before, else BCA to do. BCA to do and In progress stay.
 */
export function supportStatusAfterMemberReply(
  status: SupportTicketStatus,
  bcaHasReplied: boolean
): SupportTicketStatus | null {
  if (status === "waiting_reply" || status === "review" || status === "resolved") {
    return bcaHasReplied ? "in_progress" : "open";
  }
  return null;
}

export function formatSupportTicketId(ticketNumber: number): string {
  return `SUP-${String(ticketNumber).padStart(4, "0")}`;
}

export type SupportPersonName = Pick<
  SupportTicketAuthor,
  "full_name" | "first_name" | "last_name"
>;

export function authorDisplayName(
  author: SupportPersonName | null | undefined
): string {
  if (!author) return "Unknown";
  return (
    author.full_name?.trim() ||
    [author.first_name, author.last_name].filter(Boolean).join(" ").trim() ||
    "Unknown"
  );
}

export function isSupportStaffAuthor(
  author: SupportTicketAuthor | null | undefined
): boolean {
  return author?.role === "admin";
}

/** Long relative time for support UI, e.g. "24 minutes ago". */
export function formatSupportRelativeAgo(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";

  const diff = Math.max(0, now - t);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < hour) {
    const m = Math.max(1, Math.floor(diff / minute));
    return `${m} ${m === 1 ? "minute" : "minutes"} ago`;
  }
  if (diff < day) {
    const h = Math.max(1, Math.floor(diff / hour));
    return `${h} ${h === 1 ? "hour" : "hours"} ago`;
  }
  if (diff < 30 * day) {
    const d = Math.max(1, Math.floor(diff / day));
    return `${d} ${d === 1 ? "day" : "days"} ago`;
  }

  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Compact queue age: `56m`, `3h`, `10d` (no “ago”). */
export function formatSupportRelativeCompact(
  iso: string,
  now = Date.now()
): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";

  const diff = Math.max(0, now - t);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "now";
  if (diff < hour) return `${Math.floor(diff / minute)}m`;
  if (diff < day) return `${Math.floor(diff / hour)}h`;
  if (diff < 30 * day) return `${Math.floor(diff / day)}d`;

  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function formatSupportTicketDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function supportTicketScore(ticket: Pick<SupportTicket, "importance" | "ease">): number | null {
  if (ticket.importance == null || ticket.ease == null) return null;
  return ticket.importance + ticket.ease;
}

/** Map legacy DB values when reading old rows before migration applied. */
export function normalizeSupportTicketType(raw: string): SupportTicketType {
  if (raw === "feature") return "idea";
  if (raw === "general") return "question";
  if (
    raw === "bug" ||
    raw === "idea" ||
    raw === "question" ||
    raw === "billing" ||
    raw === "other"
  ) {
    return raw;
  }
  return "question";
}

/** True when the ticket has staff replies the coach has not opened since. */
export function ticketHasUnreadStaffReply(
  ticket: Pick<SupportTicket, "coach_last_read_at">,
  replies: Pick<SupportReply, "created_by" | "created_at">[],
  viewerId: string
): boolean {
  return unreadStaffReplyCount(ticket, replies, viewerId) > 0;
}

/** Count of staff replies newer than the coach's last read. Resolved tickets still count. */
export function unreadStaffReplyCount(
  ticket: Pick<SupportTicket, "coach_last_read_at">,
  replies: Pick<SupportReply, "created_by" | "created_at">[],
  viewerId: string
): number {
  const staffReplies = replies.filter((reply) => reply.created_by !== viewerId);
  if (staffReplies.length === 0) return 0;
  if (!ticket.coach_last_read_at) return staffReplies.length;
  const lastRead = new Date(ticket.coach_last_read_at).getTime();
  return staffReplies.filter(
    (reply) => new Date(reply.created_at).getTime() > lastRead
  ).length;
}

/** Latest message the list row should preview: last reply, else the opening note. */
export function supportTicketListPreview(
  ticket: Pick<SupportTicket, "details">,
  replies: Pick<SupportReply, "body">[]
): string {
  for (let i = replies.length - 1; i >= 0; i -= 1) {
    const body = replies[i]?.body?.trim();
    if (body) return collapseSupportPreview(body);
  }
  return collapseSupportPreview(ticket.details);
}

function collapseSupportPreview(text: string): string {
  return text
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function supportTicketActivityAt(
  ticket: Pick<SupportTicket, "created_at">,
  replies: Pick<SupportReply, "created_at">[]
): string {
  const last = replies[replies.length - 1]?.created_at;
  if (!last) return ticket.created_at;
  return last > ticket.created_at ? last : ticket.created_at;
}

export type MemberSupportStatusTone = "open" | "waiting" | "resolved";

/** Member-facing status. Unread replies use a count, not a different status. */
export function memberSupportStatusPresentation(
  status: SupportTicketStatus
): { label: string; tone: MemberSupportStatusTone } {
  if (status === "resolved") {
    return { label: SUPPORT_STATUS_USER_LABELS.resolved, tone: "resolved" };
  }
  if (status === "waiting_reply" || status === "review") {
    return { label: SUPPORT_STATUS_USER_LABELS[status], tone: "waiting" };
  }
  return { label: SUPPORT_STATUS_USER_LABELS.open, tone: "open" };
}

/** Nav hint for unread staff replies. A count, never "Daniel has 5 replies to read". */
export function supportUnreadNavLabel(input: {
  replyCount: number;
}): string | null {
  const count = input.replyCount;
  if (!Number.isFinite(count) || count <= 0) return null;
  const replies = count === 1 ? "reply" : "replies";
  return `${count} ${replies} to read`;
}

export type CoachSupportListSection =
  | "new"
  | "your_reply"
  | "submitted"
  | "replied"
  | "resolved";

export const COACH_SUPPORT_LIST_SECTIONS: {
  id: CoachSupportListSection;
  label: string;
}[] = [
  { id: "new", label: "New replies" },
  { id: "your_reply", label: "Your reply needed" },
  { id: "submitted", label: "Submitted" },
  { id: "replied", label: "Replied" },
  { id: "resolved", label: "Resolved" },
];

/**
 * One home per ticket. Unread staff replies win, even on a resolved ticket,
 * so a new reply is never buried under Resolved.
 */
export function coachSupportListSection(
  ticket: Pick<SupportTicket, "status" | "coach_last_read_at">,
  replies: Pick<SupportReply, "created_by" | "created_at">[],
  viewerId: string
): CoachSupportListSection {
  if (ticketHasUnreadStaffReply(ticket, replies, viewerId)) return "new";
  if (ticket.status === "waiting_reply" || ticket.status === "review") return "your_reply";
  if (ticket.status === "resolved") return "resolved";
  const last = replies[replies.length - 1];
  const staffHasReplied = replies.some((reply) => reply.created_by !== viewerId);
  if (!staffHasReplied || last?.created_by === viewerId) return "submitted";
  return "replied";
}
