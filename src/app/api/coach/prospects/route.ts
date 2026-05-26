import { NextResponse } from "next/server";
import { selectContactsWithOptionalPhone } from "@/lib/contactsSchemaSafeSelect";
import { enrichProspectRows } from "@/lib/loadProspectTableRows";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function requireCoach(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return { error: "Missing access token." as const, userId: null };
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return { error: "Invalid access token." as const, userId: null };
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const impersonateId = request.headers.get("x-impersonate-coach-id")?.trim();
  const effectiveId =
    profile?.role === "admin" && impersonateId ? impersonateId : user.id;

  if (!profile || (profile.role !== "coach" && profile.role !== "admin")) {
    return { error: "Not authorized." as const, userId: null };
  }

  if (profile.role === "admin" && !impersonateId) {
    return { error: "Select a coach profile first." as const, userId: null };
  }

  return { error: null, userId: effectiveId as string };
}

export async function GET(request: Request) {
  const authCheck = await requireCoach(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: authCheck.error === "Select a coach profile first." ? 400 : 401 }
    );
  }

  const coachId = authCheck.userId;

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
        async (columns) =>
          supabaseAdmin
            .from("contacts")
            .select(columns)
            .eq("coach_id", coachId)
            .eq("type", "prospect")
            .order("created_at", { ascending: false }),
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

  const prospects = await enrichProspectRows(
    supabaseAdmin,
    contacts.map((c) => ({
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
    }))
  );

  const coachSlug =
    ((coachRow as { slug?: string | null } | null)?.slug as string | null)?.trim() ??
    null;

  return NextResponse.json({ prospects, coachSlug });
}
