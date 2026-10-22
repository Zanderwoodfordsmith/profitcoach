import { loadCoachHealth, type CoachHealthRow } from "@/lib/coachHealth";
import { addSectionComment } from "@/lib/practiceKnowledge/sectionComments";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Ava nudges, step one: a daily scan of coach health. Every coach who is
 * stuck (red or amber) gets one queued nudge, drafted from the template for
 * where they're stuck. BCA approves, edits or rejects it before it posts.
 */

type Vars = { first: string; invites_7d: number; accept: string; interested: number };

/** One template per "stuck at" from coach health. Ava speaks to the coach. */
export const NUDGE_TEMPLATES: Record<string, (v: Vars) => string> = {
  "Not logging in": (v) =>
    `Hi ${v.first}, it's Ava. I haven't seen you in the app for a little while. Is something getting in the way? Tell me here and I'll help you pick up where you left off.`,
  "LinkedIn not connected": (v) =>
    `Hi ${v.first}, your campaigns start as soon as LinkedIn is connected. It takes about five minutes in Settings, under Integrations. Want me to walk you through it?`,
  "LinkedIn connection broken": (v) =>
    `Hi ${v.first}, LinkedIn dropped its connection, so your campaigns are paused. Reconnect it in Settings, under Integrations, and they carry on where they stopped.`,
  "Not sending": (v) =>
    `Hi ${v.first}, your campaigns are ready to go but nothing is sending yet. Shall we switch on your first one together? I'll set it up from your Blueprint and you approve it.`,
  "Blueprint not finished": (v) =>
    `Hi ${v.first}, your Blueprint is nearly there. Finish About You and we write the rest for you, campaigns included. It's a few minutes of ticking and tapping.`,
  "Sending too little": (v) =>
    `Hi ${v.first}, you sent ${v.invites_7d} invites this week. The coaches booking calls send 100 or more. Want me to check your daily limits and how many people are left in your list?`,
  "Few people accept": (v) =>
    `Hi ${v.first}, about ${v.accept} of the people you invite accept. Two quick wins: send to Open Profiles first and keep links out of the note. Want me to look over your list with you?`,
  "Interest isn't turning into calls": (v) =>
    `Hi ${v.first}, ${v.interested} people said they're interested this month. Offer two times in your reply and they book far more often. Want me to draft your next few replies?`,
  "Slow replies": (v) =>
    `Hi ${v.first}, people are replying to you. The faster you answer, the more calls you book. Switch on phone alerts in Ava's settings and aim to reply within 30 minutes.`,
};

export function draftNudge(row: Pick<CoachHealthRow, "name" | "stuck_at" | "next_step" | "invites_7d" | "accept_rate" | "interested_30d">): string {
  const vars: Vars = {
    first: row.name.trim().split(/\s+/)[0] || "there",
    invites_7d: row.invites_7d,
    accept: row.accept_rate == null ? "few" : `${Math.round(row.accept_rate * 100)}%`,
    interested: row.interested_30d,
  };
  const template = NUDGE_TEMPLATES[row.stuck_at];
  return template ? template(vars) : `Hi ${vars.first}, it's Ava. ${row.next_step}`;
}

export function isStuck(row: Pick<CoachHealthRow, "level">): boolean {
  return row.level === "red" || row.level === "amber";
}

/** Runs once a day. Safe to rerun: one row per coach per day. */
export async function runNudgeScan(today = new Date().toISOString().slice(0, 10)) {
  const rows = await loadCoachHealth();
  const stuck = rows.filter(isStuck);
  const { data: open } = await supabaseAdmin.from("ava_nudges").select("id, coach_id, stuck_at, scan_date").eq("status", "queued");
  const openByCoach = new Map((open ?? []).map((n) => [n.coach_id as string, n]));

  let queued = 0;
  let kept = 0;
  const skipIds: string[] = [];
  for (const row of stuck) {
    const prev = openByCoach.get(row.coach_id);
    const draft = { level: row.level, stuck_at: row.stuck_at, next_step: row.next_step, body: draftNudge(row) };
    // Still waiting on BCA for the same problem: keep that one.
    if (prev && prev.stuck_at === row.stuck_at) {
      kept += 1;
      continue;
    }
    if (prev && prev.scan_date === today) {
      await supabaseAdmin.from("ava_nudges").update({ ...draft, updated_at: new Date().toISOString() }).eq("id", prev.id);
      queued += 1;
      continue;
    }
    if (prev) skipIds.push(prev.id as string);
    const { error } = await supabaseAdmin
      .from("ava_nudges")
      .upsert({ coach_id: row.coach_id, scan_date: today, status: "queued", ...draft }, { onConflict: "coach_id,scan_date", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    queued += 1;
  }
  // Moved on, or now stuck somewhere else: the old draft no longer fits.
  const stuckIds = new Set(stuck.map((r) => r.coach_id));
  for (const n of open ?? []) if (!stuckIds.has(n.coach_id as string)) skipIds.push(n.id as string);
  if (skipIds.length) {
    await supabaseAdmin
      .from("ava_nudges")
      .update({ status: "skipped", note: "No longer stuck there", updated_at: new Date().toISOString() })
      .in("id", skipIds)
      .eq("status", "queued");
  }
  return { coaches: rows.length, stuck: stuck.length, queued, kept, skipped: skipIds.length };
}

/** Which Blueprint section thread each nudge belongs in. */
export const NUDGE_SECTION: Record<string, string> = {
  "Not logging in": "story:experience",
  "Blueprint not finished": "story:results",
  "LinkedIn not connected": "linkedin:profile",
  "LinkedIn connection broken": "linkedin:profile",
  "Not sending": "campaigns:messaging",
  "Sending too little": "campaigns:messaging",
  "Few people accept": "campaigns:messaging",
  "Interest isn't turning into calls": "campaigns:conversation",
  "Slow replies": "campaigns:conversation",
};

export function nudgeSection(stuckAt: string): string {
  return NUDGE_SECTION[stuckAt] ?? "story:experience";
}

type ApprovedNudge = { id: string; coach_id: string; stuck_at: string; body: string };

/** Posts one approved nudge into the coach's Blueprint thread, as Ava. */
async function postNudge(n: ApprovedNudge): Promise<boolean> {
  const comment = await addSectionComment({
    coachId: n.coach_id,
    sectionKey: nudgeSection(n.stuck_at),
    authorId: null,
    side: "ava",
    body: n.body,
  });
  const { error } = await supabaseAdmin
    .from("ava_nudges")
    .update({ status: "posted", posted_at: new Date().toISOString(), post_ref: comment.id, updated_at: new Date().toISOString() })
    .eq("id", n.id)
    .eq("status", "approved");
  if (error) throw new Error(error.message);
  return true;
}

/** Posts every approved nudge that hasn't gone out yet. */
export async function postApprovedNudges(onlyId?: string) {
  let query = supabaseAdmin.from("ava_nudges").select("id, coach_id, stuck_at, body").eq("status", "approved").order("decided_at");
  if (onlyId) query = query.eq("id", onlyId);
  const { data } = await query;
  let posted = 0;
  for (const n of (data ?? []) as ApprovedNudge[]) {
    if (await postNudge(n)) posted += 1;
  }
  return { approved: (data ?? []).length, posted };
}
