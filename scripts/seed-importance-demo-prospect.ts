/**
 * Seed "Importance Demo" prospect on Profit Coach Snapshot with ~60% BOSS scores
 * and varied impact / urgency / ease for matrix testing.
 *
 * Usage:
 *   npx tsx scripts/seed-importance-demo-prospect.ts
 *   npx tsx scripts/seed-importance-demo-prospect.ts --dry-run
 */

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { PLAYBOOKS } from "../src/lib/bossData";
import {
  playbookProspectScoresKey,
  type PlaybookProspectScores,
  type ProspectEaseLevel,
  type ProspectImpactLevel,
  type ProspectUrgencyLevel,
} from "../src/lib/playbookSessionNotes";

loadEnvConfig(process.cwd());

const dryRun = process.argv.includes("--dry-run");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SNAPSHOT_COACH_EMAIL = "profit-coach-snapshot@businesscoachacademy.com";
const SNAPSHOT_COACH_SLUG = "profit-coach-snapshot";
const DEMO_NAME = "Importance Demo";
const DEMO_BUSINESS = "Demo Co";

/** ~60% of playbooks: mainly L1–L3, some L4, gaps on L3 and one on L2. */
const SCORED_REFS = new Set([
  // Level 1 — all except 1.7
  "1.0",
  "1.1",
  "1.2",
  "1.3",
  "1.4",
  "1.5",
  "1.6",
  "1.8",
  "1.9",
  // Level 2 — all except 2.8
  "2.0",
  "2.1",
  "2.2",
  "2.3",
  "2.4",
  "2.5",
  "2.6",
  "2.7",
  "2.9",
  // Level 3 — skip 3.2, 3.5, 3.8
  "3.0",
  "3.1",
  "3.3",
  "3.4",
  "3.6",
  "3.7",
  "3.9",
  // Level 4 — sample
  "4.0",
  "4.1",
  "4.3",
  "4.5",
  "4.7",
]);

const IMPACT_CYCLE: ProspectImpactLevel[] = [3, 2, 1, 3, 2];
const URGENCY_CYCLE: ProspectUrgencyLevel[] = [4, 3, 2, 1, 4, 2];
const EASE_CYCLE: ProspectEaseLevel[] = [3, 2, 1, 3, 1, 2];

function bossScoreForRef(ref: string): 0 | 1 | 2 {
  const level = Number.parseInt(ref.split(".")[0] ?? "1", 10);
  const area = Number.parseInt(ref.split(".")[1] ?? "0", 10);
  const hash = (level * 7 + area * 3) % 10;
  if (level >= 4) return hash < 4 ? 2 : hash < 7 ? 1 : 0;
  if (level === 3) return hash < 3 ? 2 : hash < 6 ? 1 : 0;
  if (level === 2) return hash < 2 ? 2 : hash < 5 ? 1 : 0;
  return hash < 1 ? 2 : hash < 4 ? 1 : 0;
}

function prospectScoresForRef(ref: string, index: number): PlaybookProspectScores {
  const impact = IMPACT_CYCLE[index % IMPACT_CYCLE.length];
  const urgency = URGENCY_CYCLE[index % URGENCY_CYCLE.length];
  const ease = EASE_CYCLE[index % EASE_CYCLE.length];

  // A few incomplete rows for matrix edge cases
  if (ref === "2.4") return { impact, urgency };
  if (ref === "3.6") return { impact, ease };
  if (ref === "4.1") return { impact };

  return { impact, urgency, ease };
}

function buildSessionAnswers(): Record<string, 0 | 1 | 2> {
  const answers: Record<string, 0 | 1 | 2> = {};
  for (const ref of SCORED_REFS) {
    answers[ref] = bossScoreForRef(ref);
  }
  return answers;
}

function buildPlaybookNotes(): Record<string, string> {
  const notes: Record<string, string> = {};
  let index = 0;
  for (const ref of [...SCORED_REFS].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  )) {
    const scores = prospectScoresForRef(ref, index);
    index += 1;
    notes[playbookProspectScoresKey(ref)] = JSON.stringify(scores);

    const meta = PLAYBOOKS.find((p) => p.ref === ref);
    if (meta) {
      notes[ref] = `Workshop notes for ${meta.name} — demo prospect for priority matrix.`;
    }
  }
  return notes;
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (authError) {
    console.error("Could not list auth users:", authError.message);
    process.exit(1);
  }

  const snapshotUser = authUsers.users.find(
    (user) => user.email?.toLowerCase() === SNAPSHOT_COACH_EMAIL
  );
  if (!snapshotUser) {
    console.error(
      `Coach auth user not found (${SNAPSHOT_COACH_EMAIL}). Create via Admin first.`
    );
    process.exit(1);
  }

  const coachId = snapshotUser.id;
  const sessionAnswers = buildSessionAnswers();
  const playbookNotes = buildPlaybookNotes();

  const scoredCount = SCORED_REFS.size;
  const totalPlaybooks = PLAYBOOKS.length;
  const pct = Math.round((scoredCount / totalPlaybooks) * 100);

  console.log(`Coach: Profit Coach Snapshot (${coachId})`);
  console.log(`Prospect: ${DEMO_NAME}`);
  console.log(`BOSS scores: ${scoredCount}/${totalPlaybooks} (${pct}%)`);
  console.log(`Prospect priority rows: ${scoredCount}`);

  if (dryRun) {
    console.log("\n--dry-run: no database writes.");
    console.log("Sample session answers:", Object.keys(sessionAnswers).slice(0, 5).join(", "), "…");
    console.log("Sample prospect scores:", playbookNotes["1.0__prospect_scores"]);
    return;
  }

  const { data: existing, error: existingError } = await supabase
    .from("contacts")
    .select("id, full_name")
    .eq("coach_id", coachId)
    .ilike("full_name", DEMO_NAME)
    .maybeSingle();

  if (existingError) {
    console.error("Could not look up existing contact:", existingError.message);
    process.exit(1);
  }

  const payload = {
    coach_id: coachId,
    full_name: DEMO_NAME,
    business_name: DEMO_BUSINESS,
    type: "prospect" as const,
    session_answers: sessionAnswers,
    playbook_session_notes: playbookNotes,
    pillar_session_notes: {},
  };

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from("contacts")
      .update({
        business_name: DEMO_BUSINESS,
        type: "prospect",
        session_answers: sessionAnswers,
        playbook_session_notes: playbookNotes,
      })
      .eq("id", existing.id);

    if (updateError) {
      console.error("Could not update contact:", updateError.message);
      process.exit(1);
    }

    console.log(`Updated existing contact ${existing.id}`);
    console.log(`Workshop URL path: /coach/contacts/${existing.id}`);
    return;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("contacts")
    .insert(payload)
    .select("id")
    .maybeSingle();

  if (insertError || !inserted) {
    console.error("Could not create contact:", insertError?.message ?? "unknown error");
    process.exit(1);
  }

  console.log(`Created contact ${inserted.id}`);
  console.log(`Workshop URL path: /coach/contacts/${inserted.id}`);
}

void main();
