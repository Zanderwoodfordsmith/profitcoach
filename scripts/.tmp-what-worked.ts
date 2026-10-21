import { writeFileSync } from "node:fs";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { fetchAllSupabasePages } from "../src/lib/contactsSchemaSafeSelect";

loadEnvConfig(process.cwd());

const WINNER_HINTS = [
  "will walsh",
  "daniel oosthuizen",
  "hilary mcnair",
  "hilary mcnair",
  "john mccarthy",
  "john harrier",
  "daniel andersen",
];

function letters(s: string) {
  return s.toLowerCase().replace(/[^a-z]/g, "");
}

function classify(text: string): string {
  const t = (text || "").toLowerCase();
  if (!t.trim()) return "empty";
  if (
    /boss|scorecard|3-minute|3 minute|business health check|health check/.test(t)
  ) {
    return "scorecard";
  }
  if (
    /rapidly feeling less chaotic|i know how busy you must be|free coaching discovery call|perhaps you've been so busy|circling back on this/.test(
      t
    )
  ) {
    return "generic_bca";
  }
  if (
    /i ask because|i used a simple system|during my|at trailfinders|grew .* from|£\d|\$\d/.test(
      t
    )
  ) {
    return "proof";
  }
  if (
    /what('s| is) the biggest|are you looking|are you aiming|would you|curious/.test(
      t
    )
  ) {
    return "question";
  }
  return "other";
}

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const coachesPage = await fetchAllSupabasePages<{
    id: string;
    slug: string;
    has_sales_robot_account: boolean | null;
    recurring_payment_status: string | null;
    profiles: { full_name: string | null } | { full_name: string | null }[] | null;
  }>(async (from, to) =>
    sb
      .from("coaches")
      .select(
        "id, slug, has_sales_robot_account, recurring_payment_status, profiles(full_name)"
      )
      .range(from, to)
  );

  const coaches = (coachesPage.data ?? []).map((c) => {
    const profile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
    return {
      id: c.id,
      slug: c.slug,
      name: profile?.full_name || c.slug,
      connector: !!c.has_sales_robot_account,
      billing: c.recurring_payment_status,
    };
  });

  const winners = coaches.filter((c) =>
    WINNER_HINTS.some(
      (h) =>
        letters(c.name).includes(letters(h)) ||
        letters(c.slug).includes(letters(h.split(" ").pop() || h))
    )
  );
  console.log("Winners found:");
  for (const w of winners) console.log(" ", w.name, w.slug);

  const harrier = coaches.filter(
    (c) =>
      letters(c.name).includes("harrier") ||
      letters(c.slug).includes("harrier") ||
      letters(c.name).includes("john") && letters(c.name).includes("harr")
  );
  console.log("Harrier candidates:", harrier.map((c) => `${c.name} ${c.slug}`));

  const campaignsPage = await fetchAllSupabasePages<{
    id: string;
    coach_id: string;
    name: string;
    status: string;
    created_at: string | null;
  }>(async (from, to) =>
    sb
      .from("linkedin_campaigns")
      .select("id, coach_id, name, status, created_at")
      .range(from, to)
  );

  const stepsPage = await fetchAllSupabasePages<{
    campaign_id: string;
    position: number;
    step_type: string;
    body: string | null;
    wait_hours: number | null;
  }>(async (from, to) =>
    sb
      .from("linkedin_campaign_steps")
      .select("campaign_id, position, step_type, body, wait_hours")
      .range(from, to)
  );

  const leadsPage = await fetchAllSupabasePages<{
    campaign_id: string;
    status: string;
  }>(async (from, to) =>
    sb
      .from("linkedin_campaign_leads")
      .select("campaign_id, status")
      .range(from, to)
  );

  const coachById = new Map(coaches.map((c) => [c.id, c]));
  const stepsByCampaign = new Map<string, typeof stepsPage.data>();
  for (const step of stepsPage.data ?? []) {
    const list = stepsByCampaign.get(step.campaign_id) ?? [];
    list.push(step);
    stepsByCampaign.set(step.campaign_id, list);
  }
  const leadCounts = new Map<string, Record<string, number>>();
  for (const lead of leadsPage.data ?? []) {
    const bucket = leadCounts.get(lead.campaign_id) ?? {};
    bucket[lead.status] = (bucket[lead.status] || 0) + 1;
    leadCounts.set(lead.campaign_id, bucket);
  }

  const campaigns = (campaignsPage.data ?? []).map((camp) => {
    const coach = coachById.get(camp.coach_id);
    const counts = leadCounts.get(camp.id) ?? {};
    const people = Object.values(counts).reduce((a, b) => a + b, 0);
    const replied = counts.replied || 0;
    const accepted =
      (counts.connected || 0) +
      (counts.in_sequence || 0) +
      (counts.completed || 0) +
      replied;
    const invited = counts.invited || 0;
    const steps = (stepsByCampaign.get(camp.id) ?? []).sort(
      (a, b) => a.position - b.position
    );
    const invite = steps.find((s) => s.step_type === "invite");
    const messages = steps.filter((s) => s.step_type === "message");
    const waits = steps
      .filter((s) => s.step_type === "wait")
      .map((s) => s.wait_hours || 0);
    return {
      id: camp.id,
      name: camp.name,
      status: camp.status,
      created_at: camp.created_at,
      coach: coach?.name || "?",
      slug: coach?.slug || "",
      winner: winners.some((w) => w.id === camp.coach_id),
      people,
      replied,
      accepted,
      invited,
      replyRate: people ? replied / people : 0,
      acceptRate: people ? accepted / people : 0,
      inviteAcceptRate:
        invited + accepted > 0 ? accepted / (invited + accepted) : 0,
      inviteClass: classify(invite?.body || ""),
      invitePreview: (invite?.body || "").replace(/\s+/g, " ").slice(0, 220),
      messageClasses: messages.map((m) => classify(m.body || "")),
      firstMessagePreview: (messages[0]?.body || "")
        .replace(/\s+/g, " ")
        .slice(0, 220),
      messageCount: messages.length,
      waitHours: waits,
    };
  });

  const archived = campaigns.filter((c) => c.status === "archived" && c.people > 0);
  archived.sort((a, b) => b.replyRate - a.replyRate);

  const byClass = new Map<
    string,
    { campaigns: number; people: number; replied: number; accepted: number }
  >();
  for (const c of archived) {
    const bucket = byClass.get(c.inviteClass) ?? {
      campaigns: 0,
      people: 0,
      replied: 0,
      accepted: 0,
    };
    bucket.campaigns += 1;
    bucket.people += c.people;
    bucket.replied += c.replied;
    bucket.accepted += c.accepted;
    byClass.set(c.inviteClass, bucket);
  }

  const byCoach = new Map<
    string,
    { people: number; replied: number; accepted: number; campaigns: number }
  >();
  for (const c of archived) {
    const bucket = byCoach.get(c.coach) ?? {
      people: 0,
      replied: 0,
      accepted: 0,
      campaigns: 0,
    };
    bucket.people += c.people;
    bucket.replied += c.replied;
    bucket.accepted += c.accepted;
    bucket.campaigns += 1;
    byCoach.set(c.coach, bucket);
  }

  const out = {
    winners: winners.map((w) => ({
      ...w,
      campaigns: campaigns.filter((c) => c.slug === w.slug).length,
      archived: campaigns.filter((c) => c.slug === w.slug && c.status === "archived")
        .length,
    })),
    harrier,
    classStats: [...byClass.entries()].map(([k, v]) => ({
      inviteClass: k,
      ...v,
      replyRate: v.people ? v.replied / v.people : 0,
      acceptRate: v.people ? v.accepted / v.people : 0,
    })),
    coachStats: [...byCoach.entries()]
      .map(([coach, v]) => ({
        coach,
        ...v,
        replyRate: v.people ? v.replied / v.people : 0,
        acceptRate: v.people ? v.accepted / v.people : 0,
      }))
      .sort((a, b) => b.replyRate - a.replyRate),
    topReply: archived.filter((c) => c.people >= 50).slice(0, 20),
    bottomReply: archived
      .filter((c) => c.people >= 200)
      .sort((a, b) => a.replyRate - b.replyRate)
      .slice(0, 12),
    winnerCampaigns: campaigns.filter((c) => c.winner),
    totals: {
      campaigns: archived.length,
      people: archived.reduce((a, c) => a + c.people, 0),
      replied: archived.reduce((a, c) => a + c.replied, 0),
      accepted: archived.reduce((a, c) => a + c.accepted, 0),
    },
  };

  writeFileSync("/tmp/what-worked.json", JSON.stringify(out, null, 2));
  console.log(
    `\nArchived campaigns ${out.totals.campaigns} people ${out.totals.people} replied ${out.totals.replied} (${((out.totals.replied / out.totals.people) * 100).toFixed(2)}%)`
  );
  console.log("\nInvite class:");
  for (const row of out.classStats.sort((a, b) => b.replyRate - a.replyRate)) {
    console.log(
      `  ${row.inviteClass.padEnd(14)} n=${row.campaigns} people=${row.people} reply=${(row.replyRate * 100).toFixed(2)}% accept=${(row.acceptRate * 100).toFixed(2)}%`
    );
  }
  console.log("\nTop reply (50+ people):");
  for (const c of out.topReply.slice(0, 12)) {
    console.log(
      `  ${(c.replyRate * 100).toFixed(1)}%  ${c.coach} / ${c.name}  ${c.people}p  invite=${c.inviteClass}`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
