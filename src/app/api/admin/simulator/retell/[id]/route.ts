import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** Admin: one imported Retell practice call, with its transcript and report. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin(request);
  if (check.error) return NextResponse.json({ error: check.error }, { status: 401 });
  const { id } = await params;

  const { data: call } = await supabaseAdmin.from("retell_practice_calls").select("*").eq("call_id", id).maybeSingle();
  if (!call) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const { data: coach } = call.coach_id
    ? await supabaseAdmin.from("profiles").select("full_name").eq("id", call.coach_id).maybeSingle()
    : { data: null };

  return NextResponse.json({ call, coachName: coach?.full_name ?? null });
}
