import { isProspectCall } from "@/lib/coachHealth";
import { loadFunnelNumbers } from "@/lib/agent/tools/constraint";
import { moneyIn } from "@/lib/agent/tools/practiceModel";
import { DEFAULT_TARGETS, type Numbers } from "@/lib/scoreboard";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Scoreboard V2 (Zander, 5 Nov 2026): the coach's own numbers from their data instead of starting at the targets.
 * Each number says where it came from. A step with too little data, or one the app does not track (show rates,
 * how long clients stay), uses the target and says so. Same counting as Ava's constraint tool.
 */

const DAY = 86_400_000;
/** Prospects that came to the coach rather than being reached out to. */
const INBOUND_SOURCES = ["boss_score", "lead_capture", "booking"];
const ROADMAP_CAL = /roadmap/i;

export type FromKind = "data" | "target";
export type NumberFrom = { kind: FromKind; text: string };
export type ScoreboardData = {
  numbers: Numbers;
  from: Record<keyof Numbers, NumberFrom>;
};

const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;

export async function loadScoreboardData(coachId: string): Promise<ScoreboardData> {
  const now = Date.now();
  const since30 = new Date(now - 30 * DAY).toISOString();
  const since90 = new Date(now - 90 * DAY).toISOString();

  const [funnel, ghl, bookings, inbound, fees] = await Promise.all([
    loadFunnelNumbers(coachId),
    supabaseAdmin
      .from("ghl_appointments")
      .select("calendar_name, prospect_name, created_at, status_normalized")
      .eq("coach_id", coachId)
      .gte("created_at", since90)
      .limit(5000),
    supabaseAdmin
      .from("bookings")
      .select("created_at, status")
      .eq("coach_id", coachId)
      .eq("kind", "discovery")
      .gte("created_at", since90)
      .limit(5000),
    supabaseAdmin
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("coach_id", coachId)
      .in("prospect_source", INBOUND_SOURCES)
      .gte("created_at", since30),
    supabaseAdmin
      .from("contacts")
      .select("client_fee_amount")
      .eq("coach_id", coachId)
      .eq("type", "client")
      .not("client_fee_amount", "is", null)
      .limit(1000),
  ]);
  for (const res of [ghl, bookings, inbound, fees]) if (res.error) throw new Error(res.error.message);

  // Constraint Calls and Profit Roadmap calls, by when they were booked. App bookings are Constraint Calls.
  let calls30 = 0;
  let calls90 = 0;
  let roadmaps90 = 0;
  for (const a of ghl.data ?? []) {
    if (a.status_normalized === "cancelled" || !isProspectCall(a.calendar_name, a.prospect_name)) continue;
    if (ROADMAP_CAL.test(String(a.calendar_name ?? ""))) {
      roadmaps90 += 1;
      continue;
    }
    calls90 += 1;
    if (Date.parse(a.created_at as string) >= Date.parse(since30)) calls30 += 1;
  }
  for (const b of bookings.data ?? []) {
    if (b.status === "cancelled") continue;
    calls90 += 1;
    if (Date.parse(b.created_at as string) >= Date.parse(since30)) calls30 += 1;
  }

  const T = DEFAULT_TARGETS;
  const data = (text: string): NumberFrom => ({ kind: "data", text });
  const target = (text: string): NumberFrom => ({ kind: "target", text: `Your target. ${text}` });
  const numbers = { ...T, outbound: 0, inbound: 0 } as Numbers;
  const from = {} as Record<keyof Numbers, NumberFrom>;

  numbers.outbound = funnel.invites_30d;
  from.outbound = data(
    funnel.sales_robot && funnel.campaigns_running === 0
      ? "LinkedIn invites sent in the app in the last 30 days. Outreach on Sales Robot isn't counted."
      : "LinkedIn invites sent in the last 30 days."
  );

  if (funnel.invites_30d >= 300) {
    numbers.outboundRate = funnel.interested_30d / funnel.invites_30d;
    from.outboundRate = data(`${funnel.interested_30d} interested from ${funnel.invites_30d} invites in the last 30 days.`);
  } else {
    from.outboundRate = target(`Too early to judge: ${funnel.invites_30d} invites in 30 days, and it needs 300.`);
  }

  numbers.inbound = inbound.count ?? 0;
  from.inbound = data(
    "Website, BOSS Score and booking-page leads in the last 30 days. Referrals aren't tracked: type yours, or add them as a lead source."
  );
  from.inboundRate = target("The app doesn't track how many inbound leads are interested yet.");

  const interested = funnel.interested_30d + numbers.inbound * numbers.inboundRate;
  if (interested >= 4) {
    numbers.interestToBook = Math.min(1, calls30 / interested);
    from.interestToBook = data(`${calls30} Constraint Calls booked in 30 days, from about ${Math.round(interested)} interested.`);
  } else {
    from.interestToBook = target(`Too early to judge: ${Math.round(interested)} interested in 30 days, and it needs 4.`);
  }

  from.callShow = target("Show rates aren't tracked: the calendar doesn't record no-shows.");
  from.roadmapShow = target("Show rates aren't tracked: the calendar doesn't record no-shows.");

  const roadmapTracked = roadmaps90 > 0;
  if (roadmapTracked && calls90 >= 5) {
    numbers.callToRoadmap = Math.min(1, roadmaps90 / calls90);
    from.callToRoadmap = data(`${roadmaps90} roadmap calls from ${calls90} Constraint Calls in the last 90 days.`);
  } else {
    from.callToRoadmap = target(
      roadmapTracked
        ? `Too early to judge: ${calls90} Constraint Calls in 90 days, and it needs 5.`
        : "No roadmap calls on your calendar, so this can't be told apart from the close."
    );
  }

  const won = funnel.clients_won_90d;
  if (roadmapTracked && roadmaps90 >= 3) {
    numbers.closeRate = Math.min(1, won / roadmaps90);
    from.closeRate = data(`${won} new clients from ${roadmaps90} roadmap calls in the last 90 days.`);
  } else if (calls90 >= 5) {
    const reach = calls90 * numbers.callShow * numbers.callToRoadmap * numbers.roadmapShow;
    numbers.closeRate = reach > 0 ? Math.min(1, won / reach) : 0;
    from.closeRate = data(
      `${won} new clients from ${calls90} calls in the last 90 days (${pct(numbers.closeRate)} once the steps before it are counted).`
    );
  } else {
    from.closeRate = target(`Too early to judge: ${calls90} calls in 90 days, and it needs 5.`);
  }

  from.months = target("Clients have no end date in the app, so how long they stay isn't known yet.");

  const feeRows = (fees.data ?? []).map((r) => Number(r.client_fee_amount)).filter((n) => Number.isFinite(n) && n > 0);
  const blueprintFee = moneyIn(funnel.blueprint_fee_text);
  if (feeRows.length) {
    numbers.fee = Math.round(feeRows.reduce((a, b) => a + b, 0) / feeRows.length);
    from.fee = data(`The average fee of the ${feeRows.length} client${feeRows.length === 1 ? "" : "s"} with a fee in your list.`);
  } else if (blueprintFee) {
    numbers.fee = blueprintFee;
    from.fee = data("Your price in the Blueprint.");
  } else {
    from.fee = target("No fee in your client list or Blueprint yet.");
  }

  return { numbers, from };
}
