import { supabaseClient } from "@/lib/supabaseClient";

export type SupportAttentionFlags = {
  /** Unread chat replies from someone else (not the initial ticket body). */
  unreadReplies: number;
  mention: boolean;
};

export type SupportAttentionMap = Record<string, SupportAttentionFlags>;

export function supportAttentionBadgeCount(
  flags: SupportAttentionFlags | undefined
): number {
  if (!flags) return 0;
  return flags.unreadReplies;
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
