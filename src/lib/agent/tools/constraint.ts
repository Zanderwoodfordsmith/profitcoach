import { ACCEPTED, INTERESTED, isProspectCall } from "@/lib/coachHealth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getOkLinkedInAccount } from "@/lib/unipile/outreachAccounts";

import type { AgentToolDef } from "../types";
import { coachOf } from "./util";

/**
 * The constraint skill: the coach's client journey in numbers, and the one
 * stage holding them back most. Read-only. Counting follows coachHealth.ts
 * (Admin → Client success → Get clients) so both show the same numbers.
 * The rules are in pickConstraint and stated in
 * content/agent/capabilities/constraint/CONTEXT.md: change both together.
 */

const DAY = 86_400_000;

/** Tune these here and in the capability's CONTEXT.md. */
export const CONSTRAINT_RULES = {
  /** People still waiting for an invite across running campaigns: about two weeks at 100 a week. */
  minWaiting: 200,
  /** Invites sent in the last 30 days: about 50 a week. Same bar as coach health. */
  minInvites30d: 200,
  /** Enough invites to judge acceptance, and the floor. The 110k-invite review averaged 12% to 18%. */
  judgeAcceptsFrom: 100,
  minAcceptRate: 0.1,
  /** Enough accepted people to judge replies, and the floor. */
  judgeRepliesFrom: 30,
  minReplyRate: 0.05,
  /** Replies (or interested people) in 30 days with no call booked. */
  judgeCallsFromReplies: 10,
  judgeCallsFromInterested: 3,
  /** Calls in the last 90 days with no new client. */
  judgeClientsFromCalls: 5,
} as const;

export type FunnelNumbers = {
  linkedin_connected: boolean;
  /** Outreach runs on the old Sales Robot platform, so it is not counted here. */
  sales_robot: boolean;
  campaigns_running: number;
  people_in_running_campaigns: number;
  people_waiting_for_invite: number;
  invites_30d: number;
  /** Of the people invited in the last 30 days. */
  accepted_of_invited_30d: number;
  replied_of_invited_30d: number;
  /** Anyone who replied or was marked interested in the last 30 days, from any invite date. */
  replies_30d: number;
  interested_30d: number;
  calls_booked_30d: number;
  calls_booked_90d: number;
  calls_booked_all_time: number;
  clients_won_30d: number;
  clients_won_90d: number;
  /** Everyone in their client list. There is no end date, so past clients count too. */
  active_clients: number;
  /** From the Blueprint (Offer → capacity). Null when it is not filled in. */
  capacity: number | null;
};

export type ConstraintStage = "delivery" | "people" | "accepts" | "replies" | "calls" | "clients" | "on_track";

export type ConstraintVerdict = {
  stage: ConstraintStage;
  /** Plain words for the stage. */
  label: string;
  /** The numbers behind it, in a sentence. */
  why: string;
  /** The capability to open next for the one job that fixes it. */
  open: string;
  /** What that job is. */
  next_job: string;
  /** Check this with the coach before saying it as fact. */
  check_first: string | null;
};

function pct(n: number, of: number): string {
  return of > 0 ? `${Math.round((n / of) * 100)}%` : "0%";
}

/**
 * Pick the one constraint. Delivery first: more clients cannot help if they
 * are full. Then the journey from the bottom up: the stage furthest along
 * that has enough people reaching it and still fails is the narrowest point,
 * because more people at the top would only pile up there. A stage with too
 * little data to judge is passed over and listed in `not_judged`. When no
 * later stage fails, the top of the journey (people going in) decides.
 */
export function pickConstraint(n: FunnelNumbers): ConstraintVerdict & { not_judged: string[]; missing: string[] } {
  const R = CONSTRAINT_RULES;
  const missing: string[] = [];
  const notJudged: string[] = [];
  if (n.capacity == null) missing.push("Capacity is not in their Blueprint (Offer), so I cannot tell if they are full.");
  if (n.sales_robot && n.campaigns_running === 0) {
    missing.push("Their outreach runs on Sales Robot, so invites, accepts and replies are not in the app.");
  }
  if (n.calls_booked_all_time === 0) missing.push("No calls have ever been recorded in the app.");
  if (n.active_clients === 0) missing.push("No clients are in their client list.");

  const done = (v: ConstraintVerdict) => ({ ...v, not_judged: notJudged, missing });

  // Delivery: full up.
  if (n.capacity != null && n.capacity > 0 && n.active_clients >= n.capacity) {
    return done({
      stage: "delivery",
      label: "No time to deliver",
      why: `${n.active_clients} clients against room for ${n.capacity}. More leads will not help until there is room.`,
      open: "improve-section",
      next_job: "Look at the Offer: a higher fee, a group format or a shorter programme, so each client takes less time. Hand to BCA if they want help with delivery.",
      check_first: "The client list has no end dates. Ask if all of these clients are still active.",
    });
  }

  // Calls into clients.
  if (n.calls_booked_90d >= R.judgeClientsFromCalls) {
    if (n.clients_won_90d === 0) {
      return done({
        stage: "clients",
        label: "Calls not turning into clients",
        why: `${n.calls_booked_90d} calls booked in the last 90 days and no new client.`,
        open: "personalised-pitch",
        next_job: "Practise the Profit System pitch and the close.",
        check_first:
          n.active_clients === 0
            ? "No clients are in their client list at all. Ask if they track clients somewhere else."
            : "A client only counts here once they are in the client list with a start date.",
      });
    }
  } else {
    notJudged.push(`Calls into clients: ${n.calls_booked_90d} calls in 90 days (need ${R.judgeClientsFromCalls}).`);
  }

  // Replies into calls.
  if (n.replies_30d >= R.judgeCallsFromReplies || n.interested_30d >= R.judgeCallsFromInterested) {
    if (n.calls_booked_30d === 0) {
      return done({
        stage: "calls",
        label: "No calls booked",
        why: `${n.replies_30d} people replied and ${n.interested_30d} were interested in the last 30 days, and no call was booked.`,
        open: "campaigns",
        next_job: "Set up a Positive replies campaign, and answer replies fast with two times to talk.",
        check_first:
          n.calls_booked_all_time === 0
            ? "No call has ever been recorded in the app. Ask if they book calls somewhere else before saying this."
            : null,
      });
    }
  } else {
    notJudged.push(
      `Replies into calls: ${n.replies_30d} replies and ${n.interested_30d} interested in 30 days (need ${R.judgeCallsFromReplies} replies or ${R.judgeCallsFromInterested} interested).`
    );
  }

  // Accepted into replies.
  if (n.accepted_of_invited_30d >= R.judgeRepliesFrom) {
    if (n.replied_of_invited_30d / n.accepted_of_invited_30d < R.minReplyRate) {
      return done({
        stage: "replies",
        label: "No replies",
        why: `${n.replied_of_invited_30d} of the ${n.accepted_of_invited_30d} people who accepted replied (${pct(n.replied_of_invited_30d, n.accepted_of_invited_30d)}).`,
        open: "campaign-messaging",
        next_job: "Rewrite the messages after the invite: shorter (under about 300 characters), one clear question, a result from their Blueprint.",
        check_first: "People who accepted in the last few days may still reply.",
      });
    }
  } else {
    notJudged.push(`Replies: ${n.accepted_of_invited_30d} people accepted in 30 days (need ${R.judgeRepliesFrom}).`);
  }

  // Invites accepted.
  if (n.invites_30d >= R.judgeAcceptsFrom) {
    if (n.accepted_of_invited_30d / n.invites_30d < R.minAcceptRate) {
      return done({
        stage: "accepts",
        label: "Invites not accepted",
        why: `${n.accepted_of_invited_30d} of ${n.invites_30d} people invited in the last 30 days accepted (${pct(n.accepted_of_invited_30d, n.invites_30d)}).`,
        open: "campaign-messaging",
        next_job: "Fix the invite note (no links, short, about them) and check the list is the right people.",
        check_first: "People invited in the last week may not have answered yet.",
      });
    }
  } else {
    notJudged.push(`Accepts: ${n.invites_30d} invites in 30 days (need ${R.judgeAcceptsFrom}).`);
  }

  // People going in.
  const people = (why: string, open: string, next_job: string, check_first: string | null = null) =>
    done({ stage: "people", label: "Not enough people in campaigns", why, open, next_job, check_first });
  if (!n.linkedin_connected && !n.sales_robot) {
    return people("LinkedIn is not connected, so no campaign can send.", "guide", "Connect LinkedIn in Settings. It takes about five minutes.");
  }
  if (n.campaigns_running === 0) {
    return people(
      `No campaign is running. ${n.invites_30d} invites went out in the last 30 days.`,
      "campaigns",
      "Get a Connection campaign running with a list in it.",
      n.sales_robot ? "They are on Sales Robot. Ask if their outreach runs there." : null
    );
  }
  if (n.people_waiting_for_invite < R.minWaiting) {
    return people(
      `Only ${n.people_waiting_for_invite} people are waiting for an invite in running campaigns. That runs out in under two weeks.`,
      "find-prospects",
      "Build a new list (aim for 600 or more) and add it to the running campaign."
    );
  }
  if (n.invites_30d < R.minInvites30d) {
    return people(
      `${n.invites_30d} invites in the last 30 days, with ${n.people_waiting_for_invite} people waiting. The aim is about 100 a week.`,
      "campaigns",
      "Turn the volume up: raise priority or the daily invites, one step at a time.",
      "A campaign that started in the last few weeks is still ramping up."
    );
  }

  return done({
    stage: "on_track",
    label: "No stage is clearly stuck",
    why: `${n.invites_30d} invites, ${pct(n.accepted_of_invited_30d, n.invites_30d)} accepted, ${n.replies_30d} replies and ${n.calls_booked_30d} calls in the last 30 days.`,
    open: "find-prospects",
    next_job: "More people in campaigns grows every number after it. Add a list.",
    check_first: null,
  });
}

async function all<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function count(query: PromiseLike<{ count: number | null; error: { message: string } | null }>): Promise<number> {
  const { count: n, error } = await query;
  if (error) throw new Error(error.message);
  return n ?? 0;
}

function firstNumber(text: unknown): number | null {
  const m = String(text ?? "").match(/\d+/);
  return m ? Number(m[0]) : null;
}

/** The active coach's journey in numbers. Read-only. */
export async function loadFunnelNumbers(coachId: string): Promise<FunnelNumbers> {
  const now = Date.now();
  const since30 = new Date(now - 30 * DAY).toISOString();
  const since90 = new Date(now - 90 * DAY).toISOString();

  const [linkedIn, coachRow, campaigns, practice, jobs, leadsRecent, ghl, bookings, clients] = await Promise.all([
    getOkLinkedInAccount(coachId).catch(() => null),
    supabaseAdmin.from("coaches").select("has_sales_robot_account").eq("id", coachId).maybeSingle(),
    supabaseAdmin.from("linkedin_campaigns").select("id, status").eq("coach_id", coachId),
    supabaseAdmin.from("coach_practice_knowledge").select("payload").eq("coach_id", coachId).maybeSingle(),
    all<{ lead_id: string | null; step_id: string }>((f, t) =>
      supabaseAdmin
        .from("linkedin_send_jobs")
        .select("lead_id, step_id")
        .eq("coach_id", coachId)
        .eq("status", "succeeded")
        .gte("updated_at", since30)
        .range(f, t)
    ),
    all<{ campaign_id: string; status: string; interest_outcome: string | null }>((f, t) =>
      supabaseAdmin
        .from("linkedin_campaign_leads")
        .select("campaign_id, status, interest_outcome")
        .eq("coach_id", coachId)
        .gte("updated_at", since30)
        .range(f, t)
    ),
    all<{ calendar_name: string | null; prospect_name: string | null; created_at: string; status_normalized: string | null }>((f, t) =>
      supabaseAdmin
        .from("ghl_appointments")
        .select("calendar_name, prospect_name, created_at, status_normalized")
        .eq("coach_id", coachId)
        .range(f, t)
    ),
    all<{ created_at: string; status: string }>((f, t) =>
      supabaseAdmin.from("bookings").select("created_at, status").eq("coach_id", coachId).eq("kind", "discovery").range(f, t)
    ),
    all<{ client_joined_on: string | null }>((f, t) =>
      supabaseAdmin.from("contacts").select("client_joined_on").eq("coach_id", coachId).eq("type", "client").range(f, t)
    ),
  ]);
  for (const res of [coachRow, campaigns, practice]) if (res.error) throw new Error(res.error.message);

  const campaignRows = campaigns.data ?? [];
  const runningIds = campaignRows.filter((c) => c.status === "running").map((c) => c.id as string);
  const archivedIds = new Set(campaignRows.filter((c) => c.status === "archived").map((c) => c.id as string));
  const allIds = campaignRows.map((c) => c.id as string);

  // People in running campaigns, and how many still wait for their invite.
  const [inRunning, waiting] = runningIds.length
    ? await Promise.all([
        count(supabaseAdmin.from("linkedin_campaign_leads").select("id", { count: "exact", head: true }).in("campaign_id", runningIds)),
        count(
          supabaseAdmin
            .from("linkedin_campaign_leads")
            .select("id", { count: "exact", head: true })
            .in("campaign_id", runningIds)
            .eq("status", "queued")
        ),
      ])
    : [0, 0];

  // Which sent jobs were invites, then what became of the people invited.
  const inviteSteps = new Set<string>();
  for (let i = 0; i < allIds.length; i += 200) {
    const { data, error } = await supabaseAdmin
      .from("linkedin_campaign_steps")
      .select("id")
      .in("campaign_id", allIds.slice(i, i + 200))
      .eq("step_type", "invite");
    if (error) throw new Error(error.message);
    for (const s of data ?? []) inviteSteps.add(s.id as string);
  }
  const inviteJobs = jobs.filter((j) => inviteSteps.has(j.step_id));
  const invitedLeadIds = [...new Set(inviteJobs.map((j) => j.lead_id).filter((id): id is string => Boolean(id)))];
  let accepted = 0;
  let replied = 0;
  for (let i = 0; i < invitedLeadIds.length; i += 300) {
    const { data, error } = await supabaseAdmin
      .from("linkedin_campaign_leads")
      .select("status, interest_outcome")
      .in("id", invitedLeadIds.slice(i, i + 300));
    if (error) throw new Error(error.message);
    for (const l of data ?? []) {
      const status = String(l.status);
      if (ACCEPTED.has(status)) accepted += 1;
      if (status === "replied" || INTERESTED.has(status) || l.interest_outcome === "positive") replied += 1;
    }
  }

  // Replies in the window from any invite date. Imported Sales Robot history sits in archived campaigns.
  let replies = 0;
  let interested = 0;
  for (const l of leadsRecent) {
    if (archivedIds.has(l.campaign_id)) continue;
    if (l.status === "replied" || INTERESTED.has(l.status)) replies += 1;
    if (INTERESTED.has(l.status) || l.interest_outcome === "positive") interested += 1;
  }

  // Prospect calls, by when they were booked.
  const callTimes: number[] = [];
  for (const a of ghl) {
    if (a.status_normalized === "cancelled" || !isProspectCall(a.calendar_name, a.prospect_name)) continue;
    callTimes.push(Date.parse(a.created_at));
  }
  for (const b of bookings) if (b.status !== "cancelled") callTimes.push(Date.parse(b.created_at));
  const callsSince = (iso: string) => callTimes.filter((t) => t >= Date.parse(iso)).length;

  const joined = clients.map((c) => (c.client_joined_on ? Date.parse(c.client_joined_on) : NaN));
  const clientsSince = (iso: string) => joined.filter((t) => Number.isFinite(t) && t >= Date.parse(iso)).length;

  const payload = (practice.data?.payload ?? {}) as { practice?: { capacity?: { value?: unknown } | null } };

  return {
    linkedin_connected: Boolean(linkedIn),
    sales_robot: Boolean(coachRow.data?.has_sales_robot_account),
    campaigns_running: runningIds.length,
    people_in_running_campaigns: inRunning,
    people_waiting_for_invite: waiting,
    invites_30d: inviteJobs.length,
    accepted_of_invited_30d: accepted,
    replied_of_invited_30d: replied,
    replies_30d: replies,
    interested_30d: interested,
    calls_booked_30d: callsSince(since30),
    calls_booked_90d: callsSince(since90),
    calls_booked_all_time: callTimes.length,
    clients_won_30d: clientsSince(since30),
    clients_won_90d: clientsSince(since90),
    active_clients: clients.length,
    capacity: firstNumber(payload.practice?.capacity?.value),
  };
}

export const constraintTools: AgentToolDef[] = [
  {
    name: "get_funnel_numbers",
    label: "Reading their numbers",
    needsCoach: true,
    description:
      "The active coach's client journey in numbers (people in campaigns, invites, accepts, replies, calls booked, clients, capacity) for the last 30 days, with 90-day and all-time counts for calls and clients. Also returns the stage the rules pick as their biggest constraint, the capability to open next, what could not be judged, and what data is missing. Read-only.",
    input_schema: { type: "object", properties: {} },
    run: async (_input, ctx) => {
      const coach = coachOf(ctx);
      const numbers = await loadFunnelNumbers(coach.id);
      return { coach: coach.name, numbers, constraint: pickConstraint(numbers) };
    },
  },
];
