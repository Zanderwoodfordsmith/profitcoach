import { normalizePoolEmail } from "@/lib/pool/identity";
import { parseProspectTags } from "@/lib/prospects/tags";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeLinkedInProfileUrl } from "@/lib/unipile/linkedinUrl";

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
  prospect_email?: string | null;
  prospect_linkedin_url?: string | null;
  prospect_tags?: string[];
  in_campaign?: boolean;
  campaign_ids?: string[];
  in_pool?: boolean;
  contact_type?: string | null;
};

const IN_CHUNK = 150;

function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += IN_CHUNK) {
    out.push(items.slice(i, i + IN_CHUNK));
  }
  return out;
}

type PoolMatches = {
  contactIds: Set<string>;
  emails: Set<string>;
  linkedinUrls: Set<string>;
};

async function loadPoolMatches(
  coachId: string,
  input: { contactIds: string[]; emails: string[]; linkedinUrls: string[] }
): Promise<PoolMatches> {
  const matches: PoolMatches = {
    contactIds: new Set(),
    emails: new Set(),
    linkedinUrls: new Set(),
  };
  const { data: pool } = await supabaseAdmin
    .from("coach_lead_lists")
    .select("id")
    .eq("coach_id", coachId)
    .eq("kind", "pool")
    .maybeSingle();
  const poolId = (pool?.id as string | undefined) ?? null;
  if (!poolId) return matches;

  const lookups: Array<{
    column: "contact_id" | "email" | "linkedin_url";
    values: string[];
    into: Set<string>;
    normalize: (value: string) => string | null;
  }> = [
    {
      column: "contact_id",
      values: input.contactIds,
      into: matches.contactIds,
      normalize: (v) => v,
    },
    {
      column: "email",
      values: input.emails,
      into: matches.emails,
      normalize: normalizePoolEmail,
    },
    {
      column: "linkedin_url",
      values: input.linkedinUrls,
      into: matches.linkedinUrls,
      normalize: normalizeLinkedInProfileUrl,
    },
  ];

  await Promise.all(
    lookups.flatMap((lookup) =>
      chunks(lookup.values).map(async (chunk) => {
        const { data, error } = await supabaseAdmin
          .from("coach_lead_list_items")
          .select(lookup.column)
          .eq("list_id", poolId)
          .in(lookup.column, chunk);
        if (error) {
          console.error(
            `enrichConversationFilters pool (${lookup.column}):`,
            error
          );
          return;
        }
        for (const row of (data ?? []) as Array<Record<string, unknown>>) {
          const value = row[lookup.column];
          const key =
            typeof value === "string" ? lookup.normalize(value) : null;
          if (key) lookup.into.add(key);
        }
      })
    )
  );
  return matches;
}

/**
 * Attach prospect tags, contact type, campaign and Pool membership for inbox filters.
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
  const emails = [
    ...new Set(
      rows
        .map((row) => normalizePoolEmail(row.prospect_email))
        .filter((email): email is string => Boolean(email))
    ),
  ];
  const linkedinUrls = [
    ...new Set(
      rows
        .map((row) => normalizeLinkedInProfileUrl(row.prospect_linkedin_url ?? ""))
        .filter((url): url is string => Boolean(url))
    ),
  ];

  const tagsByContact = new Map<string, string[]>();
  const typeByContact = new Map<string, string>();
  const loadContacts = async () => {
    if (!contactIds.length) return;
    let q = supabaseAdmin
      .from("contacts")
      .select("id, type, prospect_tags")
      .in("id", contactIds);
    if (coachId) q = q.eq("coach_id", coachId);
    const { data, error } = await q;
    if (error) {
      if (error.code !== "42703" && error.code !== "PGRST204") {
        console.error("enrichConversationFilters tags:", error);
      }
      return;
    }
    for (const row of data ?? []) {
      tagsByContact.set(row.id as string, parseProspectTags(row.prospect_tags));
      if (typeof row.type === "string") {
        typeByContact.set(row.id as string, row.type);
      }
    }
  };

  let poolMatches: PoolMatches = {
    contactIds: new Set(),
    emails: new Set(),
    linkedinUrls: new Set(),
  };
  const loadPool = async () => {
    if (!coachId) return;
    poolMatches = await loadPoolMatches(coachId, {
      contactIds,
      emails,
      linkedinUrls,
    });
  };

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
    loadContacts(),
    loadPool(),
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
    const email = normalizePoolEmail(row.prospect_email);
    const linkedinUrl = normalizeLinkedInProfileUrl(
      row.prospect_linkedin_url ?? ""
    );
    const inPool =
      (contactId ? poolMatches.contactIds.has(contactId) : false) ||
      (email ? poolMatches.emails.has(email) : false) ||
      (linkedinUrl ? poolMatches.linkedinUrls.has(linkedinUrl) : false);
    return {
      ...row,
      prospect_tags: contactId ? tagsByContact.get(contactId) ?? [] : [],
      contact_type: contactId ? typeByContact.get(contactId) ?? null : null,
      in_campaign: campaignIds.length > 0,
      campaign_ids: campaignIds,
      in_pool: inPool,
    };
  });
}
