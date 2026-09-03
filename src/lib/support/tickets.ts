export type SupportTicketStatus = "new" | "in_review" | "resolved";
export type SupportTicketType = "question" | "bug" | "idea";

export type SupportTicketSource =
  | "direct"
  | "lesson_private"
  | "public_form"
  | "admin_created";

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
  author?: SupportTicketAuthor | null;
  assignee?: SupportTicketAuthor | null;
  media?: unknown;
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
};

export const SUPPORT_AUTHOR_SELECT =
  "id, full_name, first_name, last_name, avatar_url, role";

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
    status: (row.status as SupportTicketStatus) || "new",
    source: row.source ?? "direct",
    assigned_to: row.assigned_to ?? null,
    community_post_id: row.community_post_id ?? null,
    created_by_admin: row.created_by_admin ?? null,
    contact_email: row.contact_email ?? null,
    submitter_name: row.submitter_name ?? null,
    importance: row.importance ?? null,
    ease: row.ease ?? null,
    coach_last_read_at: row.coach_last_read_at ?? null,
    media: row.media,
    author:
      normalizeSupportAuthor(row.author) ?? options?.fallbackAuthor ?? null,
    assignee: normalizeSupportAuthor(row.assignee),
  };
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
  bug: "Bug",
  idea: "Idea",
};

export const SUPPORT_SOURCE_LABELS: Record<SupportTicketSource, string> = {
  direct: "Direct ticket",
  lesson_private: "Private lesson",
  public_form: "Public form",
  admin_created: "Created by team",
};

export const SUPPORT_STATUS_USER_LABELS: Record<SupportTicketStatus, string> = {
  new: "Open",
  in_review: "In review",
  resolved: "Resolved",
};

export const SUPPORT_STATUS_ADMIN_LABELS: Record<SupportTicketStatus, string> = {
  new: "New",
  in_review: "In review",
  resolved: "Resolved",
};

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
  if (raw === "bug" || raw === "idea" || raw === "question") return raw;
  return "question";
}

/** True when the ticket has staff replies the coach has not opened since. */
export function ticketHasUnreadStaffReply(
  ticket: Pick<SupportTicket, "coach_last_read_at">,
  replies: SupportReply[],
  viewerId: string
): boolean {
  const staffReplies = replies.filter((reply) => reply.created_by !== viewerId);
  if (staffReplies.length === 0) return false;
  if (!ticket.coach_last_read_at) return true;
  const lastRead = new Date(ticket.coach_last_read_at).getTime();
  return staffReplies.some(
    (reply) => new Date(reply.created_at).getTime() > lastRead
  );
}
