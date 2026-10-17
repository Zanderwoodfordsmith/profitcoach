/**
 * Triage past LinkedIn replies so admins can review Ava's calls in
 * /admin/ava/replies before any autopilot exists. Never alerts, never sends.
 *
 *   npx tsx scripts/backfill-ava-reply-triage.ts --dry-run --days 120
 *   npx tsx scripts/backfill-ava-reply-triage.ts --days 120 --limit 400 [--draft]
 *
 * Costs one small Claude call per conversation (two with --draft).
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

function arg(flag: string): string | null {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] ?? null : null;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const draft = process.argv.includes("--draft");
  const days = Number(arg("--days") || 120);
  const limit = Number(arg("--limit") || 300);
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const { supabaseAdmin } = await import("../src/lib/supabaseAdmin");
  const { triageLatestInbound } = await import("../src/lib/ava/replyAlert");

  const { data: convs, error } = await supabaseAdmin
    .from("messaging_conversations")
    .select("id, coach_id, last_message_at")
    .eq("last_channel", "linkedin")
    .is("hidden_at", null)
    .gte("last_message_at", since)
    .order("last_message_at", { ascending: false })
    .limit(limit * 3);
  if (error) throw new Error(error.message);

  // Only conversations where the prospect has said something.
  const withInbound: { id: string; coach_id: string }[] = [];
  for (const c of convs ?? []) {
    const { count } = await supabaseAdmin
      .from("messaging_messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", c.id)
      .eq("direction", "inbound");
    if ((count ?? 0) > 0) withInbound.push({ id: c.id as string, coach_id: c.coach_id as string });
    if (withInbound.length >= limit) break;
  }
  console.log(`${withInbound.length} LinkedIn conversations with replies since ${since.slice(0, 10)}`);
  if (dryRun) {
    console.log("Dry run: nothing triaged.");
    return;
  }

  const tally: Record<string, number> = {};
  for (const [i, c] of withInbound.entries()) {
    const out = await triageLatestInbound({
      coachId: c.coach_id,
      conversationId: c.id,
      alert: false,
      draft,
      anyAge: true,
      includeAnswered: true,
    });
    const key = out.done ? `${out.disposition}/${out.nextStep}` : `skip: ${out.reason}`;
    tally[key] = (tally[key] || 0) + 1;
    if ((i + 1) % 25 === 0) console.log(`${i + 1}/${withInbound.length}`);
  }
  console.log(tally);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
