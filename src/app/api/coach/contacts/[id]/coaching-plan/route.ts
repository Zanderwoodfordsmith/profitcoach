import { NextResponse } from "next/server";
import { normalizeCoachingPlan } from "@/lib/clientCoaching/normalize";
import type { CoachingPlanDocument } from "@/lib/clientCoaching/types";
import { isMissingColumnError } from "@/lib/contactsSchemaSafeSelect";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RouteContext = { params: Promise<{ id: string }> };

const MIGRATION_HINT =
  "Apply the contacts.coaching_plan migration, then retry.";

async function loadContactForPlan(contactId: string): Promise<{
  contact: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    business_name: string | null;
    job_title: string | null;
    linkedin_url: string | null;
    photo_url: string | null;
    headline: string | null;
    location: string | null;
    type: string;
    coach_id: string | null;
    coaching_plan: unknown;
  } | null;
  missingColumn: boolean;
  error: string | null;
}> {
  const withPlan =
    "id, full_name, email, phone, business_name, job_title, linkedin_url, photo_url, headline, location, type, coach_id, coaching_plan";
  const withoutPlan =
    "id, full_name, email, business_name, type, coach_id";

  const full = await supabaseAdmin
    .from("contacts")
    .select(withPlan)
    .eq("id", contactId)
    .maybeSingle();

  if (!full.error && full.data) {
    const row = full.data as Record<string, unknown>;
    return {
      contact: {
        id: row.id as string,
        full_name: row.full_name as string,
        email: (row.email as string | null) ?? null,
        phone: (row.phone as string | null) ?? null,
        business_name: (row.business_name as string | null) ?? null,
        job_title: (row.job_title as string | null) ?? null,
        linkedin_url: (row.linkedin_url as string | null) ?? null,
        photo_url: (row.photo_url as string | null) ?? null,
        headline: (row.headline as string | null) ?? null,
        location: (row.location as string | null) ?? null,
        type: (row.type as string) ?? "client",
        coach_id: (row.coach_id as string | null) ?? null,
        coaching_plan: row.coaching_plan ?? null,
      },
      missingColumn: false,
      error: null,
    };
  }

  if (full.error && isMissingColumnError(full.error)) {
    const base = await supabaseAdmin
      .from("contacts")
      .select(withoutPlan)
      .eq("id", contactId)
      .maybeSingle();
    if (base.error) {
      return { contact: null, missingColumn: true, error: base.error.message };
    }
    if (!base.data) {
      return { contact: null, missingColumn: true, error: null };
    }
    const row = base.data as Record<string, unknown>;
    return {
      contact: {
        id: row.id as string,
        full_name: row.full_name as string,
        email: (row.email as string | null) ?? null,
        phone: null,
        business_name: (row.business_name as string | null) ?? null,
        job_title: null,
        linkedin_url: null,
        photo_url: null,
        headline: null,
        location: null,
        type: (row.type as string) ?? "client",
        coach_id: (row.coach_id as string | null) ?? null,
        coaching_plan: null,
      },
      missingColumn: true,
      error: null,
    };
  }

  if (full.error) {
    return { contact: null, missingColumn: false, error: full.error.message };
  }

  return { contact: null, missingColumn: false, error: null };
}

export async function GET(request: Request, context: RouteContext) {
  const authCheck = await requireCoachRequest(request, { allowAdminSelf: true });
  if (authCheck.error || !authCheck.userId) {
    const status = authCheck.error === "Invalid access token." ? 401 : 403;
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status }
    );
  }

  const { id: contactId } = await context.params;
  if (!contactId?.trim()) {
    return NextResponse.json({ error: "Missing contact id." }, { status: 400 });
  }

  const { contact, missingColumn, error } = await loadContactForPlan(contactId);
  if (error) {
    console.error("coaching-plan GET:", error);
    return NextResponse.json(
      { error: "Unable to load coaching plan." },
      { status: 500 }
    );
  }
  if (!contact || contact.coach_id !== authCheck.userId) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  const plan = normalizeCoachingPlan(contact.coaching_plan);

  return NextResponse.json({
    contact: {
      id: contact.id,
      fullName: contact.full_name,
      email: contact.email,
      phone: contact.phone,
      businessName: contact.business_name,
      jobTitle: contact.job_title,
      linkedinUrl: contact.linkedin_url,
      photoUrl: contact.photo_url,
      headline: contact.headline,
      location: contact.location,
      type: contact.type,
    },
    plan,
    migrationNeeded: missingColumn,
  });
}

export async function PUT(request: Request, context: RouteContext) {
  const authCheck = await requireCoachRequest(request, { allowAdminSelf: true });
  if (authCheck.error || !authCheck.userId) {
    const status = authCheck.error === "Invalid access token." ? 401 : 403;
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status }
    );
  }

  const { id: contactId } = await context.params;
  if (!contactId?.trim()) {
    return NextResponse.json({ error: "Missing contact id." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const rawPlan =
    body && typeof body === "object" && !Array.isArray(body) && "plan" in body
      ? (body as { plan: unknown }).plan
      : body;

  const plan: CoachingPlanDocument = {
    ...normalizeCoachingPlan(rawPlan),
    updatedAt: new Date().toISOString(),
  };

  const { contact, missingColumn, error } = await loadContactForPlan(contactId);
  if (error) {
    console.error("coaching-plan PUT load:", error);
    return NextResponse.json(
      { error: "Unable to save coaching plan." },
      { status: 500 }
    );
  }
  if (!contact || contact.coach_id !== authCheck.userId) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }
  if (missingColumn) {
    return NextResponse.json({ error: MIGRATION_HINT }, { status: 503 });
  }

  const { error: updateError } = await supabaseAdmin
    .from("contacts")
    .update({ coaching_plan: plan })
    .eq("id", contactId)
    .eq("coach_id", authCheck.userId);

  if (updateError) {
    if (isMissingColumnError(updateError)) {
      return NextResponse.json({ error: MIGRATION_HINT }, { status: 503 });
    }
    console.error("coaching-plan PUT:", updateError);
    return NextResponse.json(
      { error: "Unable to save coaching plan." },
      { status: 500 }
    );
  }

  return NextResponse.json({ plan });
}
