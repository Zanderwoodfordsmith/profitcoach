import { NextResponse } from "next/server";
import { parseCallPage } from "@/lib/callPage/content";
import { callPageEditor } from "@/lib/callPage/editor";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const ed = await callPageEditor(request);
  if ("error" in ed) return NextResponse.json({ error: ed.error }, { status: ed.status });
  return NextResponse.json({ coachId: ed.coach.id, actingAsAdmin: ed.actingAsAdmin });
}

/** Saves the page's words: { sales: CallPageContent }. */
export async function PATCH(request: Request) {
  const ed = await callPageEditor(request);
  if ("error" in ed) return NextResponse.json({ error: ed.error }, { status: ed.status });
  const body = (await request.json().catch(() => ({}))) as { sales?: unknown };
  if (!body.sales || typeof body.sales !== "object") {
    return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  }
  // Clean it through the same parser the page reads with.
  const sales = parseCallPage(body.sales, {
    firstName: ed.coach.displayName.split(/\s+/)[0],
    callName: ed.calendar.name,
    minutes: ed.calendar.meeting_duration_minutes,
  });

  const { data: row } = await supabaseAdmin
    .from("coach_calendars")
    .select("page")
    .eq("id", ed.calendar.id)
    .maybeSingle();
  const page = { ...((row?.page as Record<string, unknown> | null) ?? {}), sales };
  const { error } = await supabaseAdmin
    .from("coach_calendars")
    .update({ page })
    .eq("id", ed.calendar.id)
    .eq("coach_id", ed.coach.id);
  if (error) return NextResponse.json({ error: "That did not save. Try again." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
