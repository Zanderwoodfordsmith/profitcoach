import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  sliceNewestPage,
  THREAD_MESSAGE_COLUMNS,
  toChronological,
} from "@/lib/messaging/threadWindow";

export async function loadThreadMessagePage(input: {
  conversationId: string;
  limit: number;
  before?: string | null;
}): Promise<{
  messages: Record<string, unknown>[];
  hasOlder: boolean;
  error: Error | null;
}> {
  let q = supabaseAdmin
    .from("messaging_messages")
    .select(THREAD_MESSAGE_COLUMNS)
    .eq("conversation_id", input.conversationId)
    .order("created_at", { ascending: false })
    .limit(input.limit + 1);
  if (input.before) q = q.lt("created_at", input.before);

  const { data, error } = await q;
  if (error) {
    return { messages: [], hasOlder: false, error: new Error(error.message) };
  }
  const page = sliceNewestPage(data ?? [], input.limit);
  return {
    messages: toChronological(page.rows) as Record<string, unknown>[],
    hasOlder: page.hasOlder,
    error: null,
  };
}
