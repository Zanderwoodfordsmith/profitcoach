import { NextResponse } from "next/server";
import {
  parseGhlAppointmentWebhookPayload,
  verifyGhlWebhookAuthorization,
  type GhlAppointmentWebhookPayload,
} from "@/lib/ghlAppointmentWebhook";
import { resolveGhlAppointmentLinks } from "@/lib/resolveGhlAppointmentLinks";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const webhookSecret = process.env.GHL_APPOINTMENT_WEBHOOK_SECRET ?? "";

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "ghl-appointments",
    configured: Boolean(webhookSecret),
  });
}

export async function POST(request: Request) {
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "GHL appointment webhook is not configured." },
      { status: 500 }
    );
  }

  if (!verifyGhlWebhookAuthorization(request, webhookSecret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: GhlAppointmentWebhookPayload;
  try {
    body = (await request.json()) as GhlAppointmentWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = parseGhlAppointmentWebhookPayload(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const links = await resolveGhlAppointmentLinks({
    ghlLocationId: parsed.ghlLocationId,
    ghlCalendarId: parsed.ghlCalendarId,
    prospectEmail: parsed.prospectEmail,
  });

  if (links.matchStatus === "unmatched_coach") {
    console.warn(
      "ghl webhook unmatched coach:",
      parsed.ghlLocationId,
      parsed.ghlCalendarId
    );
  } else if (links.matchStatus === "unmatched_contact") {
    console.warn(
      "ghl webhook unmatched contact:",
      links.coachId,
      parsed.prospectEmail
    );
  }

  const row = {
    ghl_appointment_id: parsed.ghlAppointmentId,
    ghl_location_id: parsed.ghlLocationId,
    ghl_calendar_id: parsed.ghlCalendarId,
    coach_id: links.coachId,
    contact_id: links.contactId,
    assessment_id: links.assessmentId,
    prospect_email: parsed.prospectEmail,
    prospect_phone: parsed.prospectPhone,
    prospect_name: parsed.prospectName,
    calendar_name: parsed.calendarName,
    title: parsed.title,
    status_raw: parsed.statusRaw,
    status_normalized: parsed.statusNormalized,
    start_time: parsed.startTime,
    end_time: parsed.endTime,
    timezone: parsed.timezone,
    notes: parsed.notes,
    address: parsed.address,
    match_status: links.matchStatus,
    raw_payload: body,
    webhook_received_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("ghl_appointments")
    .upsert(row, { onConflict: "ghl_appointment_id" })
    .select("id, ghl_appointment_id, match_status, status_normalized")
    .single();

  if (error) {
    console.error("ghl webhook upsert failed:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to persist appointment." },
      { status: 200 }
    );
  }

  return NextResponse.json({
    ok: true,
    id: data.id,
    ghl_appointment_id: data.ghl_appointment_id,
    match_status: data.match_status,
    status_normalized: data.status_normalized,
  });
}
