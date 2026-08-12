import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RouteContext = { params: Promise<{ id: string; sessionId: string }> };

/** PATCH — update notes/title on an existing coaching session row. */
export async function PATCH(request: Request, context: RouteContext) {
  const authCheck = await requireCoachRequest(request, { allowAdminSelf: true });
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const { id: contactId, sessionId } = await context.params;
  if (!contactId?.trim() || !sessionId?.trim()) {
    return NextResponse.json({ error: "Missing ids." }, { status: 400 });
  }

  let body: { title?: string; notes?: string };
  try {
    body = (await request.json()) as { title?: string; notes?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string") {
    patch.title = body.title.trim().slice(0, 200) || "Coaching session";
  }
  if (typeof body.notes === "string") {
    patch.notes = body.notes;
  }
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("client_coaching_sessions")
    .update(patch)
    .eq("id", sessionId)
    .eq("contact_id", contactId)
    .eq("coach_id", authCheck.userId)
    .select("id, notes, title, starts_at, ends_at, source")
    .maybeSingle();

  if (error) {
    console.error("session PATCH:", error);
    return NextResponse.json(
      { error: "Unable to update session." },
      { status: 500 }
    );
  }
  if (!data) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  return NextResponse.json({ session: data });
}
