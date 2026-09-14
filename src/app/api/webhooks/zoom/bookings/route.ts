import { NextResponse } from "next/server";
import { attachZoomRecordingToBooking } from "@/lib/booking/zoomBookingRecording";
import {
  buildZoomUrlValidationResponse,
  parseZoomBookingRecordingPayload,
  verifyZoomWebhookSignature,
  type ZoomWebhookEnvelope,
} from "@/lib/zoomWebhook";

function webhookSecret(): string {
  return (
    process.env.ZOOM_OAUTH_WEBHOOK_SECRET_TOKEN?.trim() ||
    process.env.ZOOM_WEBHOOK_SECRET_TOKEN?.trim() ||
    ""
  );
}

const RECORDING_EVENTS = new Set([
  "recording.completed",
  "recording.transcript_completed",
]);

export async function GET() {
  const secret = webhookSecret();
  return NextResponse.json({
    ok: true,
    endpoint: "zoom-booking-recordings",
    configured: Boolean(secret),
  });
}

export async function POST(request: Request) {
  const secret = webhookSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "Zoom booking recording webhook is not configured." },
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

  if (body.event === "endpoint.url_validation") {
    const plainToken = body.payload?.plainToken?.trim();
    if (!plainToken) {
      return NextResponse.json(
        { error: "Missing plainToken for URL validation." },
        { status: 400 }
      );
    }
    return NextResponse.json(buildZoomUrlValidationResponse(plainToken, secret));
  }

  const timestamp = request.headers.get("x-zm-request-timestamp");
  const signature = request.headers.get("x-zm-signature");
  if (!verifyZoomWebhookSignature(rawBody, timestamp, signature, secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const ts = timestamp ? Number(timestamp) : NaN;
  if (Number.isFinite(ts)) {
    const skew = Math.abs(Date.now() / 1000 - ts);
    if (skew > 5 * 60) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  if (!RECORDING_EVENTS.has(body.event ?? "")) {
    return NextResponse.json({
      ok: true,
      ignored: true,
      event: body.event ?? null,
    });
  }

  const parsed = parseZoomBookingRecordingPayload(body);
  if ("error" in parsed) {
    console.warn("zoom booking recording parse error:", parsed.error);
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  const downloadToken =
    typeof body.download_token === "string" ? body.download_token : null;
  const result = await attachZoomRecordingToBooking({
    recording: parsed,
    downloadToken,
  });

  return NextResponse.json({
    ok: result.ok,
    booking_id: result.bookingId,
    reason: result.reason,
  });
}
