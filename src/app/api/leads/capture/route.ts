import { NextResponse } from "next/server";
import { fireLeadWebhook, getCoachLeadWebhookUrl } from "@/lib/leadWebhook";
import { splitFullName } from "@/lib/splitFullName";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const CENTRAL_SLUG_LOWER = "bca";

type Body = {
  coachSlug?: string | null;
  contact: {
    full_name?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    business_name?: string;
  };
};

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
      : CENTRAL_SLUG_LOWER;

  const { data: coach } = await supabaseAdmin
    .from("coaches")
    .select("id, slug")
    .eq("slug", coachSlug)
    .maybeSingle();

  if (!coach) {
    // Don't 4xx the public funnel — central provisioning happens on the
    // assessment-complete path. Just skip silently here.
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

  // Upsert by (coach_id, email). Older contact rows stay the source of truth
  // when an assessment eventually fires — same row gets updated.
  const { data: existing } = await supabaseAdmin
    .from("contacts")
    .select("id, full_name, phone, business_name")
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
    if (phone && !existing.phone) patch.phone = phone;
    if (businessName && !existing.business_name) patch.business_name = businessName;
    if (Object.keys(patch).length > 0) {
      await supabaseAdmin.from("contacts").update(patch).eq("id", contactId);
    }
  } else {
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("contacts")
      .insert({
        coach_id: coachId,
        type: "prospect",
        full_name: fullName ?? "Unknown",
        email,
        business_name: businessName,
        phone,
      })
      .select("id")
      .single();
    if (!insertError && inserted) {
      contactId = inserted.id as string;
    }
  }

  const webhookUrl = await getCoachLeadWebhookUrl(coachId);
  if (webhookUrl) {
    void fireLeadWebhook(webhookUrl, {
      event: "lead_captured",
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
