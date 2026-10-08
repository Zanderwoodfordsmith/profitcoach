/**
 * One-off: force-sync every coach's Unipile inbox after the
 * messaging_messages unique-index fix, so threads that only had a
 * webhook-bumped timestamp get their messages pulled.
 *
 *   npx tsx scripts/.tmp/resync-all-inboxes.ts [--coach-id <uuid>]
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { supabaseAdmin } = await import("../../src/lib/supabaseAdmin");
  const { syncUnipileInboxForCoach } = await import(
    "../../src/lib/unipile/inboxSync"
  );

  const onlyIdx = process.argv.indexOf("--coach-id");
  const only = onlyIdx >= 0 ? process.argv[onlyIdx + 1] : null;

  const { data: accounts } = await supabaseAdmin
    .from("linkedin_outreach_accounts")
    .select("coach_id, last_synced_at")
    .eq("status", "OK");
  const oldest = new Map<string, number>();
  for (const row of accounts ?? []) {
    const at = row.last_synced_at ? Date.parse(row.last_synced_at as string) : 0;
    const prev = oldest.get(row.coach_id as string);
    if (prev === undefined || at < prev) oldest.set(row.coach_id as string, at);
  }
  const coachIds = only
    ? [only]
    : [...oldest.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);

  for (const coachId of coachIds) {
    const t0 = Date.now();
    try {
      const result = await syncUnipileInboxForCoach(coachId, {
        force: true,
        minIntervalMs: 0,
      });
      console.log(
        coachId,
        JSON.stringify(result),
        `${Math.round((Date.now() - t0) / 1000)}s`
      );
    } catch (err) {
      console.error(coachId, "FAILED", err instanceof Error ? err.message : err);
    }
  }

  // Report remaining empty Unipile threads.
  const convs: Array<{ id: string; coach_id: string; last_channel: string }> = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabaseAdmin
      .from("messaging_conversations")
      .select("id, coach_id, last_channel")
      .not("unipile_chat_id", "is", null)
      .range(from, from + 999);
    convs.push(...((data ?? []) as typeof convs));
    if (!data || data.length < 1000) break;
  }
  const withMsgs = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data } = await supabaseAdmin
      .from("messaging_messages")
      .select("conversation_id")
      .range(from, from + 999);
    for (const r of data ?? []) withMsgs.add(r.conversation_id as string);
    if (!data || data.length < 1000) break;
  }
  const empty = convs.filter((c) => !withMsgs.has(c.id));
  const byChannel: Record<string, number> = {};
  for (const c of empty) byChannel[c.last_channel] = (byChannel[c.last_channel] || 0) + 1;
  console.log("remaining empty threads:", empty.length, "of", convs.length, byChannel);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
