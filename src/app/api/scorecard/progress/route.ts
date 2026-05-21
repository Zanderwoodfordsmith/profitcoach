import { NextResponse } from "next/server";
import {
  fireLeadWebhook,
  getCoachLeadWebhookUrl,
  resolveLeadWebhookStatus,
} from "@/lib/leadWebhook";
import { splitFullName } from "@/lib/splitFullName";
import { resolvePrimaryCoachSlug } from "@/lib/primaryCoach";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Body = {
  coachSlug?: string | null;
  contact?: {
    email?: string;
    full_name?: string;
    phone?: string;
  };
  screen: number;
  abandoned?: boolean;
};

export async function POST(request: Request) {
  const body = (await request.json()) as Body;

  const screen =
    typeof body.screen === "number" && body.screen >= 1 && body.screen <= 16
      ? Math.floor(body.screen)
      : null;

  if (screen == null) {
    return NextResponse.json({ error: "Invalid screen" }, { status: 400 });
  }

  const primarySlug = await resolvePrimaryCoachSlug();
  let coachSlug =
    typeof body.coachSlug === "string" && body.coachSlug.trim()
      ? body.coachSlug.trim().toLowerCase()
      : primarySlug;

  if (coachSlug === "bca") coachSlug = primarySlug;

  let { data: coach } = await supabaseAdmin
    .from("coaches")
    .select("id")
    .eq("slug", coachSlug)
    .maybeSingle();

  if (!coach?.id && coachSlug !== primarySlug) {
    const fallback = await supabaseAdmin
      .from("coaches")
      .select("id")
      .eq("slug", primarySlug)
      .maybeSingle();
    coach = fallback.data;
    if (coach?.id) coachSlug = primarySlug;
  }

  if (!coach?.id) {
    return NextResponse.json({ ok: true });
  }

  const coachId = coach.id as string;
  const email = body.contact?.email?.trim().toLowerCase() || null;
  const fullName = body.contact?.full_name?.trim() || null;
  const phone = body.contact?.phone?.trim() || null;

  let contactId: string | null = null;
  if (email) {
    const { data: existing } = await supabaseAdmin
      .from("contacts")
      .select("id")
      .eq("coach_id", coachId)
      .eq("email", email)
      .maybeSingle();
    contactId = (existing?.id as string) ?? null;
  }

  const webhookUrl = await getCoachLeadWebhookUrl(coachId);
  if (webhookUrl && body.abandoned) {
    const { first_name, last_name } = splitFullName(fullName ?? "");
    const event = "scorecard_abandoned" as const;
    void fireLeadWebhook(webhookUrl, {
      event,
      status: resolveLeadWebhookStatus(event),
      coach_slug: coachSlug,
      coach_id: coachId,
      contact: {
        contact_id: contactId,
        full_name: fullName,
        first_name,
        last_name,
        email,
        phone,
        business_name: null,
      },
      assessment_type: "boss_scorecard",
      last_screen_reached: screen,
      abandonment_tag: `BOSS Scorecard Abandoned — Screen ${screen}`,
      fired_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({ ok: true, screen });
}
