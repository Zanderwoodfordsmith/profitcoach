import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { selectContactsWithOptionalPhone } from "@/lib/contactsSchemaSafeSelect";
import {
  enrichProspectRows,
  toLiteProspectRows,
} from "@/lib/loadProspectTableRows";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const authCheck = await requireCoachRequest(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      {
        status:
          authCheck.error ===
          "Admin must pass x-impersonate-coach-id for this resource."
            ? 400
            : 401,
      }
    );
  }

  const coachId = authCheck.userId;
  const { searchParams } = new URL(request.url);
  const enrichIds = searchParams
    .get("enrichIds")
    ?.split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const [{ data: contacts, error: contactsError }, { data: coachRow }] =
    await Promise.all([
      selectContactsWithOptionalPhone<{
        id: string;
        full_name: string;
        email: string | null;
        business_name: string | null;
        job_title: string | null;
        prospect_status: string | null;
        phone: string | null;
        crm_contact_id: string | null;
        type: string;
        created_at: string;
      }>(
        async (columns) => {
          let query = supabaseAdmin
            .from("contacts")
            .select(columns)
            .eq("coach_id", coachId)
            .eq("type", "prospect")
            .order("created_at", { ascending: false });
          if (enrichIds && enrichIds.length > 0) {
            query = query.in("id", enrichIds);
          }
          return query;
        },
        "id, full_name, email, business_name, job_title, prospect_status, type, created_at",
        ["crm_contact_id"]
      ),
      supabaseAdmin
        .from("coaches")
        .select("crm_location_id, slug")
        .eq("id", coachId)
        .maybeSingle(),
    ]);

  if (contactsError) {
    console.error("coach/prospects GET contacts:", contactsError);
    return NextResponse.json(
      { error: "Unable to load prospects." },
      { status: 500 }
    );
  }

  const crmLocationId =
    ((coachRow as { crm_location_id?: string | null } | null)?.crm_location_id as
      | string
      | null) ?? null;

  const contactRecords = contacts.map((c) => ({
    id: c.id,
    full_name: c.full_name,
    job_title: c.job_title ?? null,
    prospect_status: c.prospect_status ?? null,
    email: c.email ?? null,
    business_name: c.business_name ?? null,
    phone: c.phone ?? null,
    type: c.type ?? "prospect",
    coach_id: coachId,
    crm_contact_id: c.crm_contact_id ?? null,
    crm_location_id: crmLocationId,
    created_at: c.created_at ?? null,
  }));

  const prospects =
    enrichIds && enrichIds.length > 0
      ? await enrichProspectRows(supabaseAdmin, contactRecords)
      : toLiteProspectRows(contactRecords);

  const coachSlug =
    ((coachRow as { slug?: string | null } | null)?.slug as string | null)?.trim() ??
    null;

  return NextResponse.json({
    prospects,
    coachSlug,
    enriched: Boolean(enrichIds && enrichIds.length > 0),
  });
}
