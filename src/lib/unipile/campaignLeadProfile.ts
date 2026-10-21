/**
 * Who someone in a campaign is, for the Prospects tab hover card, and opening
 * them as a prospect when the lead was added without a contact record.
 *
 * Sources, best first: the linked contact, the coach's own pool row, then the
 * shared Sales Nav lead cache. Nothing is fetched from LinkedIn here.
 */

import { resolveOrCreateContact } from "@/lib/contacts/resolveOrCreateContact";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeLinkedInProfileUrl } from "@/lib/unipile/linkedinUrl";

export type CampaignLeadProfile = {
  headline: string | null;
  photoUrl: string | null;
  location: string | null;
  email: string | null;
  teamSize: string | null;
  /** Time in current role, e.g. "9 yrs in role". */
  tenure: string | null;
  /** Their LinkedIn About section, from Sales Nav or the contact. */
  about: string | null;
};

type LeadRow = {
  id: string;
  contact_id: string | null;
  linkedin_url: string | null;
  linkedin_provider_id: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  title: string | null;
};

type PoolRow = {
  id: string;
  job_title: string | null;
  location: string | null;
  team_size: string | null;
  email: string | null;
  phone: string | null;
  contact_id: string | null;
};

type CacheRow = {
  job_title: string | null;
  location: string | null;
  team_size: string | null;
  raw: Record<string, unknown> | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function tenureLabel(sn: Record<string, unknown> | null): string | null {
  const positions = Array.isArray(sn?.current_positions) ? sn.current_positions : [];
  const tenure = asRecord(asRecord(positions[0])?.tenure_at_role);
  const years = typeof tenure?.years === "number" ? tenure.years : 0;
  const months = typeof tenure?.months === "number" ? tenure.months : 0;
  if (years >= 1) return `${years} yr${years === 1 ? "" : "s"} in role`;
  if (months >= 1) return `${months} mo${months === 1 ? "" : "s"} in role`;
  return null;
}

/** The spellings a profile URL is stored under across imports. */
function linkedinUrlVariants(url: string): string[] {
  const variants = new Set<string>();
  const normalized = normalizeLinkedInProfileUrl(url);
  for (const u of [url.trim(), normalized].filter(Boolean) as string[]) {
    const bare = u.replace(/\/+$/, "");
    variants.add(u);
    variants.add(bare);
    variants.add(`${bare}/`);
    variants.add(bare.toLowerCase());
    variants.add(`${bare.toLowerCase()}/`);
  }
  return [...variants];
}

async function loadLead(
  coachId: string,
  campaignId: string,
  leadId: string
): Promise<LeadRow | null> {
  const { data, error } = await supabaseAdmin
    .from("linkedin_campaign_leads")
    .select(
      "id, contact_id, linkedin_url, linkedin_provider_id, first_name, last_name, company, title"
    )
    .eq("id", leadId)
    .eq("campaign_id", campaignId)
    .eq("coach_id", coachId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as LeadRow | null) ?? null;
}

async function loadPoolRow(coachId: string, linkedinUrl: string | null): Promise<PoolRow | null> {
  if (!linkedinUrl) return null;
  const { data, error } = await supabaseAdmin
    .from("coach_lead_list_items")
    .select("id, job_title, location, team_size, email, phone, contact_id")
    .eq("coach_id", coachId)
    .in("linkedin_url", linkedinUrlVariants(linkedinUrl))
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as PoolRow[];
  return rows.find((row) => row.contact_id) ?? rows[0] ?? null;
}

async function loadCacheRow(linkedinUrl: string | null): Promise<CacheRow | null> {
  if (!linkedinUrl) return null;
  const { data, error } = await supabaseAdmin
    .from("leadrocks_leads")
    .select("job_title, location, team_size, raw")
    .in("linkedin_url", linkedinUrlVariants(linkedinUrl))
    .order("last_seen_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return ((data ?? [])[0] as CacheRow | undefined) ?? null;
}

function salesNavFacts(cache: CacheRow | null) {
  const raw = asRecord(cache?.raw);
  const sn = asRecord(raw?.sales_nav);
  return {
    sn,
    headline: asString(sn?.headline) ?? asString(raw?.headline),
    photoUrl:
      asString(sn?.profile_picture_url_large) ??
      asString(sn?.profile_picture_url) ??
      asString(raw?.photo_url),
    location: asString(sn?.location) ?? cache?.location ?? null,
    about: asString(sn?.summary),
    tenure: tenureLabel(sn),
    providerId: asString(sn?.id),
  };
}

export async function loadCampaignLeadProfile(
  coachId: string,
  campaignId: string,
  leadId: string
): Promise<CampaignLeadProfile | null> {
  const lead = await loadLead(coachId, campaignId, leadId);
  if (!lead) return null;

  const [contact, pool, cache] = await Promise.all([
    lead.contact_id
      ? supabaseAdmin
          .from("contacts")
          .select("photo_url, headline, location, email, about")
          .eq("id", lead.contact_id)
          .eq("coach_id", coachId)
          .maybeSingle()
          .then(({ data }) => data as Record<string, string | null> | null)
      : Promise.resolve(null),
    loadPoolRow(coachId, lead.linkedin_url),
    loadCacheRow(lead.linkedin_url),
  ]);

  const sales = salesNavFacts(cache);
  return {
    headline: contact?.headline ?? sales.headline,
    photoUrl: contact?.photo_url ?? sales.photoUrl,
    location: contact?.location ?? pool?.location ?? sales.location,
    email: contact?.email ?? pool?.email ?? null,
    teamSize: pool?.team_size ?? cache?.team_size ?? null,
    tenure: sales.tenure,
    about: contact?.about ?? sales.about,
  };
}

/**
 * The prospect page for a campaign lead. Leads added from the pool often have
 * no contact yet, so this finds or creates one (as opening from the pool does)
 * and links it to the lead.
 */
export async function openCampaignLeadAsProspect(opts: {
  coachId: string;
  campaignId: string;
  leadId: string;
}): Promise<{ contactId: string }> {
  const lead = await loadLead(opts.coachId, opts.campaignId, opts.leadId);
  if (!lead) throw new Error("Lead not found.");
  if (lead.contact_id) return { contactId: lead.contact_id };

  const linkedinUrl = lead.linkedin_url
    ? normalizeLinkedInProfileUrl(lead.linkedin_url)
    : null;
  const [pool, cache] = await Promise.all([
    loadPoolRow(opts.coachId, lead.linkedin_url),
    loadCacheRow(lead.linkedin_url),
  ]);
  const email = pool?.email?.trim() || null;
  const phone = pool?.phone?.trim() || null;
  if (!linkedinUrl && !email && !phone) {
    throw new Error("This person needs a LinkedIn profile before you can open them.");
  }

  const sales = salesNavFacts(cache);
  const fullName =
    [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim() || "Unknown";
  const resolved = await resolveOrCreateContact({
    coachId: opts.coachId,
    fullName,
    firstName: lead.first_name,
    lastName: lead.last_name,
    email,
    phone,
    linkedinUrl,
    linkedinProviderId: lead.linkedin_provider_id ?? sales.providerId,
    jobTitle: lead.title ?? pool?.job_title ?? cache?.job_title ?? null,
    businessName: lead.company,
    photoUrl: sales.photoUrl,
    type: "prospect",
    prospectSource: "sales_nav",
    prospectStatus: "leads",
    extra: {
      headline: sales.headline,
      about: sales.about,
      location: sales.location ?? pool?.location ?? null,
    },
  });

  await Promise.all([
    supabaseAdmin
      .from("linkedin_campaign_leads")
      .update({ contact_id: resolved.contactId })
      .eq("id", lead.id)
      .eq("coach_id", opts.coachId)
      .is("contact_id", null),
    pool && !pool.contact_id
      ? supabaseAdmin
          .from("coach_lead_list_items")
          .update({ contact_id: resolved.contactId })
          .eq("id", pool.id)
          .eq("coach_id", opts.coachId)
      : Promise.resolve(null),
  ]);

  return { contactId: resolved.contactId };
}
