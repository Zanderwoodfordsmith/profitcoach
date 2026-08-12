import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { MirrorConversation } from "@/lib/linkedinMessaging/fetchInbox";

export type InboxSnapshot = {
  conversations: MirrorConversation[];
  scrapedAt: string;
  source: string;
  warning: string | null;
};

export async function getInboxSnapshot(
  userId: string
): Promise<InboxSnapshot | null> {
  const { data, error } = await supabaseAdmin
    .from("linkedin_inbox_snapshots")
    .select("conversations, scraped_at, source, warning")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    conversations: Array.isArray(data.conversations)
      ? (data.conversations as MirrorConversation[])
      : [],
    scrapedAt: data.scraped_at,
    source: data.source || "extension",
    warning: data.warning ?? null,
  };
}

export async function upsertInboxSnapshot(opts: {
  userId: string;
  conversations: MirrorConversation[];
  scrapedAt?: string;
  source?: string;
  warning?: string | null;
}): Promise<InboxSnapshot> {
  const scrapedAt = opts.scrapedAt || new Date().toISOString();
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("linkedin_inbox_snapshots")
    .upsert(
      {
        user_id: opts.userId,
        conversations: opts.conversations,
        scraped_at: scrapedAt,
        source: opts.source || "extension",
        warning: opts.warning ?? null,
        updated_at: now,
      },
      { onConflict: "user_id" }
    )
    .select("conversations, scraped_at, source, warning")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not save inbox snapshot.");
  }

  return {
    conversations: Array.isArray(data.conversations)
      ? (data.conversations as MirrorConversation[])
      : [],
    scrapedAt: data.scraped_at,
    source: data.source || "extension",
    warning: data.warning ?? null,
  };
}
