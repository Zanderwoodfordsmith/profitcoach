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
  campaign_ids?: string[];
};

/**
 * Attach prospect tags + campaign membership for inbox filters.
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

  const campaignIdsByContact = new Map<string, Set<string>>();
  const campaignIdsByChat = new Map<string, Set<string>>();

  function addCampaignId(
    map: Map<string, Set<string>>,
    key: string | null,
    campaignId: string | null
  ) {
    if (!key || !campaignId) return;
    const set = map.get(key) ?? new Set<string>();
    set.add(campaignId);
    map.set(key, set);
  }

  async function loadCampaignMatches(
    column: "contact_id" | "unipile_chat_id",
    ids: string[]
  ) {
    if (!ids.length) return;
    let q = supabaseAdmin
      .from("linkedin_campaign_leads")
      .select("contact_id, unipile_chat_id, campaign_id")
      .in(column, ids)
      .in("status", [...ACTIVE_CAMPAIGN_STATUSES]);
    if (coachId) q = q.eq("coach_id", coachId);
    const { data, error } = await q;
    if (error) {
      console.error(`enrichConversationFilters campaign (${column}):`, error);
      return;
    }
    for (const row of data ?? []) {
      const campaignId = (row.campaign_id as string | null)?.trim() || null;
      const contactId = row.contact_id as string | null;
      const chatId = row.unipile_chat_id as string | null;
      addCampaignId(campaignIdsByContact, contactId, campaignId);
      addCampaignId(campaignIdsByChat, chatId, campaignId);
    }
  }

  await Promise.all([
    loadCampaignMatches("contact_id", contactIds),
    loadCampaignMatches("unipile_chat_id", chatIds),
  ]);

  return rows.map((row) => {
    const contactId = row.contact_id?.trim() || null;
    const chatId = row.unipile_chat_id?.trim() || null;
    const ids = new Set<string>();
    if (contactId) {
      for (const id of campaignIdsByContact.get(contactId) ?? []) ids.add(id);
    }
    if (chatId) {
      for (const id of campaignIdsByChat.get(chatId) ?? []) ids.add(id);
    }
    const campaignIds = [...ids];
    return {
      ...row,
      prospect_tags: contactId ? tagsByContact.get(contactId) ?? [] : [],
      in_campaign: campaignIds.length > 0,
      campaign_ids: campaignIds,
    };
  });
}
