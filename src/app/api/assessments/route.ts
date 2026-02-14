import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Body = {
  coachSlug?: string;
  from_landing?: "a" | "b";
  contact: {
    full_name?: string;
    email?: string;
    business_name?: string;
    phone?: string;
  };
  answers: Record<string, 0 | 1 | 2>;
  total_score: number;
};

const CENTRAL_SLUG = "BCA";

export async function POST(request: Request) {
  const body = (await request.json()) as Body;

  // Central marketing: missing or empty slug defaults to BCA
  const coachSlug =
    typeof body.coachSlug === "string" && body.coachSlug.trim()
      ? body.coachSlug.trim().toLowerCase()
      : CENTRAL_SLUG.toLowerCase();

  if (
    typeof body.total_score !== "number" ||
    body.total_score < 0 ||
    body.total_score > 100
  ) {
    return NextResponse.json(
      { error: "Invalid total_score" },
      { status: 400 }
    );
  }

  // Look up coach (create a coach with slug "BCA" to receive central submissions)
  const {
    data: coach,
    error: coachError,
  } = await supabaseAdmin
    .from("coaches")
    .select("id")
    .eq("slug", coachSlug)
    .maybeSingle();

  if (coachError || !coach) {
    return NextResponse.json(
      {
        error:
          coachSlug === CENTRAL_SLUG.toLowerCase()
            ? "Central assessment is not set up. Create a coach with slug \"BCA\" in Admin to receive central marketing submissions."
            : "Coach not found for this link.",
      },
      { status: 400 }
    );
  }

  const coachId = coach.id as string;

  const fullName = body.contact?.full_name?.trim() || "Unknown";
  const email = body.contact?.email?.trim() || null;
  const businessName = body.contact?.business_name?.trim() || null;
  const phone = body.contact?.phone?.trim() || null;

  // Upsert contact for this coach by email (if provided), otherwise always create
  let contactId: string | null = null;

  if (email) {
    const {
      data: existing,
      error: contactLookupError,
    } = await supabaseAdmin
      .from("contacts")
      .select("id")
      .eq("coach_id", coachId)
      .eq("email", email)
      .maybeSingle();

    if (!contactLookupError && existing) {
      contactId = existing.id as string;
    }
  }

  if (!contactId) {
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("contacts")
      .insert({
        coach_id: coachId,
        type: "prospect",
        full_name: fullName,
        email,
        business_name: businessName,
        phone,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      return NextResponse.json(
        { error: "Failed to create contact" },
        { status: 500 }
      );
    }
    contactId = inserted.id as string;
  }

  const {
    data: assessment,
    error: assessmentError,
  } = await supabaseAdmin
    .from("assessments")
    .insert({
      coach_id: coachId,
      contact_id: contactId,
      source: "prospect_link",
      total_score: body.total_score,
      answers: body.answers,
    })
    .select("id, completed_at")
    .single();

  if (assessmentError || !assessment) {
    return NextResponse.json(
      { error: "Failed to save assessment" },
      { status: 500 }
    );
  }

  const fromLanding = body.from_landing === "a" || body.from_landing === "b" ? body.from_landing : null;
  if (fromLanding) {
    const { data: runningTest } = await supabaseAdmin
      .from("landing_tests")
      .select("id")
      .eq("status", "running")
      .limit(1)
      .maybeSingle();
    if (runningTest) {
      await supabaseAdmin.from("landing_events").insert({
        test_id: runningTest.id,
        variant: fromLanding,
        coach_slug: coachSlug,
        event_type: "finish",
        contact_id: contactId,
        assessment_id: assessment.id,
      });
    }
  }

  return NextResponse.json(
    {
      id: assessment.id,
      completed_at: assessment.completed_at,
    },
    { status: 201 }
  );
}

