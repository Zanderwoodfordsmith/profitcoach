import { supabaseClient } from "@/lib/supabaseClient";

export type SupportAttentionFlags = {
  /**
   * Unread follow-up replies from someone else. 0 on a brand-new ticket
   * that has never been opened (the original body still counts as unread).
   */
  unreadReplies: number;
  mention: boolean;
};

export type SupportAttentionMap = Record<string, SupportAttentionFlags>;

/** Unread tickets that need a look. Follow-ups show volume; new tickets show 1. */
export function supportAttentionBadgeCount(
  flags: SupportAttentionFlags | undefined
): number {
  if (!flags) return 0;
  return Math.max(flags.unreadReplies, 1);
}

export async function loadAdminSupportAttention(): Promise<{
  map: SupportAttentionMap;
  error: string | null;
}> {
  const { data, error } = await supabaseClient.rpc("admin_support_attention");
  if (error) {
    return { map: {}, error: error.message };
  }

  const map: SupportAttentionMap = {};
  for (const row of data ?? []) {
    const reportId = row.report_id as string;
    map[reportId] = {
      unreadReplies: Number(row.unread_replies ?? 0),
      mention: Boolean(row.mention),
    };
  }
  return { map, error: null };
}

export async function markAdminSupportTicketRead(
  reportId: string
): Promise<void> {
  await supabaseClient.rpc("mark_admin_support_ticket_read", {
    p_report_id: reportId,
  });
}

export async function loadAdminSupportAttentionCount(): Promise<number> {
  const { data, error } = await supabaseClient.rpc(
    "admin_support_attention_count"
  );
  if (error) return 0;
  return typeof data === "number" ? data : Number(data ?? 0);
}
