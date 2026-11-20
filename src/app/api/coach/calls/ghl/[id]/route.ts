import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireCoachRequest } from "@/lib/requireCoachRequest";

/**
 * Mark a calendar (GHL) call as completed or no-show, or clear the mark.
 * GHL never tells us this, so it's saved in coach_outcome, which the GHL
 * webhook never writes.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing call id." }, { status: 400 });
  }

  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { data: call } = await supabaseAdmin
    .from("ghl_appointments")
    .select("id, coach_id")
    .eq("id", id.trim())
    .maybeSingle();
  if (!call) {
    return NextResponse.json({ error: "Call not found." }, { status: 404 });
  }
  if (!auth.callerIsAdmin && call.coach_id !== auth.userId) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  let body: { outcome?: string | null };
  try {
    body = (await request.json()) as { outcome?: string | null };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const outcome = body.outcome ?? null;
  if (outcome !== null && outcome !== "completed" && outcome !== "noshow") {
    return NextResponse.json(
      { error: "outcome must be completed, noshow or null." },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from("ghl_appointments")
    .update({
      coach_outcome: outcome,
      coach_outcome_at: outcome ? new Date().toISOString() : null,
    })
    .eq("id", call.id);
  if (error) {
    console.error("ghl call outcome PATCH:", error);
    return NextResponse.json({ error: "Could not update." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, outcome });
}
