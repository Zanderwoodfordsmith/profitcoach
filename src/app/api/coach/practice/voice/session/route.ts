import { NextResponse } from "next/server";

import { avaCallProtocol, PAM_DECISION_CALL_PATH } from "@/lib/practiceKnowledge/intakeCall";
import { ensurePracticeKnowledge } from "@/lib/practiceKnowledge/store";
import { requireCoachRequest } from "@/lib/requireCoachRequest";

export const maxDuration = 30;

/**
 * Live voice uses an ElevenLabs agent whose custom LLM is
 * `${origin}/api/ava/voice/llm`, with API key AVA_BRIDGE_SECRET.
 * The agent should have no opening line of its own: this app speaks first.
 * Until those env vars are set, the call still runs: Ava speaks each question
 * and listens for the answer.
 */
function liveVoiceConfigured(): boolean {
  return Boolean(
    process.env.ELEVENLABS_API_KEY?.trim() &&
      process.env.ELEVENLABS_AGENT_ID?.trim() &&
      process.env.AVA_BRIDGE_SECRET?.trim()
  );
}

export async function GET(request: Request) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }
  try {
    const knowledge = await ensurePracticeKnowledge(check.userId);
    return NextResponse.json({
      live: liveVoiceConfigured(),
      protocol: avaCallProtocol(knowledge.interview_completed_at),
      bookPath: PAM_DECISION_CALL_PATH,
    });
  } catch (err) {
    console.error("ava voice session GET:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not start the call." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }
  if (!liveVoiceConfigured()) {
    return NextResponse.json({ error: "Live voice is not configured.", live: false }, { status: 503 });
  }

  const signedUrlResponse = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(process.env.ELEVENLABS_AGENT_ID!.trim())}`,
    { headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY!.trim() } }
  );
  if (!signedUrlResponse.ok) {
    console.error("ElevenLabs signed URL failed", signedUrlResponse.status);
    return NextResponse.json({ error: "Could not reach the voice service." }, { status: 502 });
  }

  const { signed_url: signedUrl } = (await signedUrlResponse.json()) as { signed_url?: string };
  if (!signedUrl) {
    return NextResponse.json({ error: "Could not reach the voice service." }, { status: 502 });
  }

  const knowledge = await ensurePracticeKnowledge(check.userId);
  return NextResponse.json({
    signedUrl,
    live: true,
    protocol: avaCallProtocol(knowledge.interview_completed_at),
    bookPath: PAM_DECISION_CALL_PATH,
  });
}
