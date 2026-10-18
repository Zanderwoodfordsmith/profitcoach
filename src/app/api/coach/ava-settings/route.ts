import { NextResponse } from "next/server";
import { getAlertsWhatsAppAccount, whatsappIdForPhone } from "@/lib/ava/alertsWhatsApp";
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
    phone: ((profile?.phone as string | null) ?? "").trim(),
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
  // The coach's own mobile, for WhatsApp alerts (there was nowhere else to set it).
  let phone: string | null | undefined;
  if (typeof body.phone === "string") {
    const raw = body.phone.trim();
    if (!raw) phone = null;
    else {
      const digits = whatsappIdForPhone(raw);
      if (!digits) {
        return NextResponse.json(
          { error: "That doesn't look like a mobile number. Include the country code, e.g. +44 7700 900123." },
          { status: 400 }
        );
      }
      phone = `+${digits}`;
    }
    const { error } = await supabaseAdmin.from("profiles").update({ phone }).eq("id", auth.coachId);
    if (error) return NextResponse.json({ error: "Could not save your number." }, { status: 500 });
  }
  if (patch.reply_mode === "autopilot" && !(await isAutopilotGloballyOn())) {
    return NextResponse.json({ error: "Autopilot isn't available yet." }, { status: 400 });
  }
  try {
    const settings = Object.keys(patch).length
      ? await saveCoachAvaSettings(auth.coachId, patch)
      : await getAvaSettings(auth.coachId);
    return NextResponse.json(phone === undefined ? { settings } : { settings, phone: phone ?? "" });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not save." }, { status: 400 });
  }
}
