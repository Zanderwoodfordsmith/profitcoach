import { ACCEPTED, INTERESTED, isProspectCall } from "@/lib/coachHealth";
import { adminPreviewCoachRouteForPath } from "@/lib/coachAccess/adminPreviewRoutes";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { DEFAULT_TARGETS } from "@/lib/scoreboard";
import { getOkLinkedInAccount } from "@/lib/unipile/outreachAccounts";

import type { AgentToolDef } from "../types";
import { checkRate, DEFAULT_MONTHS_KEPT, moneyIn, practiceModel, type RateId, workBack } from "./practiceModel";
import { coachOf } from "./util";

/**
 * The constraint skill: the coach's client journey in numbers, and the one
 * stage holding them back most. Read-only. Counting follows coachHealth.ts
 * (Admin → Client success → Get clients) so both show the same numbers.
 * The rules are in pickConstraint (thresholds in CONSTRAINT_RULES); the
 * order Ava walks is in content/agent/capabilities/constraint/CONTEXT.md.
 */

const DAY = 86_400_000;

/** Tune these here. The capability's CONTEXT.md explains the order, not the numbers. */
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
  clients_won_180d: number;
  /** How many months ago each client with a start date joined. */
  client_join_months_ago: number[];
  /** Price and terms, and the 12-month goal, as the coach wrote them in the Blueprint. */
  blueprint_fee_text: string | null;
  blueprint_goal_text: string | null;
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

const cardCache = new Map<string, { at: number; numbers: FunnelNumbers }>();
const CARD_TTL = 10 * 60_000;

/** The same numbers for the coach card, cached 10 minutes per coach so Ava does not wait 1 to 3 seconds every turn. */
export async function cachedFunnelNumbers(coachId: string): Promise<FunnelNumbers> {
  const hit = cardCache.get(coachId);
  if (hit && Date.now() - hit.at < CARD_TTL) return hit.numbers;
  const numbers = await loadFunnelNumbers(coachId);
  cardCache.set(coachId, { at: Date.now(), numbers });
  return numbers;
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

  type Field = { value?: unknown } | null | undefined;
  const payload = (practice.data?.payload ?? {}) as {
    practice?: { capacity?: Field; min_fee?: Field; goal_12_months?: Field };
  };
  const text = (f: Field) => (typeof f?.value === "string" && f.value.trim() ? f.value.trim() : null);
  const since180 = new Date(now - 180 * DAY).toISOString();

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
    clients_won_180d: clientsSince(since180),
    client_join_months_ago: joined.filter(Number.isFinite).map((t) => Math.floor((now - t) / (30.44 * DAY))),
    blueprint_fee_text: text(payload.practice?.min_fee),
    blueprint_goal_text: text(payload.practice?.goal_12_months),
  };
}

/** Marketing or sales, volume (not enough people) or rate (not enough of them turning), for each stage. */
export const STAGE_KIND: Record<ConstraintStage, { side: "marketing" | "sales" | "delivery"; kind: "volume" | "rate" | "capacity" }> = {
  delivery: { side: "delivery", kind: "capacity" },
  clients: { side: "sales", kind: "rate" },
  calls: { side: "sales", kind: "rate" },
  replies: { side: "marketing", kind: "rate" },
  accepts: { side: "marketing", kind: "rate" },
  people: { side: "marketing", kind: "volume" },
  on_track: { side: "marketing", kind: "volume" },
};

const RATE_WORDS: Record<RateId, string> = {
  outbound_to_interested: "outbound to interested",
  inbound_to_interested: "inbound to interested",
  interested_to_booked: "interested to booked",
  calls_to_client: "calls to clients",
};
const pc = (n: number) => `${Math.round(n * 1000) / 10}%`;

/**
 * The short version for the coach card, so Ava always has the constraint in view, not only when asked
 * (Zander, 5 Nov 2026). Inbound, months kept and the goal are unknown here, so it says what it assumed.
 */
export function constraintCardLines(n: FunnelNumbers): string[] {
  const d = diagnose(n);
  const m = d.model;
  const k = STAGE_KIND[d.constraint.stage];
  const every = m.signing_pace;
  const below = d.rates.filter((r) => r.band === "below_good" && r.actual != null);
  return [
    `## Their numbers and constraint`,
    `Keep this in view in every answer, not only when they ask what is holding them back. When what they ask for will not move this constraint, say so in a line and offer what would. Open \`constraint\` to go through it properly; it also has the lead sources they could do more of.`,
    `- Last 30 days: ${n.invites_30d} invites, ${n.interested_30d} interested, ${n.calls_booked_30d} calls booked. Clients signed in 180 days: ${n.clients_won_180d} (${every}).`,
    m.signed_per_month > 0
      ? `- At this pace they top out at about ${m.ceiling_clients} clients, £${(m.ceiling_income ?? 0).toLocaleString("en-GB")} a month (£${m.fee_month} fee${n.blueprint_fee_text ? "" : ", assumed"}; ${m.months_kept} months kept, assumed). About ${m.clients_now} clients now.`
      : `- No client signed in 180 days, so there is no pace to work from yet: getting the first clients is the job.`,
    `- Likely constraint: ${d.constraint.label} (${k.side}, ${k.kind}). ${d.constraint.why}`,
    ...(below.length
      ? [`- Below Good on the Scoreboard: ${below.map((r) => `${RATE_WORDS[r.rate]} ${pc(r.actual!)} (Good ${pc(r.good)})`).join("; ")}.`]
      : []),
    `- Not in the app: inbound (referrals, posts, website), calls booked elsewhere, how long clients stay. Ask before treating these as fact.`,
  ];
}

/** What the coach can tell Ava that the app cannot see. All optional. */
export type CoachSays = {
  goal_income_month?: number | null;
  fee_month?: number | null;
  months_kept?: number | null;
  inbound_month?: number | null;
  inbound_interested_month?: number | null;
};

/**
 * The whole picture: the one constraint, every rate against the Scoreboard's Good and Great, the income model
 * (ceiling and how long to the goal) and the work-back from the goal. Used by the tool and the coach card.
 */
export function diagnose(n: FunnelNumbers, says: CoachSays = {}) {
  const rates = [
    checkRate("outbound_to_interested", n.interested_30d, n.invites_30d),
    ...(says.inbound_month != null && says.inbound_interested_month != null
      ? [checkRate("inbound_to_interested", says.inbound_interested_month, says.inbound_month)]
      : []),
    checkRate("interested_to_booked", n.calls_booked_30d, n.interested_30d),
    checkRate("calls_to_client", n.clients_won_90d, n.calls_booked_90d),
  ];
  const judged = (id: RateId) => {
    const r = rates.find((x) => x.rate === id);
    return r && r.band !== "too_early" ? r.actual : null;
  };
  const book = judged("interested_to_booked");
  const close = judged("calls_to_client");
  const blueprintFee = moneyIn(n.blueprint_fee_text);
  const fee = says.fee_month ?? blueprintFee ?? DEFAULT_TARGETS.fee;
  const model = practiceModel({
    signed_180d: n.clients_won_180d,
    client_join_months_ago: n.client_join_months_ago,
    fee_month: fee,
    months_kept: says.months_kept ?? DEFAULT_MONTHS_KEPT,
    goal_income_month: says.goal_income_month ?? null,
  });
  const work_back = workBack({
    goal_clients: model.goal_clients,
    months_kept: model.months_kept,
    outbound_month: n.invites_30d,
    inbound_interested_month: says.inbound_interested_month ?? null,
    their_outbound_to_interested: judged("outbound_to_interested"),
    their_interested_to_client: book != null && close != null ? book * close : null,
  });
  const assumed = [
    ...(says.months_kept == null ? [`Clients stay ${DEFAULT_MONTHS_KEPT} months (not asked yet).`] : []),
    ...(says.fee_month == null && blueprintFee != null ? [`Fee £${fee} a month, from their Blueprint price.`] : []),
    ...(says.fee_month == null && blueprintFee == null
      ? [`Fee £${fee} a month, the Scoreboard's starting fee: no price in their Blueprint, so ask.`]
      : []),
    ...(says.goal_income_month == null ? ["No income goal given: read their 12-month goal or ask."] : []),
    ...(says.inbound_month == null ? ["Inbound (referrals, posts, website) not counted: ask."] : []),
  ];
  const constraint = pickConstraint(n);
  return { constraint: { ...constraint, ...STAGE_KIND[constraint.stage] }, rates, model, work_back, assumed };
}

export const constraintTools: AgentToolDef[] = [
  {
    name: "get_funnel_numbers",
    label: "Reading their numbers",
    needsCoach: true,
    description:
      "The active coach's practice in numbers: their client journey (people in campaigns, invites, accepts, replies, interested, calls booked, clients) for the last 30 days with 90- and 180-day counts; each rate against the Scoreboard's Good and Great with whether it is marketing or sales; the income model (clients signed a month × months kept × fee = the ceiling they top out at, and how long to their goal); and the work-back from their goal (people a month needed at their rates, at Good and at Great). Also the one stage the rules pick as the constraint and the capability to open next. Pass what the coach has told you that the app cannot see. Returns scoreboard_link when the coach can open their Scoreboard. Read-only.",
    input_schema: {
      type: "object",
      properties: {
        goal_income_month: { type: "number", description: "Income they want a month, in pounds." },
        fee_month: { type: "number", description: "What a client pays a month, in pounds, if different from the Blueprint." },
        months_kept: { type: "number", description: "How many months a client stays on average." },
        inbound_month: { type: "number", description: "People who come to them a month: referrals, posts, website." },
        inbound_interested_month: { type: "number", description: "Of those, how many are interested in a call a month." },
      },
    },
    run: async (input, ctx) => {
      const coach = coachOf(ctx);
      const numbers = await loadFunnelNumbers(coach.id);
      const num = (k: string) => (typeof input[k] === "number" && Number.isFinite(input[k]) ? (input[k] as number) : null);
      const says: CoachSays = {
        goal_income_month: num("goal_income_month"),
        fee_month: num("fee_month"),
        months_kept: num("months_kept"),
        inbound_month: num("inbound_month"),
        inbound_interested_month: num("inbound_interested_month"),
      };
      // The per-client ages only feed the model; Ava gets the counts.
      const shown: Partial<FunnelNumbers> = { ...numbers };
      delete shown.client_join_months_ago;
      // "Can I show you?": the Scoreboard, which starts from the example and takes their own numbers typed in.
      // Coaches only once it's released (no admin gate).
      const released = !adminPreviewCoachRouteForPath("/coach/scoreboard");
      const scoreboard_link = ctx.mode === "admin" ? "/admin/scoreboard" : released ? "/coach/scoreboard" : null;
      return { coach: coach.name, numbers: shown, ...diagnose(numbers, says), scoreboard_link };
    },
  },
];
