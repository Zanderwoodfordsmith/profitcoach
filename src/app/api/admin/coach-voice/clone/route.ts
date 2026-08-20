import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  cloneVocallabVoice,
  deleteVocallabClone,
  VOCALLAB_MAX_SAMPLE_BASE64,
} from "@/lib/vocallab/client";
import { buildVoiceCloneScript, isVoiceLanguageCode } from "@/lib/vocallab/cloneScript";
import { getVocallabConfig } from "@/lib/vocallab/defaults";
import { requireAdminCoachVoiceTarget } from "@/lib/vocallab/requireAdminCoachVoice";

const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp3",
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
]);

function stripDataUrlPrefix(value: string) {
  const match = /^data:[^;]+;base64,([\s\S]+)$/.exec(value);
  return match?.[1] ?? value;
}

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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const consent = String(formData.get("consent") ?? "") === "true";
  if (!consent) {
    return NextResponse.json(
      { error: "Confirm this is the coach's own voice before cloning." },
      { status: 400 }
    );
  }

  const languageRaw = String(formData.get("language") ?? "en-GB").trim();
  if (!isVoiceLanguageCode(languageRaw)) {
    return NextResponse.json(
      { error: "Choose British English, American English, or Auto-detect." },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Record or upload a voice sample first." },
      { status: 400 }
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "Recording must be 6MB or smaller (about 30 seconds is ideal)." },
      { status: 413 }
    );
  }

  if (file.type && !ALLOWED_TYPES.has(file.type) && !file.type.startsWith("audio/")) {
    return NextResponse.json(
      { error: "Upload a WAV, MP3, or WebM audio file." },
      { status: 400 }
    );
  }

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
  if (!fullName || !location) {
    return NextResponse.json(
      {
        error:
          "Save the coach's full name and location on their profile before cloning.",
      },
      { status: 400 }
    );
  }

  const script = buildVoiceCloneScript({ fullName, location });
  const displayName = `${fullName} – clone`.slice(0, 80);

  const bytes = Buffer.from(await file.arrayBuffer());
  const audioBase64 = stripDataUrlPrefix(bytes.toString("base64"));
  if (audioBase64.length > VOCALLAB_MAX_SAMPLE_BASE64) {
    return NextResponse.json(
      { error: "That recording is too large after encoding. Try a shorter clip." },
      { status: 413 }
    );
  }

  const { data: existing } = await supabaseAdmin
    .from("coach_voices")
    .select("id, provider_voice_id, status")
    .eq("coach_id", auth.coachId)
    .in("status", ["pending", "ready", "failed"])
    .maybeSingle();

  const now = new Date().toISOString();
  let rowId = existing?.id as string | undefined;

  if (rowId) {
    const { error: updateError } = await supabaseAdmin
      .from("coach_voices")
      .update({
        status: "pending",
        language: languageRaw,
        sample_transcript: script,
        display_name: displayName,
        consent_at: now,
        error_message: null,
        updated_at: now,
      })
      .eq("id", rowId);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  } else {
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("coach_voices")
      .insert({
        coach_id: auth.coachId,
        provider: "vocallab",
        status: "pending",
        language: languageRaw,
        sample_transcript: script,
        display_name: displayName,
        consent_at: now,
      })
      .select("id")
      .single();
    if (insertError || !inserted) {
      return NextResponse.json(
        { error: insertError?.message ?? "Could not start voice clone." },
        { status: 500 }
      );
    }
    rowId = inserted.id as string;
  }

  try {
    if (existing?.provider_voice_id) {
      await deleteVocallabClone(config.apiKey, existing.provider_voice_id);
    }

    const cloned = await cloneVocallabVoice(config.apiKey, {
      name: displayName,
      language: languageRaw,
      audioBase64,
      transcript: script,
      removeBackgroundNoise: true,
    });

    const { data: voice, error: readyError } = await supabaseAdmin
      .from("coach_voices")
      .update({
        status: "ready",
        provider_voice_id: cloned.id,
        language: languageRaw,
        display_name: cloned.name || displayName,
        sample_transcript: script,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", rowId)
      .select(
        "id, status, display_name, language, provider_voice_id, sample_transcript, consent_at, error_message, created_at, updated_at"
      )
      .single();

    if (readyError || !voice) {
      return NextResponse.json(
        { error: readyError?.message ?? "Clone succeeded but save failed." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      voice,
      audio_notes: cloned.audio_notes ?? [],
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "VocalLab could not clone this voice.";
    await supabaseAdmin
      .from("coach_voices")
      .update({
        status: "failed",
        error_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", rowId);

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
