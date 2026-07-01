import { NextResponse } from "next/server";

import { attachZoomRecordingToCommunityCalendar } from "@/lib/zoomRecordingCalendarSync";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildZoomUrlValidationResponse,
  parseZoomRecordingCompletedPayload,
  verifyZoomWebhookSignature,
  type ZoomWebhookEnvelope,
} from "@/lib/zoomWebhook";

const webhookSecret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN ?? "";
const expectedAccountId = process.env.ZOOM_ACCOUNT_ID?.trim() ?? "";

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "zoom-recordings",
    configured: Boolean(webhookSecret),
    accountFilter: Boolean(expectedAccountId),
  });
}

export async function POST(request: Request) {
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Zoom recording webhook is not configured." },
      { status: 500 }
    );
  }

  const rawBody = await request.text();

  let body: ZoomWebhookEnvelope;
  try {
    body = JSON.parse(rawBody) as ZoomWebhookEnvelope;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  // Zoom URL validation must be answered before signature checks (see Zoom docs).
  if (body.event === "endpoint.url_validation") {
    const plainToken = body.payload?.plainToken?.trim();
    if (!plainToken) {
      return NextResponse.json(
        { error: "Missing plainToken for URL validation." },
        { status: 400 }
      );
    }
    return NextResponse.json(
      buildZoomUrlValidationResponse(plainToken, webhookSecret)
    );
  }

  const timestamp = request.headers.get("x-zm-request-timestamp");
  const signature = request.headers.get("x-zm-signature");

  if (!verifyZoomWebhookSignature(rawBody, timestamp, signature, webhookSecret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (body.event !== "recording.completed") {
    return NextResponse.json({
      ok: true,
      ignored: true,
      event: body.event ?? null,
    });
  }

  const parsed = parseZoomRecordingCompletedPayload(body);
  if ("error" in parsed) {
    console.warn("zoom recording webhook parse error:", parsed.error);
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  if (expectedAccountId && parsed.accountId !== expectedAccountId) {
    console.warn(
      "zoom recording webhook ignored account:",
      parsed.accountId,
      "expected:",
      expectedAccountId
    );
    return NextResponse.json({
      ok: true,
      ignored: true,
      reason: "account_mismatch",
    });
  }

  try {
    const result = await attachZoomRecordingToCommunityCalendar(
      supabaseAdmin,
      parsed
    );

    if (result.status === "unmatched" || result.status === "ambiguous") {
      console.warn("zoom recording webhook match:", result.status, {
        topic: parsed.topic,
        startTimeIso: parsed.startTimeIso,
        meetingId: parsed.meetingId,
        reason: result.reason,
      });
    } else {
      console.info("zoom recording webhook match:", result.status, {
        eventId: result.eventId,
        eventTitle: result.eventTitle,
        occurrenceStartIso: result.occurrenceStartIso,
      });
    }

    return NextResponse.json({
      ok: true,
      match_status: result.status,
      event_id: result.eventId ?? null,
      occurrence_start: result.occurrenceStartIso ?? null,
      event_title: result.eventTitle ?? null,
      reason: result.reason ?? null,
    });
  } catch (error) {
    console.error("zoom recording webhook attach failed:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to attach recording to calendar." },
      { status: 500 }
    );
  }
}
