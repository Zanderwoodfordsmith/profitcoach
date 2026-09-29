import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { generateVocallabSpeech } from "@/lib/vocallab/client";
import { getVocallabConfig } from "@/lib/vocallab/defaults";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const maxDuration = 30;

async function resolvePracticeVoiceId(): Promise<string | null> {
  const fromEnv = process.env.PRACTICE_TTS_VOICE_ID?.trim();
  if (fromEnv) return fromEnv;

  const { data } = await supabaseAdmin
    .from("coach_voices")
    .select("provider_voice_id, status")
    .eq("status", "ready")
    .not("provider_voice_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.provider_voice_id as string | null) ?? null;
}

export async function GET(request: Request) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }
  const config = getVocallabConfig();
  const voiceId = await resolvePracticeVoiceId();
  return NextResponse.json({ available: Boolean(config && voiceId) });
}

export async function POST(request: Request) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }

  const config = getVocallabConfig();
  const voiceId = await resolvePracticeVoiceId();
  if (!config || !voiceId) {
    return NextResponse.json(
      { error: "Voice playback is not configured yet." },
      { status: 503 }
    );
  }

  let body: { text?: string } = {};
  try {
    body = (await request.json()) as { text?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const text = String(body.text ?? "").trim().slice(0, 1800);
  if (!text) {
    return NextResponse.json({ error: "Nothing to read aloud." }, { status: 400 });
  }

  try {
    const speech = await generateVocallabSpeech(config.apiKey, {
      text,
      voice: voiceId,
      model: config.model,
      format: "MP3",
    });
    return new NextResponse(new Uint8Array(speech.bytes), {
      status: 200,
      headers: {
        "Content-Type": speech.mime || "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("practice tts:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not generate speech." }, { status: 502 });
  }
}
