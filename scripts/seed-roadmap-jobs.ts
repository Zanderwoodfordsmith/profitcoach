/**
 * Seed roadmap_jobs with the consolidated plan (22 Aug 2026).
 *
 * Granularity rule: a job = an outcome/deliverable; steps and inputs live on
 * its checklist. Blockers go in blocked_by (red flag), not separate cards.
 *
 * Usage:
 *   npx tsx scripts/seed-roadmap-jobs.ts           # seeds only if table empty
 *   npx tsx scripts/seed-roadmap-jobs.ts --reset   # wipes and reseeds
 */
import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

type Seed = {
  title: string;
  area: string;
  status?: "todo" | "up_next" | "in_progress" | "done" | "live" | "parked";
  notes?: string;
  blocked_by?: string;
  app_path?: string;
  sort_order?: number;
  /** Checklist items; prefix with "x " to seed as already done. */
  checklist?: string[];
};

const SEEDS: Seed[] = [
  // ── Beat 1 — September relaunch ────────────────────────────────────────
  {
    area: "beat1",
    sort_order: 1,
    status: "up_next",
    title: "Release the acquisition core to coaches",
    notes:
      "Flip the admin-preview gates so coaches get First Campaign, Ideal Client and the Create hub. This IS the relaunch — it is already built.",
    blocked_by: "Zander: pick Lead Finder reveal/export caps",
    checklist: [
      "Remove adminPreview from First Campaign tab",
      "Remove adminPreview from Ideal Client + Create",
      "Remove coach-route redirects (ADMIN_PREVIEW_COACH_ROUTES)",
      "Set per-coach Lead Finder caps (suggested 250 list / 50 reveals per month)",
      "QA walkthrough of the wizard end-to-end (punch list)",
      "Pilot with 2\u20133 real coaches",
    ],
  },
  {
    area: "beat1",
    sort_order: 2,
    title: "Switch on native booking + Conversations",
    notes:
      "Native Google booking becomes the default and the Conversations inbox ships with it \u2014 booking replies already route there via conversationReplyToAddress.",
    checklist: [
      "StartApplyPanel default \u2192 native embed (GHL iframe becomes fallback)",
      "Un-gate multi-calendar settings (currently viewerIsAdmin only)",
      "Release the Conversations tab to coaches",
      "Coach 'you got a booking' notification email (today only the Google Calendar event)",
    ],
  },
  {
    area: "beat1",
    sort_order: 3,
    title: "Profile Optimizer: launch scope",
    notes:
      "Ship headline + About + banner copy only. Multi-role experience editing is phase 2 \u2014 that turns 'needs finishing' into days.",
    app_path: "/admin/linkedin-profile",
    checklist: [
      "Polish headline + About + banner copy flows",
      "Hide/disable past-role editing for launch",
    ],
  },
  {
    area: "beat1",
    sort_order: 4,
    title: "'Activated in an hour' onboarding path",
    notes:
      "Join \u2192 First Campaign wizard \u2192 calendar connected \u2192 starter list exported. One golden path; the September story.",
    checklist: [
      "Wire join flow into the First Campaign wizard",
      "Calendar connect step inside onboarding",
      "Record the relaunch demo video from the pilot",
    ],
  },
  {
    area: "beat1",
    sort_order: 5,
    title: "Classroom: swap Sales Nav videos for the tools",
    notes:
      "Replace the five click-by-click Sales Navigator videos with short 'use the tool' lessons.",
    checklist: ["Get Calls group", "Win Clients group"],
  },
  {
    area: "beat1",
    sort_order: 6,
    title: "Remove legacy unauthenticated /api/message-generator",
    notes: "Security housekeeping \u2014 endpoint has no auth.",
  },

  // ── Beat 2 — Content studio (mid-September) ────────────────────────────
  {
    area: "beat2",
    sort_order: 1,
    title: "Content studio for coaches",
    notes:
      "LinkedIn publishing is already per-user under the hood (OAuth tokens + scheduled posts key on user_id). Built in the artifact + AI-panel pattern \u2014 the composer is the canvas, the brain drafts beside it.",
    blocked_by: "LinkedIn developer console: verify scopes for all members",
    app_path: "/admin/linkedin",
    checklist: [
      "Coach access to the Content tab",
      "Connect-LinkedIn flow in coach settings",
      "Verify LinkedIn app scopes approved for arbitrary members",
      "Post template library (editable)",
      "AI panel drafts \u2192 Compose seed",
      "'Month of posts' generation from brain + templates",
    ],
  },

  // ── Website ─────────────────────────────────────────────────────────────
  {
    area: "website",
    sort_order: 1,
    title: "Profit System graphics as code SVG components",
    notes:
      "Rebuild the four PNGs (three-pillars, five-levels, nine-step-roadmap, owner-pyramid) as recolorable/animatable React SVG components, updated to the new model. Pattern: ProfitSystemTriadDiagram.tsx. Reusable on the site, in BOSS reports, and in coach content.",
    blocked_by: "Zander: Figma frame links + what the model update changed",
    checklist: [
      "three-pillars",
      "five-levels (+ the five Owner-level icons)",
      "nine-step-roadmap",
      "owner-pyramid",
    ],
  },
  {
    area: "website",
    sort_order: 2,
    title: "Profit Coach homepage",
    notes:
      "EMyth-style arc: pain \u2192 model graphic \u2192 how it works \u2192 results with numbers \u2192 offer. new-home (966 lines) is the starting point; skeleton can start before the graphics land. Keep PROFIT_COACH_FUNNEL_BASE_URL as a reversible fallback.",
    app_path: "/new-home",
    checklist: [
      "EMyth how-it-works screenshot + reference designs (Zander hunting)",
      "EMyth-style structural pass on new-home",
      "Primary CTA = BOSS assessment (lead-gen habit for the partner model)",
      "Drop in the new Profit System graphics",
      "Promote to / and retire the funnel redirect + mirror hack",
    ],
  },

  // ── AI panel ────────────────────────────────────────────────────────────
  {
    area: "ai-panel",
    sort_order: 1,
    status: "in_progress",
    title: "AI panel v1 (docked + roadmap actions)",
    notes:
      "ClickUp-style docked panel with screen context and the coach brain, plus the first real actions (roadmap jobs over mutation cores). Admin-only.",
    app_path: "/admin/roadmap",
    checklist: [
      "x Docked panel: push, fullscreen, screen context, brain",
      "x Roadmap tools: speak-to-update jobs from any screen",
      "Zander UX feedback pass (width, tone, per-page default skills)",
      "Push to production",
    ],
  },
  {
    area: "ai-panel",
    sort_order: 2,
    title: "Member-facing product roadmap page",
    notes:
      "Show members-visible jobs as a public 'what's coming' roadmap + announcement flow. visibility flag + RLS read policy already in place.",
  },

  // ── Q4 epics (parked until their month) ────────────────────────────────
  {
    area: "q4",
    sort_order: 1,
    status: "parked",
    title: "October epic: close the sending gap",
    checklist: [
      "Pick automation route: Unipile-style API vs extension scale-up vs Connect AI handoff",
      "Outreach queue + per-lead send status in the CRM",
      "Release Pipeline to coaches",
    ],
  },
  {
    area: "q4",
    sort_order: 2,
    status: "parked",
    title: "November epic: done-for-you groundwork",
    checklist: [
      "Admin-run campaigns per coach (40% partner model, manual first)",
      "Release the client coaching workspace tabs",
      "VocalLab first consumer: voice notes on content",
      "Classroom consolidation pass 2 (Coach Clients: 147 lessons)",
    ],
  },
  {
    area: "q4",
    sort_order: 3,
    status: "parked",
    title: "December epic: the sidekick",
    checklist: [
      "Brain panel + actions on every surface",
      "'Set my availability' style setup actions",
      "GHL sunset decision based on native booking adoption",
      "Leads database expansion beyond UK owners",
    ],
  },
  {
    area: "general",
    sort_order: 1,
    status: "parked",
    title: "Slides / reshooting the product",
    notes: "Separate decision, not launch-blocking.",
  },
  {
    area: "general",
    sort_order: 2,
    status: "parked",
    title: "Overnight agent loops on roadmap jobs",
    notes:
      "Agents pick up scoped todo jobs (Cursor SDK / automations) and report progress as comments. Requires crisp scope notes per job.",
  },
];

function toChecklist(items: string[] | undefined) {
  if (!items) return [];
  return items.map((raw) => {
    const done = raw.startsWith("x ");
    return {
      id: randomUUID(),
      text: done ? raw.slice(2) : raw,
      done,
    };
  });
}

async function main() {
  loadEnvLocal();
  const reset = process.argv.includes("--reset");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
  }
  const supabase = createClient(url, key);

  const { count, error: countError } = await supabase
    .from("roadmap_jobs")
    .select("id", { count: "exact", head: true });
  if (countError) throw new Error(countError.message);

  if ((count ?? 0) > 0) {
    if (!reset) {
      console.log(`roadmap_jobs already has ${count} rows — skipping seed.`);
      console.log("Run with --reset to wipe and reseed.");
      return;
    }
    const { error: delError } = await supabase
      .from("roadmap_jobs")
      .delete()
      .not("id", "is", null);
    if (delError) throw new Error(delError.message);
    console.log(`Deleted ${count} existing jobs.`);
  }

  const { error } = await supabase.from("roadmap_jobs").insert(
    SEEDS.map((s) => ({
      title: s.title,
      notes: s.notes ?? null,
      area: s.area,
      status: s.status ?? "todo",
      blocked_by: s.blocked_by ?? null,
      app_path: s.app_path ?? null,
      sort_order: s.sort_order ?? 0,
      checklist: toChecklist(s.checklist),
      comments: [],
    }))
  );
  if (error) throw new Error(error.message);
  console.log(`Seeded ${SEEDS.length} roadmap jobs.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
