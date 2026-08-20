import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateVocallabSpeech } from "@/lib/vocallab/client";
import { getVocallabConfig } from "@/lib/vocallab/defaults";
import { requireAdminCoachVoiceTarget } from "@/lib/vocallab/requireAdminCoachVoice";

const PREVIEW_TEXT =
  "Hi, this is a quick preview of my cloned voice. Does this sound like me?";

export async function POST(request: Request) {
  const auth = await requireAdminCoachVoiceTarget(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const config = getVocallabConfig();
  if (!config) {
    return NextResponse.json(
      {
        error:
          "VocalLab is not configured. Add VOCALLAB_API_KEY to .env.local (and Vercel).",
      },
      { status: 503 }
    );
  }

  const { data: voice } = await supabaseAdmin
    .from("coach_voices")
    .select("provider_voice_id, status, display_name")
    .eq("coach_id", auth.coachId)
    .eq("status", "ready")
    .maybeSingle();

  if (!voice?.provider_voice_id) {
    return NextResponse.json(
      { error: "Clone a voice for this coach before generating a preview." },
      { status: 400 }
    );
  }

  try {
    const speech = await generateVocallabSpeech(config.apiKey, {
      text: PREVIEW_TEXT,
      voice: voice.provider_voice_id,
      model: config.model,
      format: "MP3",
    });

    return NextResponse.json({
      text: PREVIEW_TEXT,
      mime: speech.mime,
      audio_base64: `data:${speech.mime};base64,${speech.bytes.toString("base64")}`,
      points_used: speech.pointsUsed,
      voice_name: voice.display_name,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not generate a voice preview.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
