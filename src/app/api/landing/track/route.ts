import { NextResponse } from "next/server";
import { resolveLandingEventTestId } from "@/lib/landingEvergreenTest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Body = {
  variant: "a" | "b" | "c" | "d";
  coach_slug?: string | null;
  event_type: "view" | "start" | "opt_in" | "finish";
  session_id?: string | null;
  contact_id?: string | null;
  assessment_id?: string | null;
  email?: string | null;
};

async function resolveContactIdForLandingEvent(
  coachSlug: string | null,
  contactId: string | null,
  email: string | null
): Promise<string | null> {
  if (contactId) return contactId;
  const normalizedEmail = email?.trim().toLowerCase() || null;
  if (!normalizedEmail || !coachSlug) return null;

  const { data: coach } = await supabaseAdmin
    .from("coaches")
    .select("id")
    .eq("slug", coachSlug)
    .maybeSingle();

  if (!coach?.id) return null;

  const { data: contact } = await supabaseAdmin
    .from("contacts")
    .select("id")
    .eq("coach_id", coach.id)
    .eq("email", normalizedEmail)
    .maybeSingle();

  return (contact?.id as string | undefined) ?? null;
}

export async function POST(request: Request) {
  const body = (await request.json()) as Body;

  const variant =
    body.variant === "a" ||
    body.variant === "b" ||
    body.variant === "c" ||
    body.variant === "d"
      ? body.variant
      : null;
  const event_type = ["view", "start", "opt_in", "finish"].includes(body.event_type)
    ? body.event_type
    : null;

  if (!variant || !event_type) {
    return NextResponse.json(
      { error: "Missing or invalid variant or event_type." },
      { status: 400 }
    );
  }

  const coach_slug =
    body.coach_slug === null || body.coach_slug === undefined
      ? null
      : typeof body.coach_slug === "string"
        ? body.coach_slug.trim() || null
        : null;
  const session_id = typeof body.session_id === "string" ? body.session_id.trim() || null : null;
  const assessment_id = body.assessment_id ?? null;
  const email = typeof body.email === "string" ? body.email.trim() || null : null;
  const contact_id = await resolveContactIdForLandingEvent(
    coach_slug,
    body.contact_id ?? null,
    email
  );

  try {
    const testId = await resolveLandingEventTestId();

    const row: Record<string, unknown> = {
      variant,
      coach_slug,
      event_type,
    };
    if (testId) row.test_id = testId;
    if (session_id != null) row.session_id = session_id;
    if (contact_id != null) row.contact_id = contact_id;
    if (assessment_id != null) row.assessment_id = assessment_id;

    const { error: insertError } = await supabaseAdmin.from("landing_events").insert(row);

    if (insertError) {
      console.error("landing/track insert failed:", insertError.message, {
        variant,
        event_type,
        code: insertError.code,
      });
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("landing/track unexpected error:", err);
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
