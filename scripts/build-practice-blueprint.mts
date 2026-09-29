/**
 * Write a coach's Practice Blueprint sections from the terminal.
 *
 *   npx tsx scripts/build-practice-blueprint.mts <coachId>            # every "We build" section, in build order
 *   npx tsx scripts/build-practice-blueprint.mts <coachId> market:avatar market:pains
 *   npx tsx scripts/build-practice-blueprint.mts <coachId> --fresh    # clear written sections first
 *
 * Hydrates the practice record first (LinkedIn, sign-up), then calls the same
 * buildSection() the app uses. Prints each section as Markdown. Uses .env.local.
 */
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  process.env[t.slice(0, i).trim()] ??= v;
}

const args = process.argv.slice(2);
const fresh = args.includes("--fresh");
const [coachId, ...keys] = args.filter((a) => a !== "--fresh");
if (!coachId) {
  console.error("Usage: npx tsx scripts/build-practice-blueprint.mts <coachId> [section keys...]");
  process.exit(1);
}

const { hydratePracticeFromProfile } = await import("@/lib/practiceKnowledge/hydrate");
const { buildSection } = await import("@/lib/practiceKnowledge/buildSection");
const { buildOrder } = await import("@/lib/practiceKnowledge/blueprint");
const { blocksToMarkdown } = await import("@/lib/practiceKnowledge/blocks");

await hydratePracticeFromProfile(coachId);
if (fresh) {
  const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
  await supabaseAdmin.from("coach_practice_knowledge").update({ built_sections: {} }).eq("coach_id", coachId);
}
const order = keys.length && keys[0] !== "all" ? keys : buildOrder();
let failed = 0;
for (const key of order) {
  const started = Date.now();
  try {
    const row = await buildSection(coachId, key);
    const md = blocksToMarkdown(row.built_sections[key].blocks, 3);
    console.log(`\n===== ${key} (${Math.round((Date.now() - started) / 1000)}s, ${md.length} chars)\n${md}`);
  } catch (err) {
    failed += 1;
    console.log(`\n===== ${key} FAILED: ${err instanceof Error ? err.message : err}`);
  }
}
process.exit(failed ? 1 : 0);
