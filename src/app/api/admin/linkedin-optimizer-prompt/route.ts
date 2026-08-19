import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PROFILE_REWRITE_DEFAULT_VOICE } from "@/lib/linkedinProfileOptimizer/prompts";

const PROMPT_MAX = 24_000;

function clipPrompt(value: string): string {
  return value.length <= PROMPT_MAX ? value : value.slice(0, PROMPT_MAX);
}

export async function GET(request: Request) {
  const check = await requireAdmin(request);
  if (check.error) {
    const status = check.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: check.error }, { status });
  }

  const { data, error } = await supabaseAdmin
    .from("linkedin_optimizer_prompt")
    .select("id, system_prompt, updated_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("linkedin-optimizer-prompt GET error");
    return NextResponse.json({ error: "Unable to load prompt." }, { status: 500 });
  }

  const stored =
    typeof data?.system_prompt === "string" ? data.system_prompt.trim() : "";

  return NextResponse.json({
    prompt: stored || PROFILE_REWRITE_DEFAULT_VOICE,
    usingDefault: stored.length === 0,
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
  const reset = body.reset === true;
  const raw =
    typeof body.system_prompt === "string"
      ? body.system_prompt
      : typeof body.prompt === "string"
        ? body.prompt
        : "";
  const systemPrompt = reset ? "" : clipPrompt(raw).trim();
  const now = new Date().toISOString();

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("linkedin_optimizer_prompt")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    console.error("linkedin-optimizer-prompt PUT fetch error");
    return NextResponse.json({ error: "Unable to save prompt." }, { status: 500 });
  }

  if (existing?.id) {
    const { error: updateError } = await supabaseAdmin
      .from("linkedin_optimizer_prompt")
      .update({ system_prompt: systemPrompt, updated_at: now })
      .eq("id", existing.id);

    if (updateError) {
      console.error("linkedin-optimizer-prompt PUT update error");
      return NextResponse.json({ error: "Unable to save prompt." }, { status: 500 });
    }
  } else {
    const { error: insertError } = await supabaseAdmin
      .from("linkedin_optimizer_prompt")
      .insert({ system_prompt: systemPrompt, updated_at: now });

    if (insertError) {
      console.error("linkedin-optimizer-prompt PUT insert error");
      return NextResponse.json({ error: "Unable to save prompt." }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    usingDefault: systemPrompt.length === 0,
    prompt: systemPrompt || PROFILE_REWRITE_DEFAULT_VOICE,
  });
}
