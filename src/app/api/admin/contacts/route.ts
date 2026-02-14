import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Body = {
  coachId?: string | null;
  fullName: string;
  email?: string;
  businessName?: string;
  sendInvite?: boolean;
  type?: "prospect" | "client";
};

async function requireAdmin(request: Request) {
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

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== "admin") {
    return { error: "Not authorized." as const, userId: null };
  }

  return { error: null, userId: user.id as string };
}

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

  try {
    let query = supabaseAdmin
      .from("contacts")
      .select("id, coach_id, full_name, email, business_name, type, created_at")
      .order("created_at", { ascending: false });

    if (typeFilter === "client") {
      query = query.eq("type", "client");
    } else if (typeFilter === "prospect") {
      query = query.eq("type", "prospect");
    }

    const { data: contactsData, error: contactsError } = await query;

    if (contactsError) {
      return NextResponse.json(
        { error: "Unable to load contacts." },
        { status: 500 }
      );
    }

    const contacts = (contactsData ?? []) as Array<{
      id: string;
      coach_id: string | null;
      full_name: string;
      email: string | null;
      business_name: string | null;
      type: string;
      created_at: string;
    }>;

    const coachIds = Array.from(
      new Set(contacts.map((c) => c.coach_id).filter(Boolean)) as Set<string>
    );
    let coachById: Record<string, { full_name: string | null; coach_business_name: string | null }> = {};

    if (coachIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, coach_business_name")
        .in("id", coachIds);
      if (!profilesError && profiles) {
        for (const row of profiles as Array<{ id: string; full_name: string | null; coach_business_name: string | null }>) {
          coachById[row.id] = {
            full_name: row.full_name ?? null,
            coach_business_name: row.coach_business_name ?? null,
          };
        }
      }
    }

    const contactIds = contacts.map((c) => c.id);
    let latestByContact: Record<string, { total_score: number; completed_at: string }> = {};

    if (contactIds.length > 0) {
      const { data: assessments, error: assessmentsError } = await supabaseAdmin
        .from("assessments")
        .select("contact_id, total_score, completed_at")
        .in("contact_id", contactIds)
        .order("completed_at", { ascending: false });

      if (!assessmentsError && assessments) {
        for (const row of assessments as Array<{ contact_id: string; total_score: number; completed_at: string }>) {
          const cid = row.contact_id;
          if (!latestByContact[cid]) {
            latestByContact[cid] = {
              total_score: row.total_score,
              completed_at: row.completed_at,
            };
          }
        }
      }
    }

    const prospects = contacts.map((c) => {
      const coachEntry = c.coach_id ? coachById[c.coach_id] : undefined;
      const coachMeta = coachEntry ?? { full_name: null, coach_business_name: null };
      const latest = latestByContact[c.id];
      return {
        id: c.id,
        coach_id: c.coach_id,
        full_name: c.full_name,
        email: c.email ?? null,
        business_name: c.business_name ?? null,
        type: c.type,
        coach_name: coachMeta.full_name,
        coach_business_name: coachMeta.coach_business_name,
        last_score: latest?.total_score ?? null,
        last_completed_at: latest?.completed_at ?? null,
      };
    });

    return NextResponse.json({ prospects });
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

