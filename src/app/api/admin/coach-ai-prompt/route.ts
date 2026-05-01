import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const check = await requireAdmin(request);
  if (check.error) {
    const status = check.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: check.error }, { status });
  }

  const { data, error } = await supabaseAdmin
    .from("coach_ai_prompt")
    .select("id, system_prompt, updated_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("coach-ai-prompt GET error:", error);
    return NextResponse.json({ error: "Unable to load prompt." }, { status: 500 });
  }

  return NextResponse.json({
    prompt: data?.system_prompt ?? "",
    updated_at: data?.updated_at ?? null,
  });
}

export async function PUT(request: Request) {
  const check = await requireAdmin(request);
  if (check.error) {
    const status = check.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: check.error }, { status });
  }

  const body = await request.json().catch(() => ({}));
  const systemPrompt =
    typeof body.system_prompt === "string"
      ? body.system_prompt
      : typeof body.prompt === "string"
        ? body.prompt
        : "";

  const now = new Date().toISOString();

  // Upsert: update first row or insert if none
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("coach_ai_prompt")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    console.error("coach-ai-prompt PUT fetch existing error:", fetchError);
    return NextResponse.json(
      { error: "Unable to save prompt. (Table may be missing—run the coach_ai_chats migration.)" },
      { status: 500 }
    );
  }

  if (existing?.id) {
    const { error: updateError } = await supabaseAdmin
      .from("coach_ai_prompt")
      .update({ system_prompt: systemPrompt, updated_at: now })
      .eq("id", existing.id);

    if (updateError) {
      console.error("coach-ai-prompt PUT update error:", updateError);
      const hint =
        process.env.NODE_ENV === "development"
          ? ` ${(updateError as { message?: string }).message ?? String(updateError)}`
          : "";
      return NextResponse.json(
        { error: `Unable to save prompt.${hint}` },
        { status: 500 }
      );
    }
  } else {
    const { error: insertError } = await supabaseAdmin.from("coach_ai_prompt").insert({
      system_prompt: systemPrompt,
      updated_at: now,
    });

    if (insertError) {
      console.error("coach-ai-prompt PUT insert error:", insertError);
      const hint =
        process.env.NODE_ENV === "development"
          ? ` ${(insertError as { message?: string }).message ?? String(insertError)}`
          : "";
      return NextResponse.json(
        { error: `Unable to save prompt.${hint}` },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}
