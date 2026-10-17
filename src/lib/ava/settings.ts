import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ReplyMode = "off" | "copilot" | "autopilot";

export type AvaSettings = {
  coach_id: string;
  reply_mode: ReplyMode;
  autopilot_allowed: boolean;
  autopilot_min_confidence: number;
  notify_push: boolean;
  notify_whatsapp: boolean;
  notify_email: boolean;
  quiet_start: number;
  quiet_end: number;
};

export const DEFAULT_AVA_SETTINGS: Omit<AvaSettings, "coach_id"> = {
  reply_mode: "copilot",
  autopilot_allowed: false,
  autopilot_min_confidence: 0.85,
  notify_push: true,
  notify_whatsapp: true,
  notify_email: false,
  quiet_start: 21,
  quiet_end: 7,
};

export async function getAvaSettings(coachId: string): Promise<AvaSettings> {
  const { data } = await supabaseAdmin.from("coach_ava_settings").select("*").eq("coach_id", coachId).maybeSingle();
  if (!data) return { coach_id: coachId, ...DEFAULT_AVA_SETTINGS };
  return {
    coach_id: coachId,
    reply_mode: (["off", "copilot", "autopilot"].includes(data.reply_mode as string) ? data.reply_mode : "copilot") as ReplyMode,
    autopilot_allowed: Boolean(data.autopilot_allowed),
    autopilot_min_confidence: Number(data.autopilot_min_confidence ?? 0.85),
    notify_push: data.notify_push !== false,
    notify_whatsapp: data.notify_whatsapp !== false,
    notify_email: Boolean(data.notify_email),
    quiet_start: Number(data.quiet_start ?? 21),
    quiet_end: Number(data.quiet_end ?? 7),
  };
}

/** Coach-editable fields only. Autopilot can only be chosen once BCA has allowed it. */
export async function saveCoachAvaSettings(
  coachId: string,
  patch: Partial<Pick<AvaSettings, "reply_mode" | "notify_push" | "notify_whatsapp" | "notify_email" | "quiet_start" | "quiet_end">>
): Promise<AvaSettings> {
  const current = await getAvaSettings(coachId);
  const next = { ...current, ...patch };
  if (next.reply_mode === "autopilot" && !current.autopilot_allowed) {
    throw new Error("Autopilot isn't switched on for your account yet.");
  }
  const { error } = await supabaseAdmin
    .from("coach_ava_settings")
    .upsert({ ...next, updated_at: new Date().toISOString() }, { onConflict: "coach_id" });
  if (error) throw new Error(error.message);
  return next;
}

/** Admin-only: allow or block autopilot for a coach. Blocking also turns it off. */
export async function setAutopilotAllowed(coachId: string, allowed: boolean, minConfidence?: number): Promise<AvaSettings> {
  const current = await getAvaSettings(coachId);
  const next: AvaSettings = {
    ...current,
    autopilot_allowed: allowed,
    reply_mode: !allowed && current.reply_mode === "autopilot" ? "copilot" : current.reply_mode,
    autopilot_min_confidence:
      minConfidence != null && minConfidence >= 0.5 && minConfidence <= 1 ? minConfidence : current.autopilot_min_confidence,
  };
  const { error } = await supabaseAdmin
    .from("coach_ava_settings")
    .upsert({ ...next, updated_at: new Date().toISOString() }, { onConflict: "coach_id" });
  if (error) throw new Error(error.message);
  return next;
}

export async function isAutopilotGloballyOn(): Promise<boolean> {
  const { data } = await supabaseAdmin.from("app_runtime_flags").select("value").eq("key", "ava_autopilot").maybeSingle();
  return Boolean((data?.value as { enabled?: unknown } | null)?.enabled === true);
}

export async function setAutopilotGlobal(enabled: boolean): Promise<void> {
  const { error } = await supabaseAdmin
    .from("app_runtime_flags")
    .upsert({ key: "ava_autopilot", value: { enabled }, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

/** Is it quiet hours for this coach right now (no WhatsApp pings)? */
export function inQuietHours(settings: Pick<AvaSettings, "quiet_start" | "quiet_end">, timeZone: string, now = new Date()): boolean {
  let hour = now.getUTCHours();
  try {
    hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(now));
  } catch {
    // keep UTC
  }
  const { quiet_start: s, quiet_end: e } = settings;
  if (s === e) return false;
  return s < e ? hour >= s && hour < e : hour >= s || hour < e;
}
