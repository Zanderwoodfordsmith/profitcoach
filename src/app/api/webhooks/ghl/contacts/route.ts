import { NextResponse } from "next/server";
import {
  createProspectFromGhlContact,
  getGhlContactWebhookSecret,
  linkProspectCrmContactId,
  parseGhlContactWebhookPayload,
  type GhlContactWebhookPayload,
} from "@/lib/ghlContactWebhook";
import { verifyGhlWebhookAuthorization } from "@/lib/ghlAppointmentWebhook";
import { resolveGhlContactLinks } from "@/lib/resolveGhlAppointmentLinks";

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
    crmContactId: parsed.crmContactId,
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
    if (parsed.profitCoachContactId) {
      console.warn(
        "ghl contact webhook profit coach id not found:",
        parsed.profitCoachContactId
      );
      return NextResponse.json({
        ok: false,
        match_status: links.matchStatus,
        crm_contact_id: parsed.crmContactId,
      });
    }

    if (!links.coachId) {
      return NextResponse.json({
        ok: false,
        match_status: "unmatched_coach",
        crm_contact_id: parsed.crmContactId,
      });
    }

    const created = await createProspectFromGhlContact({
      coachId: links.coachId,
      parsed,
    });

    if ("error" in created) {
      console.warn(
        "ghl contact webhook create prospect failed:",
        links.coachId,
        parsed.email,
        created.error
      );
      return NextResponse.json({
        ok: false,
        match_status: "unmatched_contact",
        crm_contact_id: parsed.crmContactId,
        error: created.error,
      });
    }

    return NextResponse.json({
      ok: true,
      contact_id: created.contactId,
      crm_contact_id: parsed.crmContactId,
      match_status: "created",
      created: true,
    });
  }

  const linked = await linkProspectCrmContactId(links.contactId!, parsed.crmContactId);
  if ("error" in linked) {
    if (linked.error === "crm_contact_id column is not migrated yet.") {
      console.error("ghl contact webhook update failed: crm_contact_id column missing");
    } else {
      console.error("ghl contact webhook update failed:", linked.error);
    }
    return NextResponse.json(
      { ok: false, error: linked.error, match_status: links.matchStatus },
      { status: 200 }
    );
  }

  return NextResponse.json({
    ok: true,
    contact_id: linked.contactId,
    crm_contact_id: linked.crm_contact_id,
    match_status: links.matchStatus,
    created: false,
  });
}
