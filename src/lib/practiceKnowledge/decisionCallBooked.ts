import { PROGRAMME_ORIENTATION_CALENDAR_SLUG } from "@/config/programmeOrientationCalendar";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function norm(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

async function emailsForCoachIds(coachIds: string[]): Promise<Map<string, string>> {
  const emailById = new Map<string, string>();
  if (coachIds.length === 0) return emailById;
  if (coachIds.length === 1) {
    const { data } = await supabaseAdmin.auth.admin.getUserById(coachIds[0]);
    const email = norm(data.user?.email);
    if (email) emailById.set(coachIds[0], email);
    return emailById;
  }

  const { data } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const wanted = new Set(coachIds);
  for (const user of data.users ?? []) {
    if (!wanted.has(user.id)) continue;
    const email = norm(user.email);
    if (email) emailById.set(user.id, email);
  }
  return emailById;
}

export async function loadDecisionCallBookedAt(
  coachIds: string[]
): Promise<Map<string, string>> {
  const booked = new Map<string, string>();
  if (coachIds.length === 0) return booked;

  const [{ data: bookings }, { data: profiles }, emailById] = await Promise.all([
    supabaseAdmin
      .from("bookings")
      .select("prospect_email, prospect_phone, starts_at, kind, status")
      .eq("kind", PROGRAMME_ORIENTATION_CALENDAR_SLUG)
      .eq("status", "booked")
      .order("starts_at", { ascending: false })
      .limit(500),
    supabaseAdmin.from("profiles").select("id, phone").in("id", coachIds),
    emailsForCoachIds(coachIds),
  ]);

  const byEmail = new Map<string, string>();
  const byPhone = new Map<string, string>();
  for (const row of bookings ?? []) {
    const at = String((row as { starts_at?: string }).starts_at ?? "");
    const email = norm((row as { prospect_email?: string | null }).prospect_email);
    const phone = norm((row as { prospect_phone?: string | null }).prospect_phone);
    if (email && !byEmail.has(email)) byEmail.set(email, at);
    if (phone && !byPhone.has(phone)) byPhone.set(phone, at);
  }

  const phones = new Map<string, string>();
  for (const p of profiles ?? []) {
    phones.set(String((p as { id: string }).id), norm((p as { phone?: string | null }).phone));
  }

  for (const id of coachIds) {
    const at =
      byEmail.get(emailById.get(id) ?? "") || byPhone.get(phones.get(id) ?? "");
    if (at) booked.set(id, at);
  }
  return booked;
}
