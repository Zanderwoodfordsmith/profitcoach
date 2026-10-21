import { NextResponse } from "next/server";

import {
  curriculumPatchToDb,
  curriculumPlanItemFromDb,
  curriculumRowKey,
  type CurriculumPlanItemDbRow,
} from "@/lib/academy/curriculumPlan";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { id } = await params;

  let fields: Record<string, unknown>;
  try {
    fields = curriculumPatchToDb(await request.json());
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid JSON body.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("curriculum_plan_items")
    .update({ ...fields, updated_by: auth.userId, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Plan row not found." }, { status: 404 });
  }
  return NextResponse.json({
    item: curriculumPlanItemFromDb(data as CurriculumPlanItemDbRow),
  });
}

/** Removes a new lesson, or resets a current lesson to undecided. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { id } = await params;

  const { data: existing, error: readError } = await supabaseAdmin
    .from("curriculum_plan_items")
    .select("id, lesson_id")
    .eq("id", id)
    .maybeSingle();
  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ ok: true });
  }

  const key = curriculumRowKey({
    id: existing.id as string,
    lessonId: (existing.lesson_id as string | null) ?? null,
  });

  // A current lesson keeps its key after a reset, so only new lessons
  // leave dangling "goes into" links behind.
  if (!existing.lesson_id) {
    const { error: unlinkError } = await supabaseAdmin
      .from("curriculum_plan_items")
      .update({ into_key: null })
      .eq("into_key", key);
    if (unlinkError) {
      return NextResponse.json({ error: unlinkError.message }, { status: 500 });
    }
  }

  const { error } = await supabaseAdmin.from("curriculum_plan_items").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
