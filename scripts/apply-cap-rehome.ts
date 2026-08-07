/**
 * Apply Coach Action Plan re-home: new CAP activation lessons, renamed
 * moved lessons, and stub content for new builds.
 *
 * Usage:
 *   npx tsx scripts/apply-cap-rehome.ts --dry-run
 *   npx tsx scripts/apply-cap-rehome.ts --apply
 */

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

const apply = process.argv.includes("--apply");
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const COURSE_ID = "coach-action-plan";

type Upsert = {
  course_id: string;
  lesson_id: string;
  title: string;
  body_markdown: string;
  guide_markdown?: string | null;
  is_draft: boolean;
  is_deleted: boolean;
  updated_at: string;
};

const TITLE_UPDATES: Array<{ lesson_id: string; title: string }> = [
  {
    lesson_id:
      "coach-action-plan-the-10k-mo-plan-the-10k-mo-blueprint-your-bridge-to-success",
    title: "🎯 Your £10k/mo Profit Coach Model & Path",
  },
  {
    lesson_id:
      "coach-action-plan-the-10k-mo-plan-how-to-achieve-results-the-formula-for-business-coach-success",
    title: "📊 Volume x Conversion: The Only Formula That Matters",
  },
  {
    lesson_id:
      "coach-action-plan-building-a-world-class-coaching-practice-57m-what-are-people-actually-buying-the-gap",
    title: "🧩 The Gap: What Clients Are Really Buying",
  },
  {
    lesson_id:
      "coach-action-plan-building-a-world-class-coaching-practice-57m-structuring-your-coaching-offer-what-are-you-actually-selling",
    title: "🧱 How To Structure Your Coaching Offer",
  },
  {
    lesson_id:
      "coach-action-plan-building-a-world-class-coaching-practice-57m-pricing-setting-the-right-packages-investment-for-your-coaching",
    title: "💷 Pricing & Payment Options",
  },
  {
    lesson_id:
      "coach-action-plan-building-a-world-class-coaching-practice-57m-daily-checklist-of-a-world-class-coach",
    title: "📋 The D.A.I.L.Y Success Framework (Reference)",
  },
];

function stubs(now: string): Upsert[] {
  return [
    {
      course_id: COURSE_ID,
      lesson_id: "coach-action-plan-academy-curriculum-overview",
      title: "📚 Academy Curriculum Overview (Written)",
      is_draft: false,
      is_deleted: false,
      updated_at: now,
      body_markdown: [
        "Written map of the Academy curriculum and ProCoach roadmap.",
        "",
        "This sits under **Your £10k/mo Profit Coach Model & Path** so the video can stay short — the full tour lives here as text, not in the script.",
        "",
        "**In this page**",
        "",
        "- How Get Calls, Win Clients, and Coach Clients fit the 6-client / £10k model",
        "- Where Going Pro and Profit Coach OS sit alongside",
        "- Suggested order for your first 90 days",
      ].join("\n"),
      guide_markdown: [
        "## How the classroom maps to £10k/mo",
        "",
        "Six clients at roughly £1,500–£2,000/mo is the default Profit Coach model.",
        "",
        "| Pillar (old label) | Classroom path | Job |",
        "| --- | --- | --- |",
        "| Campaigns | **Get Calls** | Volume of conversations → booked calls |",
        "| Conversion | **Win Clients** | Offer, pricing, value sessions, sales calls |",
        "| Coaching | **Coach Clients** | Delivery that retains and expands |",
        "",
        "## Suggested first-90-day order",
        "",
        "1. Finish **Coach Action Plan** (activation).",
        "2. Run **Going Pro** Day Zero alongside (one session / week).",
        "3. Enter **Get Calls** or **Win Clients** / **Coach Clients** based on your lane from the 90-day plan.",
        "",
        "## ProCoach roadmap (written)",
        "",
        "_Expand this section with the full curriculum tour that used to live in the blueprint video — module list, what each unlocks, and when to skip vs go deep._",
      ].join("\n"),
    },
    {
      course_id: COURSE_ID,
      lesson_id: "coach-action-plan-profit-coach-snapshot-and-targets",
      title: "📸 Profit Coach Snapshot & Targets",
      is_draft: true,
      is_deleted: false,
      updated_at: now,
      body_markdown: [
        "Implementation sheet: where you are now, the 12–24 month good outcome, and your 90-day focus.",
        "",
        "**In this lesson**",
        "",
        "- Current income / hours / clients",
        "- 12–24 month “good outcome”",
        "- 90-day focus (one primary lane)",
      ].join("\n"),
      guide_markdown: [
        "## Snapshot (fill in)",
        "",
        "| | Today | Notes |",
        "| --- | --- | --- |",
        "| Monthly coaching income |  |  |",
        "| Paying clients |  |  |",
        "| Hours / week on the business |  |  |",
        "",
        "## 12–24 month good outcome",
        "",
        "- Target monthly revenue: £____",
        "- Target client count: ____",
        "- Lifestyle / hours constraint: ____",
        "",
        "## 90-day focus",
        "",
        "One sentence: what must be true in 90 days for this to feel on track?",
        "",
        "_Draft lesson — replace with the final implementation sheet / video when ready._",
      ].join("\n"),
    },
    {
      course_id: COURSE_ID,
      lesson_id: "coach-action-plan-design-your-week-and-pick-your-pace",
      title: "📅 Design Your Week & Pick Your Pace",
      is_draft: true,
      is_deleted: false,
      updated_at: now,
      body_markdown: [
        "Block real calendar time for Delivery, Acquisition, Interest Follow-up, Lead Gen, and You — then pick Bamboo, Horse, or Racecar pace.",
        "",
        "**In this lesson**",
        "",
        "- D.A.I.L.Y categories (labels only — full reference lives in Going Pro)",
        "- Example: 2 × 90-min sessions / month + stacked coaching days",
        "- Choose your pace and put it in the calendar",
      ].join("\n"),
      guide_markdown: [
        "## D.A.I.L.Y (labels only)",
        "",
        "- **D** — Delivery (client work)",
        "- **A** — Acquisition (sales conversations / calls)",
        "- **I** — Interest follow-up (warm leads)",
        "- **L** — Lead gen (outbound / content that starts conversations)",
        "- **Y** — You (energy, admin, Going Pro)",
        "",
        "Full bullet lists and the spreadsheet live in **Going Pro → The D.A.I.L.Y Success Framework (Reference)**.",
        "",
        "## Coaching-day example (visual only)",
        "",
        "Many Profit Coaches run **2 × 90-minute sessions per client per month**, stacked on specific coaching days so the rest of the week stays free for acquisition.",
        "",
        "## Pick your pace",
        "",
        "| Pace | Feel | Typical weekly outbound / conversations |",
        "| --- | --- | --- |",
        "| **Bamboo** | Steady, sustainable | Lower volume, high consistency |",
        "| **Horse** | Default build pace | Medium volume |",
        "| **Racecar** | Sprint (time-boxed) | High volume, short window |",
        "",
        "### This week’s job",
        "",
        "1. Open your calendar.",
        "2. Block time for each D.A.I.L.Y letter.",
        "3. Circle Bamboo / Horse / Racecar and protect it for 90 days.",
        "",
        "_Draft lesson — film/shorten from Structuring Offer + Daily Checklist excerpts when ready._",
      ].join("\n"),
    },
    {
      course_id: COURSE_ID,
      lesson_id: "coach-action-plan-90-day-client-plan",
      title: "🗺️ 90-Day Client Plan",
      is_draft: true,
      is_deleted: false,
      updated_at: now,
      body_markdown: [
        "Pick your starting lane, set weekly activity commitments, and link into the exact next lessons in Get Calls / Win Clients / Coach Clients.",
        "",
        "**In this lesson**",
        "",
        "- Starting lane (e.g. warm network or LinkedIn)",
        "- Weekly activity commitments",
        "- Exact next lessons in the core paths",
      ].join("\n"),
      guide_markdown: [
        "## 1. Pick your starting lane",
        "",
        "- [ ] Warm network / referrals",
        "- [ ] LinkedIn outbound",
        "- [ ] Existing clients → Coach Clients first",
        "- [ ] Other: ________",
        "",
        "## 2. Weekly commitments (90 days)",
        "",
        "| Activity | Weekly target | Calendar block |",
        "| --- | --- | --- |",
        "| Conversations started |  |  |",
        "| Follow-ups |  |  |",
        "| Value sessions / sales calls |  |  |",
        "| Delivery sessions |  |  |",
        "",
        "## 3. Exact next lessons",
        "",
        "| If you… | Start here |",
        "| --- | --- |",
        "| Need conversations / calls | **Get Calls** → Volume x Conversion, then Ideal Clients |",
        "| Need offer / pricing / enrolment | **Win Clients** → Offer & Sales Foundations |",
        "| Already have clients to coach | **Coach Clients** (path tile) |",
        "",
        "_Draft lesson — flesh with lane-specific defaults and deep links when ready._",
      ].join("\n"),
    },
  ];
}

const L1_BODY = [
  "The Profit Coach model: ~6 clients ≈ £10k/mo, via Get Calls (Campaigns), Win Clients (Conversion), and Coach Clients (Coaching).",
  "",
  "**In this lesson**",
  "",
  "- 6-clients = £10k/mo model",
  "- Three pillars mapped to Classroom paths",
  "- Simple reverse-engineered cashflow (more customers / more value per customer)",
  "",
  "Full curriculum & ProCoach roadmap → written page under this lesson (not in the video).",
].join("\n");

async function main() {
  const now = new Date().toISOString();
  console.log(`Mode: ${apply ? "APPLY" : "dry-run"}`);

  for (const row of TITLE_UPDATES) {
    console.log(`title → ${row.lesson_id} => ${row.title}`);
    if (apply) {
      const { error } = await supabase
        .from("academy_lesson_content")
        .update({ title: row.title, updated_at: now })
        .eq("course_id", COURSE_ID)
        .eq("lesson_id", row.lesson_id);
      if (error) {
        console.error(error.message);
        process.exit(1);
      }
    }
  }

  if (apply) {
    const { error } = await supabase
      .from("academy_lesson_content")
      .update({ body_markdown: L1_BODY, updated_at: now })
      .eq("course_id", COURSE_ID)
      .eq(
        "lesson_id",
        "coach-action-plan-the-10k-mo-plan-the-10k-mo-blueprint-your-bridge-to-success",
      );
    if (error) {
      console.error("L1 body:", error.message);
      process.exit(1);
    }
    console.log("Updated L1 overview body (guide left for trim pass)");
  } else {
    console.log("Would update L1 overview body");
  }

  const rows = stubs(now);
  for (const row of rows) {
    console.log(
      `upsert ${row.lesson_id} draft=${row.is_draft} body=${row.body_markdown.length} guide=${(row.guide_markdown ?? "").length}`,
    );
  }
  if (apply) {
    const { error } = await supabase.from("academy_lesson_content").upsert(rows, {
      onConflict: "course_id,lesson_id",
    });
    if (error) {
      console.error(error.message);
      process.exit(1);
    }
    console.log(`Upserted ${rows.length} lessons`);
  }
}

void main();
