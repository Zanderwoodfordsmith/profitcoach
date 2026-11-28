import { NextResponse } from "next/server";

import { NEW_PLAN_DRAFT_ID, parseNewPlan } from "@/lib/academy/newCurriculumPlan";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/** Save the whole new curriculum plan (Academy → Curriculum → New plan). */
export async function PUT(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const plan = parseNewPlan((body as { plan?: unknown } | null)?.plan);
  if (!plan) {
    return NextResponse.json({ error: "That isn't a curriculum plan." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("curriculum_drafts").upsert({
    id: NEW_PLAN_DRAFT_ID,
    plan,
    updated_by: auth.userId,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error("curriculum-new-plan PUT:", error.message);
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
