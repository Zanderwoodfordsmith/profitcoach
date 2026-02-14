import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Body = {
  variant: "a" | "b";
  coach_slug?: string | null;
  event_type: "view" | "start" | "opt_in" | "finish";
  session_id?: string | null;
  contact_id?: string | null;
  assessment_id?: string | null;
};

export async function POST(request: Request) {
  const body = (await request.json()) as Body;

  const variant = body.variant === "a" || body.variant === "b" ? body.variant : null;
  const event_type = ["view", "start", "opt_in", "finish"].includes(body.event_type)
    ? body.event_type
    : null;

  if (!variant || !event_type) {
    return NextResponse.json(
      { error: "Missing or invalid variant or event_type." },
      { status: 400 }
    );
  }

  const coach_slug = typeof body.coach_slug === "string" ? body.coach_slug.trim() || null : null;
  const session_id = typeof body.session_id === "string" ? body.session_id.trim() || null : null;
  const contact_id = body.contact_id ?? null;
  const assessment_id = body.assessment_id ?? null;

  try {
    const { data: runningTest, error: testError } = await supabaseAdmin
      .from("landing_tests")
      .select("id")
      .eq("status", "running")
      .limit(1)
      .maybeSingle();

    if (testError || !runningTest) {
      return NextResponse.json({ ok: false, skipped: true }, { status: 200 });
    }

    const row: Record<string, unknown> = {
      test_id: runningTest.id,
      variant,
      coach_slug,
      event_type,
    };
    if (session_id != null) row.session_id = session_id;
    if (contact_id != null) row.contact_id = contact_id;
    if (assessment_id != null) row.assessment_id = assessment_id;

    const { error: insertError } = await supabaseAdmin.from("landing_events").insert(row);

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: "Unexpected error." },
      { status: 500 }
    );
  }
}
