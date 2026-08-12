import { NextResponse } from "next/server";
import { verifyBirdWebhookSignature } from "@/lib/bird/client";
import { ingestBirdInboundMessage } from "@/lib/messaging/ingestInboundEmail";

export const maxDuration = 60;

/**
 * Bird Standard Webhooks endpoint.
 * Subscribe to email.received (and optionally others).
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const secret = process.env.BIRD_WEBHOOK_SECRET?.trim() || "";

  if (secret) {
    const ok = verifyBirdWebhookSignature({
      rawBody,
      webhookId: request.headers.get("webhook-id"),
      webhookTimestamp: request.headers.get("webhook-timestamp"),
      webhookSignature: request.headers.get("webhook-signature"),
      secret,
    });
    if (!ok) {
      return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "BIRD_WEBHOOK_SECRET is not configured." },
      { status: 503 }
    );
  }

  let event: { type?: string; data?: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody) as typeof event;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (event.type === "email.received") {
    const inboundId =
      (typeof event.data?.inbound_message_id === "string" &&
        event.data.inbound_message_id) ||
      (typeof event.data?.id === "string" && event.data.id) ||
      null;
    if (inboundId) {
      // Respond quickly; ingest is usually fast but keep webhook happy.
      void ingestBirdInboundMessage(inboundId).catch((err) =>
        console.error("bird inbound ingest:", err)
      );
    }
  }

  return NextResponse.json({ ok: true });
}
