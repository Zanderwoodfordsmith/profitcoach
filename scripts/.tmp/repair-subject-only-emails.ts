/**
 * One-off: stored email rows whose body is just the subject (meta_only sync)
 * get their real body from Unipile.
 *
 *   npx tsx scripts/.tmp/repair-subject-only-emails.ts
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { supabaseAdmin } = await import("../../src/lib/supabaseAdmin");
  const { getUnipileEmail } = await import("../../src/lib/unipile/client");
  const { isPlaceholderEmailBody, unipileEmailBodyText } = await import(
    "../../src/lib/messaging/emailBody"
  );

  const rows: Array<{
    id: string;
    body_text: string | null;
    unipile_message_id: string | null;
    metadata: { subject?: string } | null;
    conversation_id: string;
  }> = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabaseAdmin
      .from("messaging_messages")
      .select("id, body_text, unipile_message_id, metadata, conversation_id")
      .eq("channel", "email")
      .not("unipile_message_id", "is", null)
      .range(from, from + 999);
    rows.push(...((data ?? []) as typeof rows));
    if (!data || data.length < 1000) break;
  }
  const targets = rows.filter((row) =>
    isPlaceholderEmailBody(row.body_text, row.metadata?.subject ?? null)
  );
  console.log("placeholder email rows:", targets.length);

  const accountByConv = new Map<string, string | null>();
  let fixed = 0;
  let empty = 0;
  let failed = 0;
  for (const row of targets) {
    if (!accountByConv.has(row.conversation_id)) {
      const { data: conv } = await supabaseAdmin
        .from("messaging_conversations")
        .select("unipile_account_id")
        .eq("id", row.conversation_id)
        .maybeSingle();
      accountByConv.set(
        row.conversation_id,
        (conv?.unipile_account_id as string | null) ?? null
      );
    }
    const full = await getUnipileEmail(
      row.unipile_message_id!,
      accountByConv.get(row.conversation_id)
    );
    if (!full.ok || !full.data) {
      failed += 1;
      continue;
    }
    const body = unipileEmailBodyText(full.data);
    if (!body) {
      empty += 1;
      continue;
    }
    await supabaseAdmin
      .from("messaging_messages")
      .update({ body_text: body })
      .eq("id", row.id);
    fixed += 1;
  }
  console.log({ fixed, emptyInUnipile: empty, fetchFailed: failed });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
