/**
 * Fill Ava's memory from scratch, or catch it up, by running the memory
 * connectors until nothing is left. The cron (/api/cron/ava-memory) does the
 * same every 30 minutes in small steps.
 *
 *   npx tsx scripts/ava-memory-backfill.ts --dry-run   # what would be read, and the Haiku cost
 *   npx tsx scripts/ava-memory-backfill.ts             # run it
 *   npx tsx scripts/ava-memory-backfill.ts --only ava_chat,sales_call
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const onlyArg = argv[argv.indexOf("--only") + 1];
const only = argv.includes("--only") && onlyArg ? onlyArg.split(",") : undefined;

async function estimate() {
  const { supabaseAdmin } = await import("../src/lib/supabaseAdmin");
  const { chatText } = await import("../src/lib/agent/memory/connectors");
  const { RAW_CHUNK } = await import("../src/lib/agent/memory/store");
  const { NOTES_PRICE } = await import("../src/lib/agent/memory/summarize");

  const long: number[] = [];
  const { data: chats, error } = await supabaseAdmin
    .from("ai_agent_chats")
    .select("mode, api_messages")
    .not("coach_id", "is", null);
  if (error) throw new Error(error.message);
  for (const chat of chats ?? []) {
    const text = chatText(chat as Parameters<typeof chatText>[0]);
    if (text.length > RAW_CHUNK) long.push(text.length);
  }
  const transcripts = await Promise.all([
    supabaseAdmin.from("practice_source_transcripts").select("body"),
    supabaseAdmin.from("bookings").select("zoom_transcript_text").not("zoom_transcript_text", "is", null),
  ]);
  for (const row of transcripts[0].data ?? []) if (String(row.body).length > RAW_CHUNK) long.push(String(row.body).length);
  for (const row of transcripts[1].data ?? []) {
    const len = String(row.zoom_transcript_text).length;
    if (len > RAW_CHUNK) long.push(len);
  }
  // ~4 characters a token; the prompt adds ~500 tokens in, notes ~1,500 tokens out.
  const inputTokens = long.reduce((sum, chars) => sum + Math.min(chars, 300_000) / 4 + 500, 0);
  const outputTokens = long.length * 1_500;
  const cost = (inputTokens * NOTES_PRICE[0] + outputTokens * NOTES_PRICE[1]) / 1e6;
  console.log(`Long items needing Haiku notes: ${long.length} (chats and call transcripts).`);
  console.log(`Estimated Haiku cost: about $${cost.toFixed(2)} (${Math.round(inputTokens).toLocaleString()} tokens in).`);
  const posts = await supabaseAdmin.from("linkedin_post_history").select("id", { count: "exact", head: true });
  const issues = await supabaseAdmin.from("linkedin_newsletter_issues").select("id", { count: "exact", head: true });
  console.log(`Stored as they are (no cost): ${posts.count ?? 0} LinkedIn posts, ${issues.count ?? 0} newsletter issues.`);
}

async function main() {
  if (dryRun) return estimate();
  const { ingestAll } = await import("../src/lib/agent/memory/ingest");
  let total = 0;
  for (let round = 1; round <= 200; round++) {
    const report = await ingestAll({ maxNotes: 40, only: only as never });
    total += report.costUsd;
    const line = report.results.map((r) => `${r.source} ${r.items}${r.notes ? ` (${r.notes} notes)` : ""}`).join(", ");
    console.log(`Round ${round}: ${line || "nothing"}. Cost so far $${total.toFixed(3)}.`);
    for (const e of report.errors) console.error(`  ${e.source} failed: ${e.error}`);
    if (!report.more || report.errors.length) break;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
