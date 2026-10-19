/**
 * Re-read the LinkedIn name for threads saved as "Unknown contact".
 * Long display names ("Christopher Breiner, MSc BA Hons RICS Tech Partner")
 * used to fail the person-name check, so the sync never stored them.
 *
 *   npx tsx scripts/backfill-unknown-linkedin-names.ts --dry-run [--coach <id>]
 *   npx tsx scripts/backfill-unknown-linkedin-names.ts [--coach <id>]
 *
 * One Unipile attendee lookup per thread. Only writes prospect_name.
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
  const coachId = arg("--coach");

  const { supabaseAdmin } = await import("../src/lib/supabaseAdmin");
  const { conversationPersonName, personNameFromDisplayName } = await import(
    "../src/lib/messaging/conversationDisplay"
  );
  const { counterpartFromAttendees, parseUnipileAttendee } = await import(
    "../src/lib/unipile/chatCounterpart"
  );
  const { listUnipileChatAttendees } = await import("../src/lib/unipile/client");

  const rows: Array<Record<string, unknown>> = [];
  for (let from = 0; ; from += 1000) {
    let query = supabaseAdmin
      .from("messaging_conversations")
      .select("id, coach_id, prospect_name, prospect_email, unipile_chat_id")
      .eq("last_channel", "linkedin")
      .not("unipile_chat_id", "is", null)
      .order("id")
      .range(from, from + 999);
    if (coachId) query = query.eq("coach_id", coachId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }

  const unknown = rows.filter(
    (row) =>
      conversationPersonName({
        prospectName: row.prospect_name as string | null,
        prospectEmail: row.prospect_email as string | null,
        channel: "linkedin",
      }) === "Unknown contact"
  );
  console.log(`${unknown.length} of ${rows.length} LinkedIn threads show Unknown contact`);

  let fixed = 0;
  for (const row of unknown) {
    const listed = await listUnipileChatAttendees({
      chat_id: String(row.unipile_chat_id),
    });
    if (!listed.ok) {
      console.log(`  ${row.id}: attendee lookup failed`);
      continue;
    }
    const attendees = (listed.data?.items ?? [])
      .map(parseUnipileAttendee)
      .filter((a): a is NonNullable<typeof a> => Boolean(a));
    const raw = counterpartFromAttendees(attendees).name;
    const name = personNameFromDisplayName(raw);
    console.log(`  ${row.id}: ${JSON.stringify(raw)} -> ${JSON.stringify(name)}`);
    if (!name || dryRun) continue;
    const { error } = await supabaseAdmin
      .from("messaging_conversations")
      .update({ prospect_name: name.slice(0, 200) })
      .eq("id", row.id);
    if (error) console.log(`    update failed: ${error.message}`);
    else fixed += 1;
  }
  console.log(dryRun ? "Dry run, nothing written." : `Renamed ${fixed} threads.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
