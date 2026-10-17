import { NextResponse } from "next/server";
import { createAlertsWhatsAppConnectLink, getAlertsWhatsAppAccount } from "@/lib/ava/alertsWhatsApp";
import { isAutopilotGloballyOn, setAutopilotAllowed, setAutopilotGlobal } from "@/lib/ava/settings";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/** Admin: global autopilot switch, per-coach allow, BCA alerts WhatsApp status. */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });
  const [globalOn, wa, { data: settings }, { data: coaches }, { data: recent }] = await Promise.all([
    isAutopilotGloballyOn(),
    getAlertsWhatsAppAccount(),
    supabaseAdmin.from("coach_ava_settings").select("coach_id, reply_mode, autopilot_allowed, autopilot_min_confidence"),
    supabaseAdmin.from("coaches").select("id, slug, membership_status").in("membership_status", ["active", "trialing", "past_due"]),
    supabaseAdmin
      .from("ava_reply_triage")
      .select("coach_id, status, created_at")
      .in("status", ["autopilot_scheduled", "autopilot_sent", "autopilot_cancelled"])
      .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),
  ]);
  const ids = (coaches ?? []).map((c) => c.id as string);
  const { data: profiles } = ids.length
    ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] };
  const name = new Map((profiles ?? []).map((p) => [p.id as string, (p.full_name as string) || ""]));
  const byCoach = new Map((settings ?? []).map((s) => [s.coach_id as string, s]));
  const sends = new Map<string, number>();
  for (const r of recent ?? []) sends.set(r.coach_id as string, (sends.get(r.coach_id as string) ?? 0) + 1);
  return NextResponse.json({
    globalOn,
    whatsapp: wa ? { status: wa.status, name: wa.display_name } : null,
    coaches: (coaches ?? [])
      .map((c) => {
        const s = byCoach.get(c.id as string);
        return {
          coach_id: c.id,
          name: name.get(c.id as string) || (c.slug as string),
          reply_mode: (s?.reply_mode as string) ?? "copilot",
          autopilot_allowed: Boolean(s?.autopilot_allowed),
          min_confidence: Number(s?.autopilot_min_confidence ?? 0.85),
          autopilot_last_30_days: sends.get(c.id as string) ?? 0,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
  });
}

/** Body: { global: boolean } | { coach_id, allowed, min_confidence? } | { connect_whatsapp: true }. */
export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.userId) return NextResponse.json({ error: auth.error }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    if (typeof body.global === "boolean") {
      await setAutopilotGlobal(body.global);
      return NextResponse.json({ ok: true });
    }
    if (body.connect_whatsapp === true) {
      const link = await createAlertsWhatsAppConnectLink(auth.userId, getAppBaseUrl(request));
      return NextResponse.json({ ok: true, url: link.url });
    }
    const coachId = typeof body.coach_id === "string" ? body.coach_id : "";
    if (/^[0-9a-f-]{36}$/i.test(coachId) && typeof body.allowed === "boolean") {
      const min = body.min_confidence === undefined ? undefined : Number(body.min_confidence);
      const settings = await setAutopilotAllowed(coachId, body.allowed, min);
      return NextResponse.json({ ok: true, settings });
    }
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not save." }, { status: 500 });
  }
}
