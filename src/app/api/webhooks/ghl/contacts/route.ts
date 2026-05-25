import { NextResponse } from "next/server";
import {
  getGhlContactWebhookSecret,
  parseGhlContactWebhookPayload,
  type GhlContactWebhookPayload,
} from "@/lib/ghlContactWebhook";
import { verifyGhlWebhookAuthorization } from "@/lib/ghlAppointmentWebhook";
import { resolveGhlContactLinks } from "@/lib/resolveGhlAppointmentLinks";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const webhookSecret = getGhlContactWebhookSecret();

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "ghl-contacts",
    configured: Boolean(webhookSecret),
  });
}

export async function POST(request: Request) {
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "GHL contact webhook is not configured." },
      { status: 500 }
    );
  }

  if (!verifyGhlWebhookAuthorization(request, webhookSecret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: GhlContactWebhookPayload;
  try {
    body = (await request.json()) as GhlContactWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = parseGhlContactWebhookPayload(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const links = await resolveGhlContactLinks({
    profitCoachContactId: parsed.profitCoachContactId,
    ghlLocationId: parsed.ghlLocationId,
    email: parsed.email,
  });

  if (links.matchStatus === "unmatched_coach") {
    console.warn(
      "ghl contact webhook unmatched coach:",
      parsed.ghlLocationId,
      parsed.email
    );
    return NextResponse.json({
      ok: false,
      match_status: links.matchStatus,
      crm_contact_id: parsed.crmContactId,
    });
  }

  if (links.matchStatus === "unmatched_contact") {
    console.warn(
      "ghl contact webhook unmatched contact:",
      links.coachId,
      parsed.profitCoachContactId,
      parsed.email
    );
    return NextResponse.json({
      ok: false,
      match_status: links.matchStatus,
      crm_contact_id: parsed.crmContactId,
    });
  }

  const { data, error } = await supabaseAdmin
    .from("contacts")
    .update({ crm_contact_id: parsed.crmContactId })
    .eq("id", links.contactId!)
    .select("id, crm_contact_id")
    .single();

  if (error) {
    if (error.code === "42703") {
      console.error("ghl contact webhook update failed: crm_contact_id column missing");
      return NextResponse.json(
        { ok: false, error: "crm_contact_id column is not migrated yet." },
        { status: 200 }
      );
    }

    console.error("ghl contact webhook update failed:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to update contact." },
      { status: 200 }
    );
  }

  return NextResponse.json({
    ok: true,
    contact_id: data.id,
    crm_contact_id: data.crm_contact_id,
    match_status: links.matchStatus,
  });
}
