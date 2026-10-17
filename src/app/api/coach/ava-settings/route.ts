import { NextResponse } from "next/server";
import { getAlertsWhatsAppAccount } from "@/lib/ava/alertsWhatsApp";
import { getAvaSettings, isAutopilotGloballyOn, saveCoachAvaSettings } from "@/lib/ava/settings";
import { isWebPushConfigured } from "@/lib/push/webPush";
import { requireShareCoach } from "@/lib/shareLinks/requireShareCoach";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/** The coach's Ava reply settings plus what's needed to show alert status. */
export async function GET(request: Request) {
  const auth = await requireShareCoach(request);
  if (auth.error || !auth.coachId) return NextResponse.json({ error: auth.error }, { status: 401 });
  const [settings, globalOn, wa, { data: profile }] = await Promise.all([
    getAvaSettings(auth.coachId),
    isAutopilotGloballyOn(),
    getAlertsWhatsAppAccount(),
    supabaseAdmin.from("profiles").select("phone").eq("id", auth.coachId).maybeSingle(),
  ]);
  return NextResponse.json({
    settings,
    autopilotAvailable: globalOn && settings.autopilot_allowed,
    whatsappReady: Boolean(wa && wa.status === "OK"),
    hasPhone: Boolean((profile?.phone as string | null)?.trim()),
    pushKey: isWebPushConfigured() ? process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY?.trim() ?? null : null,
  });
}

export async function PATCH(request: Request) {
  const auth = await requireShareCoach(request);
  if (auth.error || !auth.coachId) return NextResponse.json({ error: auth.error }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Parameters<typeof saveCoachAvaSettings>[1] = {};
  if (body.reply_mode === "off" || body.reply_mode === "copilot" || body.reply_mode === "autopilot") patch.reply_mode = body.reply_mode;
  for (const key of ["notify_push", "notify_whatsapp", "notify_email"] as const) {
    if (typeof body[key] === "boolean") patch[key] = body[key] as boolean;
  }
  for (const key of ["quiet_start", "quiet_end"] as const) {
    const v = Number(body[key]);
    if (body[key] !== undefined && Number.isInteger(v) && v >= 0 && v <= 23) patch[key] = v;
  }
  if (patch.reply_mode === "autopilot" && !(await isAutopilotGloballyOn())) {
    return NextResponse.json({ error: "Autopilot isn't available yet." }, { status: 400 });
  }
  try {
    const settings = await saveCoachAvaSettings(auth.coachId, patch);
    return NextResponse.json({ settings });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not save." }, { status: 400 });
  }
}
