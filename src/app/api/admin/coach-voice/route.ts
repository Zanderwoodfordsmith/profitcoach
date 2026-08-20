import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { deleteVocallabClone } from "@/lib/vocallab/client";
import { buildVoiceCloneScript } from "@/lib/vocallab/cloneScript";
import { getVocallabConfig } from "@/lib/vocallab/defaults";
import { requireAdminCoachVoiceTarget } from "@/lib/vocallab/requireAdminCoachVoice";

export type CoachVoiceDto = {
  id: string;
  status: string;
  display_name: string | null;
  language: string;
  provider_voice_id: string | null;
  sample_transcript: string | null;
  consent_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export async function GET(request: Request) {
  const auth = await requireAdminCoachVoiceTarget(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const config = getVocallabConfig();

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("first_name, last_name, full_name, location")
    .eq("id", auth.coachId)
    .maybeSingle();

  const fullName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
    profile?.full_name?.trim() ||
    "";
  const location = profile?.location?.trim() || "";
  const script = buildVoiceCloneScript({ fullName, location });

  const { data: voice, error } = await supabaseAdmin
    .from("coach_voices")
    .select(
      "id, status, display_name, language, provider_voice_id, sample_transcript, consent_at, error_message, created_at, updated_at"
    )
    .eq("coach_id", auth.coachId)
    .in("status", ["pending", "ready", "failed"])
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    configured: Boolean(config),
    coach: {
      id: auth.coachId,
      full_name: fullName || null,
      location: location || null,
      script_ready: Boolean(fullName && location),
    },
    script,
    voice: (voice as CoachVoiceDto | null) ?? null,
  });
}

export async function DELETE(request: Request) {
  const auth = await requireAdminCoachVoiceTarget(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const config = getVocallabConfig();

  const { data: existing } = await supabaseAdmin
    .from("coach_voices")
    .select("id, provider_voice_id")
    .eq("coach_id", auth.coachId)
    .in("status", ["pending", "ready", "failed"])
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ ok: true, deleted: false });
  }

  if (config && existing.provider_voice_id) {
    try {
      await deleteVocallabClone(config.apiKey, existing.provider_voice_id);
    } catch (err) {
      console.error("[coach-voice] delete Vocallab clone", err);
    }
  }

  const { error } = await supabaseAdmin
    .from("coach_voices")
    .update({
      status: "deleted",
      provider_voice_id: null,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted: true });
}
