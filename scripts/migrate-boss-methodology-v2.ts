/**
 * One-off: migrate diagnostic_50 answers and contact session_answers from methodology v1 to v2.
 *
 * Run: npx tsx scripts/migrate-boss-methodology-v2.ts
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in env (or .env.local)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

import {
  LEGACY_METHODOLOGY_VERSION,
  METHODOLOGY_VERSION,
  migrateAnswersV1ToV2,
  migrateSessionAnswersV1ToV2,
  type AnswersMap,
} from "../src/lib/bossMethodologyMigration";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    const [, key, raw] = m;
    if (process.env[key] == null) {
      process.env[key] = raw.replace(/^["']|["']$/g, "");
    }
  }
}

async function main() {
  loadEnvLocal();
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  let assessmentCount = 0;
  let contactCount = 0;

  const { data: assessments, error: assessErr } = await supabase
    .from("assessments")
    .select("id, answers, methodology_version")
    .eq("assessment_type", "diagnostic_50")
    .eq("methodology_version", LEGACY_METHODOLOGY_VERSION);

  if (assessErr) {
    console.error("Failed to load assessments:", assessErr.message);
    process.exit(1);
  }

  for (const row of assessments ?? []) {
    const v1Answers = (row.answers ?? {}) as AnswersMap;
    const v2Answers = migrateAnswersV1ToV2(v1Answers);
    const { error } = await supabase
      .from("assessments")
      .update({
        answers: v2Answers,
        methodology_version: METHODOLOGY_VERSION,
      })
      .eq("id", row.id);
    if (error) {
      console.error(`Assessment ${row.id}:`, error.message);
      continue;
    }
    assessmentCount += 1;
  }

  const { data: contacts, error: contactErr } = await supabase
    .from("contacts")
    .select("id, session_answers")
    .not("session_answers", "eq", "{}");

  if (contactErr) {
    console.error("Failed to load contacts:", contactErr.message);
    process.exit(1);
  }

  for (const row of contacts ?? []) {
    const raw = row.session_answers;
    if (!raw || typeof raw !== "object") continue;
    const notes = raw as Record<string, string | number>;
    const stringNotes: Record<string, string> = {};
    for (const [k, v] of Object.entries(notes)) {
      if (typeof v === "string") stringNotes[k] = v;
      else if (v != null) stringNotes[k] = String(v);
    }
    const migrated = migrateSessionAnswersV1ToV2(stringNotes);
    if (JSON.stringify(migrated) === JSON.stringify(stringNotes)) continue;

    const { error } = await supabase
      .from("contacts")
      .update({ session_answers: migrated })
      .eq("id", row.id);
    if (error) {
      console.error(`Contact ${row.id}:`, error.message);
      continue;
    }
    contactCount += 1;
  }

  console.log(
    `Migrated ${assessmentCount} diagnostic_50 assessment(s) and ${contactCount} contact session_answers row(s) to methodology v${METHODOLOGY_VERSION}.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
