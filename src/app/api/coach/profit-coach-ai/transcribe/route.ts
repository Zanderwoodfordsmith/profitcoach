import { NextResponse } from "next/server";

import { requireCoachEffectiveId } from "../_auth";

export const runtime = "nodejs";

/** ~8M base64 chars ≈ 6 MB audio — far above a 3-minute Opus voice note. */
const MAX_AUDIO_BASE64_CHARS = 8_000_000;

/**
 * Speech-to-text for the AI panel mic. Runs on Cloudflare Workers AI Whisper —
 * the browser's built-in recognition is Chrome/Safari-only (Arc and Brave ship
 * without Google's speech backend), so transcription happens server-side.
 */
export async function POST(request: Request) {
  const auth = await requireCoachEffectiveId(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const aiToken = process.env.CLOUDFLARE_WORKERS_AI_TOKEN;
  if (!accountId || !aiToken) {
    return NextResponse.json(
      {
        error:
          "Voice transcription isn't configured yet. Add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_WORKERS_AI_TOKEN.",
      },
      { status: 503 }
    );
  }

  let body: { audio_base64?: string };
  try {
    body = (await request.json()) as { audio_base64?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const audio = body.audio_base64?.trim();
  if (!audio) {
    return NextResponse.json(
      { error: "audio_base64 required" },
      { status: 400 }
    );
  }
  if (audio.length > MAX_AUDIO_BASE64_CHARS) {
    return NextResponse.json(
      { error: "That recording is too long — keep it under a few minutes." },
      { status: 413 }
    );
  }

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/openai/whisper-large-v3-turbo`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${aiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ audio }),
      }
    );
    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      result?: { text?: string };
      errors?: { code?: number; message?: string }[];
    };
    if (
      !res.ok ||
      data.success === false ||
      typeof data.result?.text !== "string"
    ) {
      console.error(
        "profit-coach-ai transcribe: Workers AI error",
        res.status,
        data.errors
      );
      return NextResponse.json(
        { error: "Transcription failed. Try again." },
        { status: 502 }
      );
    }
    return NextResponse.json({ text: data.result.text.trim() });
  } catch (err) {
    console.error("profit-coach-ai transcribe:", err);
    return NextResponse.json(
      { error: "Transcription failed. Try again." },
      { status: 502 }
    );
  }
}
