export type SupportTicketStatus = "new" | "in_review" | "resolved";
export type SupportTicketType = "bug" | "feature" | "general";

export type SupportTicketAuthor = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
};

export type SupportTicket = {
  id: string;
  created_at: string;
  created_by: string;
  ticket_number: number;
  type: SupportTicketType;
  title: string | null;
  details: string;
  page_path: string | null;
  status: SupportTicketStatus;
};

export type SupportReply = {
  id: string;
  created_at: string;
  report_id: string;
  created_by: string;
  body: string;
  author: SupportTicketAuthor | null;
};

export const SUPPORT_TYPE_LABELS: Record<SupportTicketType, string> = {
  bug: "Bug Report",
  feature: "Feature Request",
  general: "General",
};

export const SUPPORT_STATUS_USER_LABELS: Record<SupportTicketStatus, string> = {
  new: "Open",
  in_review: "In review",
  resolved: "Resolved",
};

export function formatSupportTicketId(ticketNumber: number): string {
  return `SUP-${String(ticketNumber).padStart(4, "0")}`;
}

export function authorDisplayName(author: SupportTicketAuthor | null | undefined): string {
  if (!author) return "Unknown";
  return (
    author.full_name?.trim() ||
    [author.first_name, author.last_name].filter(Boolean).join(" ").trim() ||
    "Unknown"
  );
}

export function isSupportStaffAuthor(author: SupportTicketAuthor | null | undefined): boolean {
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
