import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { addCampaignLeads } from "@/lib/unipile/campaigns";
import { normalizeLinkedInProfileUrl } from "@/lib/unipile/linkedinUrl";
import { normalizePoolEmail, normalizePoolPhone } from "@/lib/pool/identity";
import {
  isLeadListUuid,
  loadOwnedLeadList,
  MAX_LIST_ITEMS_PER_REQUEST,
} from "@/lib/leadLists/audienceLists";

/**
 * Enrol people from one of the coach's lists into one of their campaigns.
 * Shared by the add-to-campaign route and the AI agent.
 */

export class AddListToCampaignError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 500
  ) {
    super(message);
  }
}

type ListItemRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  company: string | null;
  linkedin_url: string | null;
  email: string | null;
  phone: string | null;
  raw: unknown;
};

const ITEM_SELECT =
  "id, first_name, last_name, job_title, company, linkedin_url, email, phone, raw";

/** addCampaignLeads takes up to 2,500 rows per call. */
const ENROL_CHUNK = 2_500;
const PAGE_SIZE = 1_000;

async function loadItems(opts: {
  coachId: string;
  listId: string;
  itemIds: string[];
  all: boolean;
}): Promise<ListItemRow[]> {
  if (!opts.all) {
    let query = supabaseAdmin
      .from("coach_lead_list_items")
      .select(ITEM_SELECT)
      .eq("coach_id", opts.coachId)
      .eq("list_id", opts.listId)
      .order("created_at", { ascending: true })
      .limit(MAX_LIST_ITEMS_PER_REQUEST);
    if (opts.itemIds.length) {
      query = query.in("id", opts.itemIds.slice(0, MAX_LIST_ITEMS_PER_REQUEST));
    }
    const { data, error } = await query;
    if (error) throw new AddListToCampaignError(error.message, 500);
    return (data ?? []) as ListItemRow[];
  }

  const rows: ListItemRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from("coach_lead_list_items")
      .select(ITEM_SELECT)
      .eq("coach_id", opts.coachId)
      .eq("list_id", opts.listId)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new AddListToCampaignError(error.message, 500);
    rows.push(...((data ?? []) as ListItemRow[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

function toLead(row: ListItemRow) {
  const url = normalizeLinkedInProfileUrl(String(row.linkedin_url ?? ""));
  const email = normalizePoolEmail(
    typeof row.email === "string" ? row.email : null
  );
  const phone = normalizePoolPhone(
    typeof row.phone === "string" ? row.phone : null
  );
  const raw =
    row.raw && typeof row.raw === "object"
      ? (row.raw as Record<string, unknown>)
      : {};
  const provider =
    typeof raw.linkedin_provider_id === "string"
      ? raw.linkedin_provider_id
      : null;
  return {
    linkedin_url: url ?? undefined,
    email: email ?? undefined,
    phone: phone ?? undefined,
    first_name: row.first_name ?? null,
    last_name: row.last_name ?? null,
    company: row.company ?? null,
    title: row.job_title ?? null,
    linkedin_provider_id: provider,
    raw,
  };
}

export async function addLeadListToCampaign(opts: {
  coachId: string;
  listId: string;
  campaignId: string;
  /** Only these list items. Ignored when `all` is set. */
  itemIds?: string[];
  /** Every person on the list, paged. Otherwise the first 250 (or itemIds). */
  all?: boolean;
}): Promise<{
  added: number;
  skipped: number;
  blacklisted: number;
  /** People on the list who had no LinkedIn profile (or email, for email campaigns). */
  unreachable: number;
  considered: number;
}> {
  if (!isLeadListUuid(opts.listId)) {
    throw new AddListToCampaignError("List not found.", 404);
  }
  const list = await loadOwnedLeadList(opts.coachId, opts.listId);
  if (!list) throw new AddListToCampaignError("List not found.", 404);
  if (list.kind === "blacklist") {
    throw new AddListToCampaignError(
      "Blacklisted people cannot be added to a campaign.",
      400
    );
  }
  if (!isLeadListUuid(opts.campaignId)) {
    throw new AddListToCampaignError("Choose a campaign.", 400);
  }

  const { data: campaign, error: campaignError } = await supabaseAdmin
    .from("linkedin_campaigns")
    .select("id, channel")
    .eq("id", opts.campaignId)
    .eq("coach_id", opts.coachId)
    .maybeSingle();
  if (campaignError) {
    throw new AddListToCampaignError(campaignError.message, 500);
  }
  if (!campaign) throw new AddListToCampaignError("Campaign not found.", 404);
  const isEmail = (campaign.channel as string | undefined) === "email";

  const itemIds = (opts.itemIds ?? []).filter((value) => isLeadListUuid(value));
  const items = await loadItems({
    coachId: opts.coachId,
    listId: opts.listId,
    itemIds,
    all: opts.all === true,
  });

  const leads = items
    .map(toLead)
    .filter((row) =>
      isEmail ? Boolean(row.email) : Boolean(row.linkedin_url || row.linkedin_provider_id)
    );

  if (!leads.length) {
    throw new AddListToCampaignError(
      isEmail
        ? "None of those people have an email address to add."
        : "None of those people have a LinkedIn profile to add.",
      400
    );
  }

  const total = { added: 0, skipped: 0, blacklisted: 0 };
  for (let i = 0; i < leads.length; i += ENROL_CHUNK) {
    const result = await addCampaignLeads(
      opts.coachId,
      opts.campaignId,
      leads.slice(i, i + ENROL_CHUNK)
    );
    total.added += result.added;
    total.skipped += result.skipped;
    total.blacklisted += result.blacklisted;
  }

  return {
    ...total,
    unreachable: items.length - leads.length,
    considered: items.length,
  };
}
