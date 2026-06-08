import { NextResponse } from "next/server";
import {
  tryInsertContactStripping,
  tryUpdateContactStripping,
} from "@/lib/contactSchemaSafeInsert";
import {
  fireLeadWebhook,
  getCoachLeadWebhookUrl,
  resolveLeadWebhookStatus,
  type AssessmentType,
} from "@/lib/leadWebhook";
import { splitFullName } from "@/lib/splitFullName";
import {
  ensurePrimaryCoachRow,
  resolvePrimaryCoachSlug,
} from "@/lib/primaryCoach";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Body = {
  coachSlug?: string | null;
  assessment_type?: AssessmentType;
  contact: {
    full_name?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    business_name?: string;
  };
};

function normalizeProspectFunnel(
  raw: unknown
): AssessmentType | null {
  return raw === "boss_scorecard" || raw === "diagnostic_50" ? raw : null;
}

/**
 * Captures a partial lead (email is the only hard requirement) and fires the
 * coach's configured lead webhook. Idempotent per (coach, email): repeat calls
 * upsert the contact and re-fire the webhook so coaches see incremental info
 * (e.g. phone added later) — downstream automations should dedupe by
 * contact_id.
 *
 * This endpoint never blocks the prospect funnel: webhook failures are
 * swallowed so a misconfigured URL cannot break landing/assessment flows.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.contact?.email?.trim().toLowerCase() || null;
  if (!email) {
    return NextResponse.json(
      { ok: false, skipped: "missing_email" },
      { status: 200 }
    );
  }

  const coachSlug =
    typeof body.coachSlug === "string" && body.coachSlug.trim()
      ? body.coachSlug.trim().toLowerCase()
      : await resolvePrimaryCoachSlug();

  let { data: coach } = await supabaseAdmin
    .from("coaches")
    .select("id, slug")
    .eq("slug", coachSlug)
    .maybeSingle();

  if (!coach) {
    const primarySlug = await resolvePrimaryCoachSlug();
    if (coachSlug === primarySlug) {
      const ensured = await ensurePrimaryCoachRow();
      if (ensured) {
        const { data: refetched } = await supabaseAdmin
          .from("coaches")
          .select("id, slug")
          .eq("id", ensured.id)
          .maybeSingle();
        coach = refetched;
      }
    }
  }

  if (!coach) {
    return NextResponse.json(
      { ok: false, skipped: "coach_not_found" },
      { status: 200 }
    );
  }

  const coachId = coach.id as string;

  const fullNameRaw = body.contact?.full_name?.trim() || "";
  const firstNameRaw = body.contact?.first_name?.trim() || "";
  const lastNameRaw = body.contact?.last_name?.trim() || "";

  let firstName = firstNameRaw || null;
  let lastName = lastNameRaw || null;
  let fullName = fullNameRaw || null;

  if (!fullName && (firstName || lastName)) {
    fullName = [firstName, lastName].filter(Boolean).join(" ").trim() || null;
  }
  if (fullName && !firstName && !lastName) {
    const split = splitFullName(fullName);
    firstName = split.first_name;
    lastName = split.last_name;
  }

  const phone = body.contact?.phone?.trim() || null;
  const businessName = body.contact?.business_name?.trim() || null;
  const prospectFunnel = normalizeProspectFunnel(body.assessment_type);

  // Upsert by (coach_id, email). Older contact rows stay the source of truth
  // when an assessment eventually fires — same row gets updated.
  // Select only columns we know exist on every deployment; phone is optional.
  const { data: existing } = await supabaseAdmin
    .from("contacts")
    .select("id, full_name, business_name")
    .eq("coach_id", coachId)
    .eq("email", email)
    .maybeSingle();

  let contactId: string | null = null;

  if (existing?.id) {
    contactId = existing.id as string;
    // Only patch fields that the prospect has now provided — never blank out
    // data we already had.
    const patch: Record<string, unknown> = {};
    if (fullName && (existing.full_name == null || existing.full_name === "Unknown")) {
      patch.full_name = fullName;
    }
    if (phone) patch.phone = phone;
    if (businessName && !existing.business_name) patch.business_name = businessName;
    if (prospectFunnel) patch.prospect_funnel = prospectFunnel;
    if (Object.keys(patch).length > 0) {
      await tryUpdateContactStripping(contactId, patch);
    }
  } else {
    const insertPayload: Record<string, unknown> = {
      coach_id: coachId,
      type: "prospect",
      full_name: fullName ?? "Unknown",
      email,
      business_name: businessName,
      phone,
    };
    if (prospectFunnel) insertPayload.prospect_funnel = prospectFunnel;
    if (firstName) insertPayload.first_name = firstName;
    if (lastName) insertPayload.last_name = lastName;
    const { data: inserted } = await tryInsertContactStripping(insertPayload);
    if (inserted?.id) {
      contactId = inserted.id as string;
    }
  }

  const webhookUrl = await getCoachLeadWebhookUrl(coachId);
  if (webhookUrl) {
    const event = "lead_captured" as const;
    void fireLeadWebhook(webhookUrl, {
      event,
      status: resolveLeadWebhookStatus(event, { hasPhone: !!phone }),
      coach_slug: (coach as { slug?: string | null }).slug ?? coachSlug,
      coach_id: coachId,
      contact: {
        contact_id: contactId,
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        business_name: businessName,
      },
      source: "prospect_link",
      fired_at: new Date().toISOString(),
    });
  }

  return NextResponse.json(
    { ok: true, contact_id: contactId },
    { status: 200 }
  );
}
