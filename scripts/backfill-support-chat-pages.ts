/**
 * Links older Support chats to the page they're about (5 Nov), using the same
 * AI pick as new chats, so they get an "Open … page" button too. Only chats
 * from coaches with no page yet; leaves alone any the AI finds aren't about
 * one page. BCA can change any of them in Admin → Support.
 *
 * Run: npx tsx scripts/backfill-support-chat-pages.ts [--dry] [--coach <profile id>]
 */

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { supabaseAdmin } = await import("../src/lib/supabaseAdmin");
  const { setChatPage, suggestPagesForChat } = await import("../src/lib/support/chatPageSuggest");
  const { chatPageFor } = await import("../src/lib/support/chatPages");

  const dry = process.argv.includes("--dry");
  const coachAt = process.argv.indexOf("--coach");
  const coach = coachAt > -1 ? process.argv[coachAt + 1] : null;

  let query = supabaseAdmin
    .from("community_feedback_reports")
    .select("id, title")
    .not("created_by", "is", null)
    .is("context_path", null)
    .order("created_at", { ascending: true });
  if (coach) query = query.eq("created_by", coach);
  const { data: chats, error } = await query;
  if (error) throw new Error(error.message);

  let linked = 0;
  for (const chat of chats ?? []) {
    const [best] = await suggestPagesForChat(chat.id);
    const page = chatPageFor(best);
    console.log(`${page ? page.name.padEnd(20) : "(none)".padEnd(20)} ${chat.title ?? ""}`);
    if (page && !dry) {
      if (await setChatPage(chat.id, page.path)) linked += 1;
    }
  }
  console.log(`\n${chats?.length ?? 0} chats checked, ${dry ? "dry run, nothing saved" : `${linked} linked`}.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
