import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Coach health for getting clients: one row per active coach with the numbers
 * that matter and the first thing holding them back ("stuck at"), so BCA (and
 * Ava) know who to help with what. 30-day window unless noted.
 */

const DAY = 86_400_000;
export const ACCEPTED = new Set(["connected", "in_sequence", "replied", "interested", "assessment_sent", "assessment_done", "call_offered", "completed"]);
export const INTERESTED = new Set(["interested", "assessment_sent", "assessment_done", "call_offered"]);
const PROSPECT_CAL = /discovery|boss|score|roadmap|30 minute call|strategy|value session|introductory|profit|book a call|speak with|scorecard|call with/i;
const CLIENT_CAL = /90-minute coaching|coaching session|extra call|next steps/i;

export type HealthLevel = "red" | "amber" | "green";

export type CoachHealthRow = {
  coach_id: string;
  name: string;
  slug: string;
  level: HealthLevel;
  stuck_at: string;
  next_step: string;
  last_active_days: number | null;
  blueprint: string | null;
  linkedin: "connected" | "problem" | "none";
  ssi: number | null;
  sales_robot: boolean;
  campaigns_running: number;
  invites_7d: number;
  invites_30d: number;
  accept_rate: number | null;
  replies_30d: number;
  interested_30d: number;
  calls_30d: number;
  /** Of those calls, how many link back to a campaign lead. */
  campaign_calls_30d: number;
  /** Day 1 = Stripe subscription start (or first payment) to the first prospect call / first client. */
  days_to_first_call: number | null;
  days_to_first_client: number | null;
  median_reply_hours: number | null;
  /** From their imported LinkedIn history; null until it has been imported. */
  posts_30d: number | null;
  last_post_days: number | null;
  issues_90d: number | null;
};

async function all<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** Decide the one thing to fix first. Pure, so it's easy to test and tune. */
export function diagnose(r: Omit<CoachHealthRow, "level" | "stuck_at" | "next_step">): { level: HealthLevel; stuck_at: string; next_step: string } {
  if (r.last_active_days != null && r.last_active_days >= 14) {
    return { level: "red", stuck_at: "Not logging in", next_step: "Personal check-in: what's got in the way?" };
  }
  if (r.linkedin === "none" && !r.sales_robot) {
    return { level: "red", stuck_at: "LinkedIn not connected", next_step: "Connect LinkedIn in Settings (5 minutes)." };
  }
  if (r.linkedin === "problem") {
    return { level: "red", stuck_at: "LinkedIn connection broken", next_step: "Reconnect LinkedIn; campaigns are paused until then." };
  }
  if (r.invites_7d === 0 && r.campaigns_running === 0 && !r.sales_robot) {
    return { level: "red", stuck_at: "Not sending", next_step: "Turn on a campaign; offer to build the first one with them." };
  }
  if (r.blueprint && /not started|draft|interview/i.test(r.blueprint)) {
    return { level: "amber", stuck_at: "Blueprint not finished", next_step: "Finish the Blueprint so campaigns can use their proof and tribe." };
  }
  if (r.invites_30d > 0 && r.invites_30d < 200 && !r.sales_robot) {
    return { level: "amber", stuck_at: "Sending too little", next_step: "Aim for 100+ invites a week; check daily limits and the pool size." };
  }
  if (r.accept_rate != null && r.invites_30d >= 100 && r.accept_rate < 0.1) {
    return { level: "amber", stuck_at: "Few people accept", next_step: "Check targeting (sector, Open Profile first) and remove links from the note." };
  }
  if (r.interested_30d >= 3 && r.calls_30d === 0) {
    return { level: "amber", stuck_at: "Interest isn't turning into calls", next_step: "Review their replies; switch on Ava alerts and offer two times." };
  }
  if (r.median_reply_hours != null && r.median_reply_hours > 4) {
    return { level: "amber", stuck_at: "Slow replies", next_step: "Turn on Ava phone alerts; aim to reply within 30 minutes." };
  }
  if (r.sales_robot && r.campaigns_running === 0) {
    return { level: "green", stuck_at: "On Sales Robot (not tracked here)", next_step: "Move them onto Get Clients so we can see and help." };
  }
  return { level: "green", stuck_at: "On track", next_step: "Keep going; share what's working with the group." };
}

export function isProspectCall(calendarName: unknown, prospectName: unknown): boolean {
  const cal = String(calendarName ?? "");
  return !CLIENT_CAL.test(cal) && PROSPECT_CAL.test(cal) && !/demo|test/i.test(String(prospectName ?? ""));
}

function daysFrom(day1: number, times: number[]): number | null {
  const after = times.filter((t) => t >= day1);
  return after.length ? Math.floor((Math.min(...after) - day1) / DAY) : null;
}

/**
 * Days from day 1 to the first prospect call and the first client, all time.
 * Day 1 is the Stripe subscription start, or the first payment for coaches
 * who pay another way. First client: the date a contact was marked client,
 * or the first coaching session on the calendar.
 */
async function loadFirsts(
  coaches: { id: string; membership_started_at: string | null }[]
): Promise<Map<string, { call: number | null; client: number | null }>> {
  const ids = coaches.map((c) => c.id);
  const [payments, ghlAll, bookingsAll, clients] = await Promise.all([
    all<{ coach_id: string; paid_at: string }>((f, t) =>
      supabaseAdmin.from("coach_payments").select("coach_id, paid_at").in("coach_id", ids).eq("status", "succeeded").range(f, t)
    ),
    all<{ coach_id: string; calendar_name: string | null; prospect_name: string | null; start_time: string | null }>((f, t) =>
      supabaseAdmin.from("ghl_appointments").select("coach_id, calendar_name, prospect_name, start_time").in("coach_id", ids).range(f, t)
    ),
    all<{ coach_id: string; kind: string | null; starts_at: string }>((f, t) =>
      supabaseAdmin.from("bookings").select("coach_id, kind, starts_at").in("coach_id", ids).neq("status", "cancelled").range(f, t)
    ),
    all<{ coach_id: string; client_joined_on: string | null }>((f, t) =>
      supabaseAdmin.from("contacts").select("coach_id, client_joined_on").in("coach_id", ids).eq("type", "client").not("client_joined_on", "is", null).range(f, t)
    ),
  ]);

  const firstPaid = new Map<string, number>();
  for (const p of payments) {
    const t = Date.parse(p.paid_at);
    if (Number.isFinite(t) && t < (firstPaid.get(p.coach_id) ?? Infinity)) firstPaid.set(p.coach_id, t);
  }
  const callTimes = new Map<string, number[]>();
  const sessionTimes = new Map<string, number[]>();
  const push = (m: Map<string, number[]>, id: string, iso: string | null) => {
    const t = iso ? Date.parse(iso) : NaN;
    if (Number.isFinite(t)) m.set(id, [...(m.get(id) ?? []), t]);
  };
  for (const a of ghlAll) {
    if (isProspectCall(a.calendar_name, a.prospect_name)) push(callTimes, a.coach_id, a.start_time);
    else if (CLIENT_CAL.test(String(a.calendar_name ?? ""))) push(sessionTimes, a.coach_id, a.start_time);
  }
  for (const b of bookingsAll) {
    if (b.kind === "discovery") push(callTimes, b.coach_id, b.starts_at);
    else if (CLIENT_CAL.test(String(b.kind ?? "").replace(/-/g, " "))) push(sessionTimes, b.coach_id, b.starts_at);
  }
  const clientTimes = new Map<string, number[]>();
  for (const c of clients) push(clientTimes, c.coach_id, c.client_joined_on);

  const out = new Map<string, { call: number | null; client: number | null }>();
  for (const c of coaches) {
    const day1 = c.membership_started_at ? Date.parse(c.membership_started_at) : firstPaid.get(c.id);
    if (day1 == null || !Number.isFinite(day1)) continue;
    // Count from the start of day 1, so a call that day is day 0.
    const start = day1 - (day1 % DAY);
    out.set(c.id, {
      call: daysFrom(start, callTimes.get(c.id) ?? []),
      client: daysFrom(start, clientTimes.get(c.id) ?? []) ?? daysFrom(start, sessionTimes.get(c.id) ?? []),
    });
  }
  return out;
}

export async function loadCoachHealth(): Promise<CoachHealthRow[]> {
  const since30 = new Date(Date.now() - 30 * DAY).toISOString();
  const since7 = Date.now() - 7 * DAY;

  const coaches = await all<{ id: string; slug: string; membership_status: string | null; recurring_payment_status: string | null; has_sales_robot_account: boolean | null; record_kind: string | null; membership_started_at: string | null }>(
    (f, t) => supabaseAdmin.from("coaches").select("id, slug, membership_status, recurring_payment_status, has_sales_robot_account, record_kind, membership_started_at").range(f, t)
  );
  const active = coaches.filter(
    (c) => (c.membership_status === "active" || c.membership_status === "past_due" || c.membership_status === "trialing") && c.record_kind !== "historical"
  );
  const ids = active.map((c) => c.id);
  if (!ids.length) return [];

  const since90 = new Date(Date.now() - 90 * DAY).toISOString();
  const [profiles, accounts, knowledge, campaigns, jobs, leadsRecent, ghl, bookings, sessions, msgs, postImports, recentPosts, recentIssues] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, full_name").in("id", ids),
    supabaseAdmin.from("linkedin_outreach_accounts").select("coach_id, provider, status, ssi_score").in("coach_id", ids),
    supabaseAdmin.from("coach_practice_knowledge").select("coach_id, status, completeness_score").in("coach_id", ids),
    supabaseAdmin.from("linkedin_campaigns").select("coach_id, status").in("coach_id", ids).eq("status", "running"),
    all<{ coach_id: string; lead_id: string | null; step_id: string; updated_at: string }>((f, t) =>
      supabaseAdmin.from("linkedin_send_jobs").select("coach_id, lead_id, step_id, updated_at").eq("status", "succeeded").gte("updated_at", since30).range(f, t)
    ),
    all<{ coach_id: string; campaign_id: string; status: string; interest_outcome: string | null }>((f, t) =>
      supabaseAdmin
        .from("linkedin_campaign_leads")
        .select("coach_id, campaign_id, status, interest_outcome")
        .in("coach_id", ids)
        .gte("updated_at", since30)
        .range(f, t)
    ),
    supabaseAdmin.from("ghl_appointments").select("coach_id, calendar_name, prospect_name, start_time, created_at, campaign_lead_id").gte("created_at", since30),
    supabaseAdmin.from("bookings").select("coach_id, kind, created_at, campaign_lead_id").gte("created_at", since30),
    all<{ user_id: string; last_activity_at: string | null }>((f, t) =>
      supabaseAdmin.from("app_usage_sessions").select("user_id, last_activity_at").in("user_id", ids).gte("started_at", new Date(Date.now() - 90 * DAY).toISOString()).range(f, t)
    ),
    all<{ coach_id: string; conversation_id: string; direction: string; created_at: string }>((f, t) =>
      supabaseAdmin
        .from("messaging_messages")
        .select("coach_id, conversation_id, direction, created_at")
        .eq("channel", "linkedin")
        .gte("created_at", since30)
        .order("created_at", { ascending: true })
        .range(f, t)
    ),
    supabaseAdmin.from("linkedin_history_imports").select("user_id, last_ok_at, last_post_at").in("user_id", ids),
    all<{ user_id: string; posted_at: string }>((f, t) =>
      supabaseAdmin.from("linkedin_post_history").select("user_id, posted_at").in("user_id", ids).gte("posted_at", since30).range(f, t)
    ),
    all<{ user_id: string }>((f, t) =>
      supabaseAdmin.from("linkedin_newsletter_issues").select("user_id").in("user_id", ids).gte("published_at", since90).range(f, t)
    ),
  ]);

  // Which sent jobs were invites.
  const stepIds = [...new Set(jobs.map((j) => j.step_id))];
  const inviteSteps = new Set<string>();
  for (let i = 0; i < stepIds.length; i += 300) {
    const { data } = await supabaseAdmin.from("linkedin_campaign_steps").select("id, step_type").in("id", stepIds.slice(i, i + 300));
    for (const s of data ?? []) if (s.step_type === "invite") inviteSteps.add(s.id as string);
  }
  const invitedLeadIds = new Map<string, string[]>();
  const inv7 = new Map<string, number>();
  for (const j of jobs) {
    if (!inviteSteps.has(j.step_id)) continue;
    const list = invitedLeadIds.get(j.coach_id) ?? [];
    if (j.lead_id) list.push(j.lead_id);
    invitedLeadIds.set(j.coach_id, list);
    if (new Date(j.updated_at).getTime() >= since7) inv7.set(j.coach_id, (inv7.get(j.coach_id) ?? 0) + 1);
  }
  // Acceptance among people invited in the window.
  const accepted = new Map<string, number>();
  for (const [coachId, leadIds] of invitedLeadIds) {
    let n = 0;
    for (let i = 0; i < leadIds.length; i += 300) {
      const { data } = await supabaseAdmin.from("linkedin_campaign_leads").select("status").in("id", leadIds.slice(i, i + 300));
      for (const l of data ?? []) if (ACCEPTED.has(String(l.status))) n += 1;
    }
    accepted.set(coachId, n);
  }

  // Imported Sales Robot history lives in archived campaigns; it isn't this month's activity.
  const { data: archived } = await supabaseAdmin.from("linkedin_campaigns").select("id").in("coach_id", ids).eq("status", "archived");
  const archivedIds = new Set((archived ?? []).map((c) => c.id as string));
  const replies = new Map<string, number>();
  const interested = new Map<string, number>();
  for (const l of leadsRecent) {
    if (archivedIds.has(l.campaign_id)) continue;
    if (l.status === "replied" || INTERESTED.has(l.status)) replies.set(l.coach_id, (replies.get(l.coach_id) ?? 0) + 1);
    if (INTERESTED.has(l.status) || l.interest_outcome === "positive") interested.set(l.coach_id, (interested.get(l.coach_id) ?? 0) + 1);
  }

  const calls = new Map<string, number>();
  const campaignCalls = new Map<string, number>();
  const countCall = (coachId: string, leadId: unknown) => {
    calls.set(coachId, (calls.get(coachId) ?? 0) + 1);
    if (leadId) campaignCalls.set(coachId, (campaignCalls.get(coachId) ?? 0) + 1);
  };
  for (const a of ghl.data ?? []) {
    if (a.coach_id && isProspectCall(a.calendar_name, a.prospect_name)) countCall(a.coach_id as string, a.campaign_lead_id);
  }
  for (const b of bookings.data ?? []) {
    if (b.kind === "discovery" && b.coach_id) countCall(b.coach_id as string, b.campaign_lead_id);
  }

  const firsts = await loadFirsts(active);

  const lastActive = new Map<string, number>();
  for (const s of sessions) {
    const t = s.last_activity_at ? new Date(s.last_activity_at).getTime() : 0;
    if (t > (lastActive.get(s.user_id) ?? 0)) lastActive.set(s.user_id, t);
  }

  // Reply speed: first coach message after each prospect message.
  const waits = new Map<string, number[]>();
  const pending = new Map<string, number>();
  for (const m of msgs) {
    const t = new Date(m.created_at).getTime();
    if (m.direction === "inbound") {
      if (!pending.has(m.conversation_id)) pending.set(m.conversation_id, t);
    } else if (pending.has(m.conversation_id)) {
      const list = waits.get(m.coach_id) ?? [];
      list.push((t - pending.get(m.conversation_id)!) / 3_600_000);
      waits.set(m.coach_id, list);
      pending.delete(m.conversation_id);
    }
  }

  // LinkedIn posting, only for coaches whose history has been imported.
  const imported = new Map<string, string | null>();
  for (const r of postImports.data ?? []) if (r.last_ok_at) imported.set(r.user_id as string, (r.last_post_at as string | null) ?? null);
  const posts30 = new Map<string, number>();
  for (const p of recentPosts) posts30.set(p.user_id, (posts30.get(p.user_id) ?? 0) + 1);
  const issues90 = new Map<string, number>();
  for (const i of recentIssues) issues90.set(i.user_id, (issues90.get(i.user_id) ?? 0) + 1);

  const nameOf = new Map((profiles.data ?? []).map((p) => [p.id as string, (p.full_name as string) || ""]));
  const accountOf = new Map<string, { status: string; ssi: number | null }>();
  for (const a of accounts.data ?? []) {
    if (String(a.provider).toUpperCase() !== "LINKEDIN") continue;
    const prev = accountOf.get(a.coach_id as string);
    if (!prev || String(a.status).toUpperCase() === "OK") accountOf.set(a.coach_id as string, { status: String(a.status), ssi: (a.ssi_score as number | null) ?? null });
  }
  const bp = new Map((knowledge.data ?? []).map((k) => [k.coach_id as string, `${k.status ?? "started"}${k.completeness_score != null ? ` · ${Math.round(Number(k.completeness_score))}%` : ""}`]));
  const running = new Map<string, number>();
  for (const c of campaigns.data ?? []) running.set(c.coach_id as string, (running.get(c.coach_id as string) ?? 0) + 1);

  return active
    .map((c) => {
      const acct = accountOf.get(c.id);
      const inv30 = invitedLeadIds.get(c.id)?.length ?? 0;
      const last = lastActive.get(c.id);
      const base = {
        coach_id: c.id,
        name: nameOf.get(c.id) || c.slug,
        slug: c.slug,
        last_active_days: last ? Math.floor((Date.now() - last) / DAY) : null,
        blueprint: bp.get(c.id) ?? "not started",
        linkedin: (acct ? (acct.status.toUpperCase() === "OK" ? "connected" : "problem") : "none") as CoachHealthRow["linkedin"],
        ssi: acct?.ssi ?? null,
        sales_robot: Boolean(c.has_sales_robot_account),
        campaigns_running: running.get(c.id) ?? 0,
        invites_7d: inv7.get(c.id) ?? 0,
        invites_30d: inv30,
        accept_rate: inv30 ? (accepted.get(c.id) ?? 0) / inv30 : null,
        replies_30d: replies.get(c.id) ?? 0,
        interested_30d: interested.get(c.id) ?? 0,
        calls_30d: calls.get(c.id) ?? 0,
        campaign_calls_30d: campaignCalls.get(c.id) ?? 0,
        days_to_first_call: firsts.get(c.id)?.call ?? null,
        days_to_first_client: firsts.get(c.id)?.client ?? null,
        median_reply_hours: median(waits.get(c.id) ?? []),
        posts_30d: imported.has(c.id) ? posts30.get(c.id) ?? 0 : null,
        last_post_days: imported.get(c.id) ? Math.floor((Date.now() - Date.parse(imported.get(c.id)!)) / DAY) : null,
        issues_90d: imported.has(c.id) ? issues90.get(c.id) ?? 0 : null,
      };
      return { ...base, ...diagnose(base) };
    })
    .sort((a, b) => ({ red: 0, amber: 1, green: 2 })[a.level] - ({ red: 0, amber: 1, green: 2 })[b.level] || a.name.localeCompare(b.name));
}
