import { NextResponse } from "next/server";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";
import { isWatchEvent, type WatchScopeKind } from "@/lib/coachWatch/rules";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as {
    in_app?: boolean;
    email?: boolean;
    whatsapp?: boolean;
    event?: string;
  };
  const patch: Record<string, unknown> = {};
  if (typeof body.in_app === "boolean") patch.in_app = body.in_app;
  if (typeof body.email === "boolean") patch.email = body.email;
  if (typeof body.whatsapp === "boolean") patch.whatsapp = body.whatsapp;
  if (typeof body.event === "string") patch.event = body.event.trim();
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("coach_watch_rules")
    .select("id, scope_kind")
    .eq("id", id)
    .eq("coach_id", auth.coachId)
    .maybeSingle();
  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (
    typeof patch.event === "string" &&
    !isWatchEvent(existing.scope_kind as WatchScopeKind, patch.event)
  ) {
    return NextResponse.json({ error: "Invalid watch event." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("coach_watch_rules")
    .update(patch)
    .eq("id", id)
    .eq("coach_id", auth.coachId)
    .select("id, scope_kind, scope_id, event, in_app, email, whatsapp")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ rule: data });
}

export async function DELETE(request: Request, ctx: Ctx) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { id } = await ctx.params;
  const { error } = await supabaseAdmin
    .from("coach_watch_rules")
    .delete()
    .eq("id", id)
    .eq("coach_id", auth.coachId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
