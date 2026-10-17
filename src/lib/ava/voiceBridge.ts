import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { runIntakeTurn } from "@/lib/practiceKnowledge/runIntakeTurn";
import {
  bridgeExtra,
  latestUserText,
  type BridgeExtra,
  type BridgeMessage,
} from "@/lib/ava/voiceBridgeParse";

export const maxDuration = 60;

/**
 * OpenAI-compatible bridge for Ava's ElevenLabs agent. ElevenLabs speaks.
 * This runs the intake call (or the follow-up) and streams the spoken line back.
 *
 * ElevenLabs authenticates with AVA_BRIDGE_SECRET (the custom LLM API key).
 * The coach is the Supabase access token in customLlmExtraBody (`ava_auth`).
 * Admins also pass `ava_coach_id` for the coach they are previewing.
 */

type BridgeBody = BridgeExtra & {
  messages?: BridgeMessage[];
  stream?: boolean;
  elevenlabs_extra_body?: BridgeExtra;
};

function sse(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function completion(text: string, stream: boolean): Response {
  const id = `chatcmpl-${crypto.randomUUID()}`;
  const created = Math.floor(Date.now() / 1000);
  const model = "ava-intake";

  if (!stream) {
    return Response.json({
      id,
      object: "chat.completion",
      created,
      model,
      choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
    });
  }

  const encoder = new TextEncoder();
  const streamBody = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          sse({
            id,
            object: "chat.completion.chunk",
            created,
            model,
            choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
          })
        )
      );
      controller.enqueue(
        encoder.encode(
          sse({
            id,
            object: "chat.completion.chunk",
            created,
            model,
            choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
          })
        )
      );
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(streamBody, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

async function coachForToken(token: string, requestedCoachId: string | null): Promise<string | null> {
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "coach" && profile?.role !== "admin") return null;
  if (profile.role === "admin") {
    const requested = requestedCoachId?.trim();
    return requested || user.id;
  }
  return user.id;
}

export async function POST(request: Request) {
  const secret = process.env.AVA_BRIDGE_SECRET?.trim();
  const header = request.headers.get("authorization") ?? "";
  if (!secret || header !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as BridgeBody | null;
  const extra = bridgeExtra(body);
  if (!extra.ava_auth) {
    return Response.json({ error: "Missing coach token." }, { status: 401 });
  }

  const coachId = await coachForToken(extra.ava_auth, extra.ava_coach_id ?? null);
  if (!coachId) {
    return Response.json({ error: "Invalid coach token." }, { status: 401 });
  }

  const userText = latestUserText(body?.messages);
  let spoken = "I missed that. Say it once more.";
  try {
    const result = await runIntakeTurn({
      coachId,
      message: userText,
      start: !userText,
      medium: "voice",
    });
    if (result.ok) spoken = result.assistant_message;
    else if (result.status === 429) {
      spoken = "We've covered a lot for one call. The next step is to book the call with Pam.";
    }
  } catch (err) {
    console.error("ava voice bridge:", err instanceof Error ? err.message : "failed");
  }

  return completion(spoken, body?.stream !== false);
}
