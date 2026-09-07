import { parseProspectTags } from "@/lib/prospects/tags";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ACTIVE_CAMPAIGN_STATUSES = [
  "queued",
  "invited",
  "connected",
  "in_sequence",
  "replied",
  "paused",
] as const;

export type ConversationFilterRow = {
  id: string;
  contact_id?: string | null;
  unipile_chat_id?: string | null;
  prospect_tags?: string[];
  in_campaign?: boolean;
};

/**
 * Attach prospect tags + "in an active LinkedIn campaign" for inbox filters.
 */
export async function enrichConversationFilters<T extends ConversationFilterRow>(
  rows: T[],
  coachId: string | null
): Promise<T[]> {
  if (!rows.length) return rows;

  const contactIds = [
    ...new Set(
      rows
        .map((row) => row.contact_id?.trim())
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const chatIds = [
    ...new Set(
      rows
        .map((row) => row.unipile_chat_id?.trim())
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const tagsByContact = new Map<string, string[]>();
  if (contactIds.length) {
    let q = supabaseAdmin
      .from("contacts")
      .select("id, prospect_tags")
      .in("id", contactIds);
    if (coachId) q = q.eq("coach_id", coachId);
    const { data, error } = await q;
    if (error) {
      if (error.code !== "42703" && error.code !== "PGRST204") {
        console.error("enrichConversationFilters tags:", error);
      }
    } else {
      for (const row of data ?? []) {
        tagsByContact.set(
          row.id as string,
          parseProspectTags(row.prospect_tags)
        );
      }
    }
  }

  const campaignContactIds = new Set<string>();
  const campaignChatIds = new Set<string>();

  async function loadCampaignMatches(
    column: "contact_id" | "unipile_chat_id",
    ids: string[]
  ) {
    if (!ids.length) return;
    let q = supabaseAdmin
      .from("linkedin_campaign_leads")
      .select("contact_id, unipile_chat_id")
      .in(column, ids)
      .in("status", [...ACTIVE_CAMPAIGN_STATUSES]);
    if (coachId) q = q.eq("coach_id", coachId);
    const { data, error } = await q;
    if (error) {
      console.error(`enrichConversationFilters campaign (${column}):`, error);
      return;
    }
    for (const row of data ?? []) {
      const contactId = row.contact_id as string | null;
      const chatId = row.unipile_chat_id as string | null;
      if (contactId) campaignContactIds.add(contactId);
      if (chatId) campaignChatIds.add(chatId);
    }
  }

  await Promise.all([
    loadCampaignMatches("contact_id", contactIds),
    loadCampaignMatches("unipile_chat_id", chatIds),
  ]);

  return rows.map((row) => {
    const contactId = row.contact_id?.trim() || null;
    const chatId = row.unipile_chat_id?.trim() || null;
    const inCampaign =
      (contactId != null && campaignContactIds.has(contactId)) ||
      (chatId != null && campaignChatIds.has(chatId));
    return {
      ...row,
      prospect_tags: contactId ? tagsByContact.get(contactId) ?? [] : [],
      in_campaign: inCampaign,
    };
  });
}
