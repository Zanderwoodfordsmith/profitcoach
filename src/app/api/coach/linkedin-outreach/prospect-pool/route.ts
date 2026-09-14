import { NextResponse } from "next/server";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";
import {
  fetchAllSupabasePages,
  selectContactsWithOptionalPhone,
} from "@/lib/contactsSchemaSafeSelect";
import { toLiteProspectRows } from "@/lib/loadProspectTableRows";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** Lite prospect list for campaign enrollment — same auth as outreach campaigns. */
export async function GET(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

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
    created_at: string;
    prospect_funnel?: string | null;
    prospect_source?: string | null;
    prospect_tags?: string[] | null;
  }>(
    async (columns) =>
      fetchAllSupabasePages(async (from, to) =>
        supabaseAdmin
          .from("contacts")
          .select(columns)
          .eq("coach_id", auth.coachId)
          .eq("type", "prospect")
          .order("created_at", { ascending: false })
          .range(from, to)
      ),
    "id, full_name, email, business_name, job_title, prospect_status, type, created_at",
    [
      "crm_contact_id",
      "linkedin_url",
      "company_website",
      "prospect_funnel",
      "prospect_source",
      "prospect_tags",
    ]
  );

  if (error) {
    console.error("linkedin-outreach/prospect-pool:", error);
    return NextResponse.json(
      { error: "Unable to load prospects." },
      { status: 500 }
    );
  }

  const prospects = toLiteProspectRows(
    contacts.map((c) => ({
      id: c.id,
      full_name: c.full_name,
      job_title: c.job_title ?? null,
      prospect_status: c.prospect_status ?? null,
      email: c.email ?? null,
      business_name: c.business_name ?? null,
      linkedin_url: c.linkedin_url ?? null,
      company_website: c.company_website ?? null,
      phone: c.phone ?? null,
      type: c.type ?? "prospect",
      coach_id: auth.coachId,
      crm_contact_id: c.crm_contact_id ?? null,
      created_at: c.created_at ?? null,
      prospect_funnel: c.prospect_funnel ?? null,
      prospect_source: c.prospect_source ?? null,
      prospect_tags: c.prospect_tags ?? [],
    }))
  );

  return NextResponse.json({ prospects });
}
