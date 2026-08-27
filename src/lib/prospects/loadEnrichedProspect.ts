import {
  enrichProspectRows,
} from "@/lib/loadProspectTableRows";
import { selectContactsWithOptionalPhone } from "@/lib/contactsSchemaSafeSelect";
import type { ProspectRow } from "@/lib/prospectRow";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Load one enriched prospect row. When `coachId` is set, scopes to that coach.
 * Admin callers omit `coachId` to load any prospect.
 */
export async function loadEnrichedProspectById(
  contactId: string,
  options?: { coachId?: string }
): Promise<{ prospect: ProspectRow; coachSlug: string | null } | null> {
  const id = contactId.trim();
  if (!id) return null;

  const { data: contacts, error } = await selectContactsWithOptionalPhone<{
    id: string;
    full_name: string;
    email: string | null;
    business_name: string | null;
    job_title: string | null;
    linkedin_url: string | null;
    company_website: string | null;
    prospect_status: string | null;
    phone: string | null;
    crm_contact_id: string | null;
    type: string;
    coach_id: string | null;
    created_at: string;
    prospect_funnel: string | null;
    prospect_source: string | null;
  }>(
    async (columns) => {
      let query = supabaseAdmin
        .from("contacts")
        .select(columns)
        .eq("id", id)
        .eq("type", "prospect")
        .limit(1);
      if (options?.coachId) {
        query = query.eq("coach_id", options.coachId);
      }
      return query;
    },
    "id, full_name, email, business_name, job_title, prospect_status, type, coach_id, created_at",
    ["crm_contact_id", "prospect_funnel", "linkedin_url", "company_website", "prospect_source"]
  );

  if (error || !contacts?.length) {
    if (error) console.error("loadEnrichedProspectById:", error);
    return null;
  }

  const contact = contacts[0];
  const coachId = contact.coach_id;
  if (!coachId) return null;

  const { data: coachRow } = await supabaseAdmin
    .from("coaches")
    .select("crm_location_id, slug")
    .eq("id", coachId)
    .maybeSingle();

  const crmLocationId =
    ((coachRow as { crm_location_id?: string | null } | null)?.crm_location_id as
      | string
      | null) ?? null;
  const coachSlug =
    ((coachRow as { slug?: string | null } | null)?.slug as string | null)?.trim() ||
    null;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name")
    .eq("id", coachId)
    .maybeSingle();

  const enriched = await enrichProspectRows(supabaseAdmin, [
    {
      id: contact.id,
      full_name: contact.full_name,
      job_title: contact.job_title ?? null,
      prospect_status: contact.prospect_status ?? null,
      email: contact.email ?? null,
      business_name: contact.business_name ?? null,
      linkedin_url: contact.linkedin_url ?? null,
      company_website: contact.company_website ?? null,
      phone: contact.phone ?? null,
      type: contact.type ?? "prospect",
      coach_id: coachId,
      coach_name:
        ((profile as { full_name?: string | null } | null)?.full_name as
          | string
          | null) ?? null,
      crm_contact_id: contact.crm_contact_id ?? null,
      crm_location_id: crmLocationId,
      created_at: contact.created_at ?? null,
      prospect_funnel: contact.prospect_funnel ?? null,
      prospect_source: contact.prospect_source ?? null,
    },
  ]);

  const prospect = enriched[0];
  if (!prospect) return null;
  return { prospect, coachSlug };
}

export function prospectWorkspacePath(
  contactId: string,
  options?: { admin?: boolean }
): string {
  const base = options?.admin
    ? `/admin/prospects/${encodeURIComponent(contactId)}`
    : `/coach/prospects/${encodeURIComponent(contactId)}`;
  return base;
}
