import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  clipReplyCopilotPrompt,
  REPLY_COPILOT_DEFAULT_VOICE,
  resolveReplyCopilotModel,
} from "@/lib/messaging/replyCopilot";

async function loadSettings() {
  return supabaseAdmin
    .from("reply_copilot_settings")
    .select("id, system_prompt, model, updated_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

export async function GET(request: Request) {
  const check = await requireAdmin(request);
  if (check.error) {
    const status = check.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: check.error }, { status });
  }

  const { data, error } = await loadSettings();
  if (error) {
    console.error("reply-copilot-settings GET error");
    return NextResponse.json({ error: "Unable to load prompt." }, { status: 500 });
  }

  const stored =
    typeof data?.system_prompt === "string" ? data.system_prompt.trim() : "";

  return NextResponse.json({
    prompt: stored || REPLY_COPILOT_DEFAULT_VOICE,
    model: resolveReplyCopilotModel(
      typeof data?.model === "string" ? data.model : null
    ),
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
  const systemPrompt = reset ? "" : clipReplyCopilotPrompt(raw).trim();
  const model = resolveReplyCopilotModel(
    typeof body.model === "string" ? body.model : null
  );
  const now = new Date().toISOString();

  const { data: existing, error: fetchError } = await loadSettings();
  if (fetchError) {
    console.error("reply-copilot-settings PUT fetch error");
    return NextResponse.json({ error: "Unable to save prompt." }, { status: 500 });
  }

  const row = {
    system_prompt: systemPrompt,
    model,
    updated_at: now,
  };

  if (existing?.id) {
    const { error: updateError } = await supabaseAdmin
      .from("reply_copilot_settings")
      .update(row)
      .eq("id", existing.id);
    if (updateError) {
      console.error("reply-copilot-settings PUT update error");
      return NextResponse.json({ error: "Unable to save prompt." }, { status: 500 });
    }
  } else {
    const { error: insertError } = await supabaseAdmin
      .from("reply_copilot_settings")
      .insert(row);
    if (insertError) {
      console.error("reply-copilot-settings PUT insert error");
      return NextResponse.json({ error: "Unable to save prompt." }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    usingDefault: systemPrompt.length === 0,
    prompt: systemPrompt || REPLY_COPILOT_DEFAULT_VOICE,
    model,
  });
}
