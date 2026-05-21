import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  const authCheck = await requireCoachRequest(request);
  if (authCheck.error || !authCheck.userId) {
    const status = authCheck.error === "Invalid access token." ? 401 : 403;
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status }
    );
  }

  const coachId = authCheck.userId;
  const { id: contactId } = await context.params;
  if (!contactId?.trim()) {
    return NextResponse.json({ error: "Missing contact id." }, { status: 400 });
  }

  const { data: contact, error: fetchError } = await supabaseAdmin
    .from("contacts")
    .select("id, type, coach_id")
    .eq("id", contactId)
    .maybeSingle();

  if (fetchError) {
    console.error("coach/contacts/[id] DELETE fetch:", fetchError);
    return NextResponse.json(
      { error: "Unable to delete prospect." },
      { status: 500 }
    );
  }

  if (!contact || contact.coach_id !== coachId) {
    return NextResponse.json({ error: "Prospect not found." }, { status: 404 });
  }

  if (contact.type !== "prospect") {
    return NextResponse.json(
      { error: "Only prospects can be deleted here." },
      { status: 400 }
    );
  }

  const { error: deleteError } = await supabaseAdmin
    .from("contacts")
    .delete()
    .eq("id", contactId);

  if (deleteError) {
    console.error("coach/contacts/[id] DELETE:", deleteError);
    return NextResponse.json(
      { error: "Unable to delete prospect." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
