import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { selectContactsWithOptionalPhone } from "@/lib/contactsSchemaSafeSelect";
import {
  enrichProspectRows,
  toLiteProspectRows,
} from "@/lib/loadProspectTableRows";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Body = {
  coachId?: string | null;
  fullName: string;
  email?: string;
  businessName?: string;
  sendInvite?: boolean;
  type?: "prospect" | "client";
};

export async function GET(request: Request) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error) {
    return NextResponse.json(
      { error: authCheck.error },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const typeFilter = searchParams.get("type");
  const enrichIds = searchParams
    .get("enrichIds")
    ?.split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  try {
    const { data: contacts, error: contactsError } =
      await selectContactsWithOptionalPhone<{
        id: string;
        coach_id: string | null;
        full_name: string;
        email: string | null;
        business_name: string | null;
        job_title: string | null;
        prospect_status: string | null;
        phone: string | null;
        crm_contact_id: string | null;
        type: string;
        created_at: string;
      }>(async (columns) => {
        let query = supabaseAdmin
          .from("contacts")
          .select(columns)
          .order("created_at", { ascending: false });

        if (typeFilter === "client") {
          query = query.eq("type", "client");
        } else if (typeFilter === "prospect") {
          query = query.eq("type", "prospect");
        }

        if (enrichIds && enrichIds.length > 0) {
          query = query.in("id", enrichIds);
        }

        return query;
      }, "id, coach_id, full_name, email, business_name, job_title, prospect_status, type, created_at", [
        "crm_contact_id",
      ]);

    if (contactsError) {
      console.error("admin/contacts GET contacts:", contactsError);
      return NextResponse.json(
        { error: "Unable to load contacts." },
        { status: 500 }
      );
    }

    const coachIds = Array.from(
      new Set(contacts.map((c) => c.coach_id).filter(Boolean)) as Set<string>
    );
    const coachById: Record<
      string,
      {
        full_name: string | null;
        coach_business_name: string | null;
        crm_location_id: string | null;
      }
    > = {};

    if (coachIds.length > 0) {
      const [{ data: profiles, error: profilesError }, { data: coachRows }] =
        await Promise.all([
          supabaseAdmin
            .from("profiles")
            .select("id, full_name, coach_business_name")
            .in("id", coachIds),
          supabaseAdmin
            .from("coaches")
            .select("id, crm_location_id")
            .in("id", coachIds),
        ]);
      if (!profilesError && profiles) {
        for (const row of profiles as Array<{
          id: string;
          full_name: string | null;
          coach_business_name: string | null;
        }>) {
          coachById[row.id] = {
            full_name: row.full_name ?? null,
            coach_business_name: row.coach_business_name ?? null,
            crm_location_id: null,
          };
        }
      }
      for (const row of coachRows ?? []) {
        const id = (row as { id: string }).id;
        const crmLocationId =
          ((row as { crm_location_id?: string | null }).crm_location_id as
            | string
            | null) ?? null;
        coachById[id] = {
          full_name: coachById[id]?.full_name ?? null,
          coach_business_name: coachById[id]?.coach_business_name ?? null,
          crm_location_id: crmLocationId,
        };
      }
    }

    const contactRecords = contacts.map((c) => {
      const coachEntry = c.coach_id ? coachById[c.coach_id] : undefined;
      const coachMeta = coachEntry ?? {
        full_name: null,
        coach_business_name: null,
        crm_location_id: null,
      };
      return {
        id: c.id,
        coach_id: c.coach_id,
        full_name: c.full_name,
        job_title: c.job_title ?? null,
        prospect_status: c.prospect_status ?? null,
        email: c.email ?? null,
        business_name: c.business_name ?? null,
        phone: c.phone ?? null,
        type: c.type,
        coach_name: coachMeta.full_name,
        coach_business_name: coachMeta.coach_business_name,
        crm_contact_id: c.crm_contact_id ?? null,
        crm_location_id: coachMeta.crm_location_id ?? null,
        created_at: c.created_at ?? null,
      };
    });

    const useLite =
      typeFilter === "prospect" && !(enrichIds && enrichIds.length > 0);
    const prospects = useLite
      ? toLiteProspectRows(contactRecords)
      : await enrichProspectRows(supabaseAdmin, contactRecords);

    return NextResponse.json({
      prospects,
      enriched: !useLite,
    });
  } catch (err) {
    console.error("admin/contacts GET error:", err);
    return NextResponse.json(
      { error: "Unable to load contacts." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error) {
    return NextResponse.json(
      { error: authCheck.error },
      { status: 401 }
    );
  }

  const body = (await request.json()) as Body;

  const coachIdRaw = body.coachId?.trim() || null;
  const fullName = body.fullName?.trim();
  const email = body.email?.trim() || null;
  const businessName = body.businessName?.trim() || null;
  const sendInvite = !!body.sendInvite;
  const contactType = body.type === "client" ? "client" : "prospect";

  if (!fullName) {
    return NextResponse.json(
      { error: "Please provide name." },
      { status: 400 }
    );
  }

  if (contactType === "prospect" && !coachIdRaw) {
    return NextResponse.json(
      { error: "Please provide coach for prospect." },
      { status: 400 }
    );
  }

  try {
    let resolvedCoachId: string | null = null;
    let coachSlug: string | null = null;

    if (coachIdRaw && coachIdRaw.toLowerCase() !== "none") {
      if (coachIdRaw.toUpperCase() === "BCA") {
        const { data: bcaRow } = await supabaseAdmin
          .from("coaches")
          .select("id, slug")
          .eq("slug", "BCA")
          .maybeSingle();
        if (bcaRow) {
          resolvedCoachId = bcaRow.id as string;
          coachSlug = (bcaRow.slug as string) ?? "BCA";
        }
      } else {
        const { data: coachRow, error: coachError } = await supabaseAdmin
          .from("coaches")
          .select("id, slug")
          .eq("id", coachIdRaw)
          .maybeSingle();

        if (coachError || !coachRow) {
          throw new Error("Coach not found.");
        }

        resolvedCoachId = coachRow.id as string;
        coachSlug = (coachRow.slug as string) ?? null;
      }
    }

    const insertPayload: Record<string, unknown> = {
      full_name: fullName,
      email,
      business_name: businessName,
      type: contactType,
    };
    if (resolvedCoachId) {
      insertPayload.coach_id = resolvedCoachId;
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("contacts")
      .insert(insertPayload)
      .select("id")
      .maybeSingle();

    if (insertError || !inserted) {
      throw new Error(
        contactType === "client" ? "Unable to create client." : "Unable to create prospect."
      );
    }

    return NextResponse.json(
      {
        ok: true,
        contactId: inserted.id as string,
        coachSlug: coachSlug ?? null,
        sendInvite,
        type: contactType,
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error." },
      { status: 400 }
    );
  }
}

