import { NextResponse } from "next/server";

import { getAlertsWhatsAppAccount } from "@/lib/ava/alertsWhatsApp";
import { getAvaSettings } from "@/lib/ava/settings";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeUnipileProvider } from "@/lib/unipile/providers";

export const runtime = "nodejs";

/** What the Blueprint Overview checklist can't see from the Blueprint itself. */
export type ChecklistFacts = {
  linkedin: boolean;
  email: boolean;
  /** A phone has the app on its home screen (alerts on iPhone need it, so a phone subscription counts). */
  phone_app: boolean;
  /** Ava will tell them about replies: by phone alert or WhatsApp. */
  alerts: boolean;
  /** When BCA wrote their new LinkedIn profile, or null until then. */
  linkedin_draft_at: string | null;
  /** When the new profile went on LinkedIn (the Getting live tick), or null. */
  linkedin_updated_at: string | null;
  /** People on the coach's prospect lists. */
  prospects: number;
  /** When the coach said the prospect list looks right, or null. */
  prospects_reviewed_at: string | null;
  /** A campaign is sending. */
  campaign_live: boolean;
};

/** Steps the coach ticks themselves, stored as Getting live ticks. */
const HAND_STEPS = ["linkedin_updated", "prospects_reviewed"] as const;
type HandStep = (typeof HAND_STEPS)[number];

async function auth(request: Request) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return { error: NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 }) };
  }
  return { coachId: check.userId, callerId: check.callerId };
}

const MAIL = new Set(["GOOGLE", "OUTLOOK", "MAIL"]);

export async function GET(request: Request) {
  const a = await auth(request);
  if ("error" in a) return a.error;
  const id = a.coachId;
  const [accounts, subs, settings, wa, profile, draft, live, prospects, running] = await Promise.all([
    supabaseAdmin.from("linkedin_outreach_accounts").select("provider, status").eq("coach_id", id),
    supabaseAdmin.from("web_push_subscriptions").select("user_agent").eq("user_id", id),
    getAvaSettings(id),
    getAlertsWhatsAppAccount(),
    supabaseAdmin.from("profiles").select("phone").eq("id", id).maybeSingle(),
    supabaseAdmin.from("coach_linkedin_profiles").select("optimizer_rewritten_at").eq("coach_id", id).maybeSingle(),
    supabaseAdmin.from("coach_getting_live").select("ticks").eq("coach_id", id).maybeSingle(),
    supabaseAdmin.from("coach_lead_list_items").select("id", { count: "exact", head: true }).eq("coach_id", id),
    supabaseAdmin.from("linkedin_campaigns").select("id", { count: "exact", head: true }).eq("coach_id", id).eq("status", "running"),
  ]);

  const ok = (accounts.data ?? [])
    .filter((row) => String(row.status ?? "").toUpperCase() === "OK")
    .map((row) => normalizeUnipileProvider(row.provider as string));
  const agents = (subs.data ?? []).map((row) => String(row.user_agent ?? ""));
  const onPhone = agents.some((ua) => /iPhone|iPad|iPod|Android/.test(ua));
  const hasPhone = Boolean(String(profile.data?.phone ?? "").trim());
  const alerts =
    settings.reply_mode !== "off" &&
    ((settings.notify_push && agents.length > 0) || (settings.notify_whatsapp && hasPhone && wa?.status === "OK"));
  const ticks = (live.data?.ticks ?? {}) as Record<string, { at?: string } | undefined>;

  const facts: ChecklistFacts = {
    linkedin: ok.includes("LINKEDIN"),
    email: ok.some((p) => MAIL.has(p)),
    phone_app: onPhone,
    alerts,
    linkedin_draft_at: (draft.data?.optimizer_rewritten_at as string | null) ?? null,
    linkedin_updated_at: ticks.linkedin_updated?.at ?? null,
    prospects: prospects.count ?? 0,
    prospects_reviewed_at: ticks.prospects_reviewed?.at ?? null,
    campaign_live: (running.count ?? 0) > 0,
  };
  return NextResponse.json(facts);
}

/** The coach ticks a step the app can't see (new profile up, prospect list looks right). */
export async function POST(request: Request) {
  const a = await auth(request);
  if ("error" in a) return a.error;
  const body = (await request.json().catch(() => ({}))) as { step?: string; done?: boolean };
  const step = HAND_STEPS.find((s) => s === body.step) as HandStep | undefined;
  if (!step) return NextResponse.json({ error: "Unknown step." }, { status: 400 });

  const { data: existing, error: readError } = await supabaseAdmin
    .from("coach_getting_live")
    .select("ticks")
    .eq("coach_id", a.coachId)
    .maybeSingle();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  const ticks = { ...((existing?.ticks ?? {}) as Record<string, unknown>) };
  const at = new Date().toISOString();
  if (body.done === false) delete ticks[step];
  else ticks[step] = { at, by: a.callerId };

  const { error } = await supabaseAdmin
    .from("coach_getting_live")
    .upsert({ coach_id: a.coachId, ticks, updated_at: at, updated_by: a.callerId }, { onConflict: "coach_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ at: body.done === false ? null : at });
}
