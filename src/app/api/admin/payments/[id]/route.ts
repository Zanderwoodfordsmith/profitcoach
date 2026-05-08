import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type PatchBody = {
  coachId?: string | null;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin(request);
  if (check.error) {
    const status = check.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: check.error }, { status });
  }

  const { id: paymentId } = await context.params;
  if (!paymentId?.trim()) {
    return NextResponse.json({ error: "Missing payment id." }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!Object.prototype.hasOwnProperty.call(body, "coachId")) {
    return NextResponse.json({ error: "coachId is required." }, { status: 400 });
  }

  const coachId = body.coachId?.trim() ? body.coachId.trim() : null;
  if (coachId) {
    const { data: coach, error: coachError } = await supabaseAdmin
      .from("coaches")
      .select("id")
      .eq("id", coachId)
      .maybeSingle();
    if (coachError || !coach) {
      return NextResponse.json({ error: "Coach not found." }, { status: 400 });
    }
  }

  const { error: updateError } = await supabaseAdmin
    .from("coach_payments")
    .update({
      coach_id: coachId,
      assignment_method: coachId ? "manual" : "unassigned",
    })
    .eq("id", paymentId);

  if (updateError) {
    console.error("admin/payments/[id] PATCH:", updateError);
    return NextResponse.json({ error: "Unable to update payment assignment." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
