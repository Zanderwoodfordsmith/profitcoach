import { NextResponse } from "next/server";
import { selectContactsWithOptionalPhone } from "@/lib/contactsSchemaSafeSelect";
import { enrichProspectRows } from "@/lib/loadProspectTableRows";
import { buildProspectNotifications } from "@/lib/prospectNotifications";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function requireCoach(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return {
      error: "Missing access token." as const,
      role: null as string | null,
      coachId: null as string | null,
      prospectsHref: null as string | null,
    };
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return {
      error: "Invalid access token." as const,
      role: null,
      coachId: null,
      prospectsHref: null,
    };
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role ?? null;
  if (role !== "coach") {
    return {
      error: "Not authorized." as const,
      role,
      coachId: null,
      prospectsHref: null,
    };
  }

  return {
    error: null,
    role,
    coachId: user.id,
    prospectsHref: "/coach/prospects",
  };
}

export async function GET(request: Request) {
  const auth = await requireCoach(request);
  if (auth.error) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.error === "Not authorized." ? 403 : 401 }
    );
  }

  const baseColumns =
    "id, full_name, email, business_name, job_title, prospect_status, type, created_at";
  const optionalColumns = ["phone", "crm_contact_id", "prospect_funnel"];

  try {
    const { data: contacts, error: contactsError } =
      await selectContactsWithOptionalPhone<{
        id: string;
        coach_id?: string | null;
        full_name: string;
        email: string | null;
        business_name: string | null;
        job_title: string | null;
        prospect_status: string | null;
        phone: string | null;
        crm_contact_id: string | null;
        prospect_funnel: string | null;
        type: string;
        created_at: string;
      }>(
        async (columns) => {
          let query = supabaseAdmin
            .from("contacts")
            .select(columns)
            .eq("type", "prospect")
            .order("created_at", { ascending: false })
            .limit(120);

          return query.eq("coach_id", auth.coachId!);
        },
        baseColumns,
        optionalColumns
      );

    if (contactsError) {
      console.error("notifications/prospects contacts:", contactsError);
      return NextResponse.json(
        { error: "Unable to load prospect notifications." },
        { status: 500 }
      );
    }

    const coachIds = Array.from(
      new Set(
        (contacts ?? [])
          .map((contact) => contact.coach_id)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      )
    );

    let coachById: Record<
      string,
      {
        full_name: string | null;
        coach_business_name: string | null;
        crm_location_id: string | null;
      }
    > = {};

    if (coachIds.length > 0) {
      const [{ data: profiles }, { data: coachRows }] = await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("id, full_name, coach_business_name")
          .in("id", coachIds),
        supabaseAdmin
          .from("coaches")
          .select("id, crm_location_id")
          .in("id", coachIds),
      ]);

      const crmByCoachId = new Map(
        (coachRows ?? []).map((row) => [
          (row as { id: string }).id,
          ((row as { crm_location_id?: string | null }).crm_location_id as
            | string
            | null) ?? null,
        ])
      );

      for (const profile of profiles ?? []) {
        const id = (profile as { id: string }).id;
        coachById[id] = {
          full_name:
            ((profile as { full_name?: string | null }).full_name as
              | string
              | null) ?? null,
          coach_business_name:
            ((profile as { coach_business_name?: string | null })
              .coach_business_name as string | null) ?? null,
          crm_location_id: crmByCoachId.get(id) ?? null,
        };
      }
    }

    const enriched = await enrichProspectRows(
      supabaseAdmin,
      (contacts ?? []).map((contact) => {
        const coachId = contact.coach_id ?? null;
        const coach = coachId ? coachById[coachId] : null;
        return {
          id: contact.id,
          full_name: contact.full_name,
          job_title: contact.job_title ?? null,
          prospect_status: contact.prospect_status ?? null,
          email: contact.email,
          business_name: contact.business_name,
          phone: contact.phone ?? null,
          type: contact.type,
          coach_id: coachId,
          coach_name: coach?.full_name ?? null,
          coach_business_name: coach?.coach_business_name ?? null,
          crm_contact_id: contact.crm_contact_id ?? null,
          crm_location_id: coach?.crm_location_id ?? null,
          created_at: contact.created_at ?? null,
          prospect_funnel: contact.prospect_funnel ?? null,
        };
      })
    );

    const notifications = buildProspectNotifications(
      enriched,
      auth.prospectsHref ?? "/coach/prospects"
    );

    return NextResponse.json({ notifications });
  } catch (err) {
    console.error("notifications/prospects:", err);
    return NextResponse.json(
      { error: "Unable to load prospect notifications." },
      { status: 500 }
    );
  }
}
