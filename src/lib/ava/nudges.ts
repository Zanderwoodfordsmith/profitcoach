import { getAvaSettings, inQuietHours } from "@/lib/ava/settings";
import { loadCoachTimezone } from "@/lib/booking/bookingService";
import { loadCoachHealth, type CoachHealthRow } from "@/lib/coachHealth";
import { NUDGE_TEMPLATES, nudgeSection, type NudgeVars } from "@/lib/ava/nudgeRules";
import { addSectionComment } from "@/lib/practiceKnowledge/sectionComments";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Ava nudges, step one: a daily scan of coach health. Every coach who is
 * stuck (red or amber) gets one queued nudge, drafted from the template for
 * where they're stuck. BCA approves, edits or rejects it before it posts.
 */

export function draftNudge(row: Pick<CoachHealthRow, "name" | "stuck_at" | "next_step" | "invites_7d" | "accept_rate" | "interested_30d">): string {
  const vars: NudgeVars = {
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
  const { data: snoozedRows } = await supabaseAdmin
    .from("coach_ava_settings")
    .select("coach_id")
    .gt("nudges_snoozed_until", new Date().toISOString());
  const snoozed = new Set((snoozedRows ?? []).map((r) => r.coach_id as string));
  const stuck = rows.filter((r) => isStuck(r) && !snoozed.has(r.coach_id));
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
  const snoozeIds: string[] = [];
  for (const n of open ?? []) {
    if (snoozed.has(n.coach_id as string)) snoozeIds.push(n.id as string);
    else if (!stuckIds.has(n.coach_id as string)) skipIds.push(n.id as string);
  }
  await dropQueued(skipIds, "No longer stuck there");
  await dropQueued(snoozeIds, "Nudges snoozed");
  return { coaches: rows.length, stuck: stuck.length, queued, kept, skipped: skipIds.length + snoozeIds.length, snoozed: snoozed.size };
}

async function dropQueued(ids: string[], note: string) {
  if (!ids.length) return;
  await supabaseAdmin
    .from("ava_nudges")
    .update({ status: "skipped", note, updated_at: new Date().toISOString() })
    .in("id", ids)
    .eq("status", "queued");
}

export { NUDGE_SECTION, NUDGE_TEMPLATES, nudgeSection } from "@/lib/ava/nudgeRules";

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

export type NudgeHold = "snoozed" | "quiet_hours" | "posted_today" | null;

/**
 * Guardrails before a nudge goes out: never while the coach has snoozed
 * nudges, never in their quiet hours, and at most one in any 24 hours.
 */
export function nudgeHold(input: { snoozedUntil: string | null; quiet: boolean; lastPostedAt: string | null; now?: Date }): NudgeHold {
  const now = (input.now ?? new Date()).getTime();
  if (input.snoozedUntil && Date.parse(input.snoozedUntil) > now) return "snoozed";
  if (input.quiet) return "quiet_hours";
  if (input.lastPostedAt && now - Date.parse(input.lastPostedAt) < 86_400_000) return "posted_today";
  return null;
}

/** Posts approved nudges that pass the guardrails; the rest wait for the next run. */
export async function postApprovedNudges(onlyId?: string) {
  let query = supabaseAdmin.from("ava_nudges").select("id, coach_id, stuck_at, body").eq("status", "approved").order("decided_at");
  if (onlyId) query = query.eq("id", onlyId);
  const { data } = await query;
  const result = { approved: (data ?? []).length, posted: 0, held: 0, snoozed: 0 };
  const seen = new Set<string>();
  for (const n of (data ?? []) as ApprovedNudge[]) {
    // One per coach per run; the next one waits a day.
    if (seen.has(n.coach_id)) {
      result.held += 1;
      continue;
    }
    seen.add(n.coach_id);
    const [settings, timeZone, { data: last }] = await Promise.all([
      getAvaSettings(n.coach_id),
      loadCoachTimezone(n.coach_id),
      supabaseAdmin
        .from("ava_nudges")
        .select("posted_at")
        .eq("coach_id", n.coach_id)
        .not("posted_at", "is", null)
        .order("posted_at", { ascending: false })
        .limit(1),
    ]);
    const hold = nudgeHold({
      snoozedUntil: settings.nudges_snoozed_until,
      quiet: inQuietHours(settings, timeZone),
      lastPostedAt: (last?.[0]?.posted_at as string | null) ?? null,
    });
    if (hold === "snoozed") {
      await supabaseAdmin
        .from("ava_nudges")
        .update({ status: "skipped", note: "Nudges snoozed", updated_at: new Date().toISOString() })
        .eq("id", n.id)
        .eq("status", "approved");
      result.snoozed += 1;
    } else if (hold) {
      result.held += 1;
    } else if (await postNudge(n)) {
      result.posted += 1;
    }
  }
  return result;
}
