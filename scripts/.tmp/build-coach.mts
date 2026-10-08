/** Local runner: hydrate a coach's practice record and write We build sections. */
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const t = line.trim(); if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("="); if (i < 0) continue;
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  process.env[t.slice(0, i).trim()] ??= v;
}
const [coachId, ...keys] = process.argv.slice(2);
const { hydratePracticeFromProfile } = await import("@/lib/practiceKnowledge/hydrate");
const { buildSection } = await import("@/lib/practiceKnowledge/buildSection");
const { buildOrder } = await import("@/lib/practiceKnowledge/blueprint");
const { blocksToMarkdown } = await import("@/lib/practiceKnowledge/blocks");
await hydratePracticeFromProfile(coachId);
const order = keys.length && keys[0] !== "all" ? keys : buildOrder();
for (const key of order) {
  const t = Date.now();
  try {
    const row = await buildSection(coachId, key);
    const md = blocksToMarkdown(row.built_sections[key].blocks, 3);
    console.log(`\n===== ${key} (${Math.round((Date.now() - t) / 1000)}s, ${md.length} chars)\n${md}`);
  } catch (err) {
    console.log(`\n===== ${key} FAILED: ${err instanceof Error ? err.message : err}`);
  }
}
